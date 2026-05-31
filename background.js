/**
 * Better Canvas: Integrated API & Background Script
 */

// --- API Logic (Formerly api.js) ---
var CanvasAPI = {
  async getUpcomingEvents(baseUrl, token = null) {
    try {
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const now = new Date();
      const startDate = now.toISOString();
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 6); // Look 6 months ahead
      const endDate = futureDate.toISOString();

      if (!baseUrl.startsWith('http')) {
        throw new Error(`Invalid Base URL: ${baseUrl}`);
      }

      const response = await fetch(`${baseUrl}/api/v1/courses?per_page=100&enrollment_state=active&state[]=available`, {
        method: 'GET',
        headers: headers
      });

      // Simple course test or planners can fetch separately
      const eventResponse = await fetch(`${baseUrl}/api/v1/planner/items?start_date=${startDate}&end_date=${endDate}`, {
        method: 'GET',
        headers: headers
      });

      if (!eventResponse.ok) {
        const errorBody = await eventResponse.text().catch(() => '');
        console.error('CanvasAPI Fetch Failed:', eventResponse.status, errorBody);
        
        if (errorBody.includes('Free-for-Teacher Access Temporarily Disabled')) {
          throw new Error('Canvas has temporarily disabled Free-for-Teacher accounts. Please check http://www.instructure.com/incident_update');
        }
        
        if (eventResponse.status === 401) throw new Error('Unauthorized: Please check your API token.');
        throw new Error(`Fetch failed (${eventResponse.status}): ${eventResponse.statusText}`);
      }
      return await eventResponse.json();
    } catch (error) {
      console.error('CanvasAPI Critical Error:', error.name, error.message);
      throw error;
    }
  },

  async getCourses(baseUrl, token = null) {
    try {
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (!baseUrl.startsWith('http')) {
        throw new Error(`Invalid Base URL: ${baseUrl}`);
      }

      // Try to fetch favorites/pinned courses first
      let response = await fetch(`${baseUrl}/api/v1/users/self/favorites/courses?per_page=100`, {
        method: 'GET',
        headers: headers
      });

      let courses = [];
      if (response.ok) {
        courses = await response.json();
      }

      // Fall back to all active courses if favorites list is empty
      if (!Array.isArray(courses) || courses.length === 0) {
        response = await fetch(`${baseUrl}/api/v1/courses?per_page=100&enrollment_state=active&state[]=available`, {
          method: 'GET',
          headers: headers
        });
        if (response.ok) {
          courses = await response.json();
        } else {
          throw new Error(`Fetch failed (${response.status}): ${response.statusText}`);
        }
      }
      return courses;
    } catch (error) {
      console.error('CanvasAPI getCourses Error:', error);
      throw error;
    }
  },

  async getCourseAssignments(baseUrl, courseId, token = null) {
    try {
      const headers = { 'Accept': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (!baseUrl.startsWith('http')) {
        throw new Error(`Invalid Base URL: ${baseUrl}`);
      }

      const response = await fetch(`${baseUrl}/api/v1/courses/${courseId}/assignments?per_page=100`, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`Fetch failed (${response.status}): ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('CanvasAPI getCourseAssignments Error:', error);
      throw error;
    }
  },

  formatTasks(plannerItems) {
    return plannerItems
      .filter(item => (item.plannable_type === 'assignment' || item.plannable_type === 'quiz') && item.plannable)
      .filter(item => !item.submissions || !item.submissions.submitted) // Exclude submitted
      .map(item => {
        const plannable = item.plannable;
        return {
          id: plannable.id || item.id,
          title: plannable.title || plannable.name,
          dueDate: plannable.due_at || item.plannable_date,
          courseName: item.context_name || 'Assignment',
          url: plannable.html_url || item.html_url,
          points: plannable.points_possible,
          isMissing: (item.submissions && item.submissions.missing) || false
        };
      })
      .sort((a, b) => (a.dueDate && b.dueDate) ? new Date(a.dueDate) - new Date(b.dueDate) : 0);
  }
};

// --- Background Logic ---
let cachedTasks = [];
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

console.log('Canvas Pulse Background Script Initialized');

function updateBadge(count) {
  try {
    const text = count > 0 ? count.toString() : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#ff4757' });
  } catch (error) {
    console.error('Badge update error:', error);
  }
}

// Initialize alarms safely
try {
  chrome.alarms.create('refreshTasks', { periodInMinutes: 15 });
} catch (error) {
  console.warn('Alarm already exists or error creating alarm:', error);
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === 'getCourses') {
      const baseUrl = request.baseUrl;
      if (!baseUrl) {
        sendResponse({ error: 'Canvas URL not configured' });
        return true;
      }
      chrome.storage.local.get(['canvasToken'], (data) => {
        const token = data.canvasToken || null;
        CanvasAPI.getCourses(baseUrl, token)
          .then(courses => sendResponse({ courses }))
          .catch(error => sendResponse({ error: error.message }));
      });
      return true;
    }

    if (request.action === 'getCourseAssignments') {
      const baseUrl = request.baseUrl;
      const courseId = request.courseId;
      if (!baseUrl || !courseId) {
        sendResponse({ error: 'Canvas URL or Course ID missing' });
        return true;
      }
      chrome.storage.local.get(['canvasToken'], (data) => {
        const token = data.canvasToken || null;
        CanvasAPI.getCourseAssignments(baseUrl, courseId, token)
          .then(assignments => sendResponse({ assignments }))
          .catch(error => sendResponse({ error: error.message }));
      });
      return true;
    }

    if (request.action === 'getTasks') {
      const baseUrl = request.baseUrl;
      
      // Require baseUrl to be set
      if (!baseUrl) {
        sendResponse({ error: 'Canvas URL not configured', customTasks: [], completedIds: [] });
        return true;
      }

      const now = Date.now();

      chrome.storage.local.get(['canvasToken', 'customTasks', 'completedTaskIds'], (data) => {
        const token = data.canvasToken || null;
        const customTasks = data.customTasks || [];
        const completedIds = data.completedTaskIds || [];

        // Skip API call if no token configured
        if (!token) {
          updateBadge(customTasks.length);
          sendResponse({ tasks: [], customTasks, completedIds });
          return;
        }

        if (cachedTasks.length > 0 && (now - lastFetchTime < CACHE_DURATION)) {
          updateBadge(cachedTasks.length + customTasks.length);
          sendResponse({ tasks: cachedTasks, customTasks, completedIds });
        } else {
          CanvasAPI.getUpcomingEvents(baseUrl, token)
            .then(events => {
              cachedTasks = CanvasAPI.formatTasks(events);
              lastFetchTime = Date.now();
              chrome.storage.local.set({ cachedTasks, lastFetchTime, canvasUrl: baseUrl });
              updateBadge(cachedTasks.length + customTasks.length);
              sendResponse({ tasks: cachedTasks, customTasks, completedIds });
            })
            .catch(error => {
              console.error('getTasks error:', error);
              sendResponse({ error: error.message, customTasks, completedIds });
            });
        }
      });
      return true;
    }

    if (request.action === 'getCachedTasks') {
      chrome.storage.local.get(['cachedTasks', 'lastFetchTime', 'customTasks', 'completedTaskIds'], (data) => {
        const tasks = data.cachedTasks || [];
        const custom = data.customTasks || [];
        updateBadge(tasks.length + custom.length);
        sendResponse({ 
          tasks, 
          customTasks: custom,
          completedIds: data.completedTaskIds || [],
          lastFetchTime: data.lastFetchTime || 0 
        });
      });
      return true;
    }
  } catch (error) {
    console.error('Message listener error:', error);
    sendResponse({ error: error.message });
  }
});

// Alarm handler
chrome.alarms.onAlarm.addListener((alarm) => {
  try {
    if (alarm.name === 'refreshTasks') {
      chrome.storage.local.get(['canvasUrl', 'canvasToken', 'customTasks'], (data) => {
        // Only refresh if token and URL are configured
        if (data.canvasUrl && data.canvasToken) {
          CanvasAPI.getUpcomingEvents(data.canvasUrl, data.canvasToken)
            .then(events => {
              const tasks = CanvasAPI.formatTasks(events);
              cachedTasks = tasks;
              lastFetchTime = Date.now();
              chrome.storage.local.set({ cachedTasks, lastFetchTime });
              updateBadge(tasks.length + (data.customTasks || []).length);
            })
            .catch(err => console.error('Background refresh failed:', err));
        }
      });
    }
  } catch (error) {
    console.error('Alarm handler error:', error);
  }
});
