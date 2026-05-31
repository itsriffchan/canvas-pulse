/**
 * Canvas Pulse Popup Logic 3.0
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Views
  const taskListView = document.getElementById('task-list-view');
  const addTaskView = document.getElementById('add-task-view');
  const settingsView = document.getElementById('settings-view');
  const viewTitle = document.getElementById('view-title');
  const addMenuView = document.getElementById('add-menu-view');
  const browseView = document.getElementById('browse-assignments-view');
  const browseCoursesView = document.getElementById('browse-courses-view');
  const courseAssignmentsView = document.getElementById('course-assignments-view');

  // Elements
  const taskList = document.getElementById('task-list');
  const addTaskBtn = document.getElementById('add-task-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const saveTaskBtn = document.getElementById('save-task-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  
  const courseSearch = document.getElementById('course-search');
  const coursesList = document.getElementById('courses-list');
  const backCoursesBtn = document.getElementById('back-courses-btn');
  
  const courseAssignmentSearch = document.getElementById('course-assignment-search');
  const courseAssignmentsList = document.getElementById('course-assignments-list');
  const backCourseAssignmentsBtn = document.getElementById('back-course-assignments-btn');

  // Inputs
  const canvasUrlInput = document.getElementById('canvas-url');
  const apiTokenInput = document.getElementById('api-token');
  const newTaskTitle = document.getElementById('new-task-title');
  const newTaskDate = document.getElementById('new-task-date');
  const newTaskSchedule = document.getElementById('new-task-schedule');
  const newTaskCourse = document.getElementById('new-task-course');

  let currentTasks = [];
  let currentCustomTasks = [];
  let completedIds = [];
  let currentFilter = 'deadlines';
  let editingTaskId = null;
  let overridingTaskId = null;
  let deadlineOverrides = {};
  
  let selectedCourseId = null;
  let selectedCourseName = '';
  let activeCourses = [];
  let courseAssignments = [];
  let prefilledUrl = null;

  // Tabs
  const tabContainer = document.getElementById('popup-tabs');

  const switchView = (view) => {
    taskListView.style.display = view === 'tasks' ? 'block' : 'none';
    addMenuView.style.display = view === 'add-menu' ? 'block' : 'none';
    browseView.style.display = view === 'browse' ? 'flex' : 'none';
    browseCoursesView.style.display = view === 'browse-courses' ? 'flex' : 'none';
    courseAssignmentsView.style.display = view === 'course-assignments' ? 'flex' : 'none';
    addTaskView.style.display = view === 'add' ? 'block' : 'none';
    settingsView.style.display = view === 'settings' ? 'block' : 'none';
    
    tabContainer.style.display = view === 'tasks' ? 'flex' : 'none';
    
    if (view === 'tasks') viewTitle.innerText = 'Canvas Pulse';
    if (view === 'add-menu') viewTitle.innerText = 'Add Task';
    if (view === 'browse') {
      viewTitle.innerText = 'Browse Canvas';
      document.getElementById('assignment-search').value = '';
      renderBrowseList();
    }
    if (view === 'browse-courses') {
      viewTitle.innerText = 'Browse Courses';
      courseSearch.value = '';
      renderCoursesList();
    }
    if (view === 'course-assignments') {
      viewTitle.innerText = (selectedCourseName || 'Assignments').substring(0, 18);
      courseAssignmentSearch.value = '';
      renderCourseAssignmentsList();
    }
    if (view === 'add') {
      if (overridingTaskId) viewTitle.innerText = 'Reassign Date';
      else if (editingTaskId) viewTitle.innerText = 'Edit Task';
      else viewTitle.innerText = 'New Task';
    }
    if (view === 'settings') viewTitle.innerText = 'Settings';
  };

  // Initialize with task list view visible and other views hidden
  switchView('tasks');

  const resetForm = () => {
    editingTaskId = null;
    overridingTaskId = null;
    prefilledUrl = null;
    newTaskTitle.value = '';
    newTaskTitle.disabled = false;
    newTaskCourse.value = '';
    newTaskCourse.disabled = false;
    newTaskDate.value = '';
    newTaskSchedule.value = '';
    saveTaskBtn.innerText = 'Save Task';
  };

  const getRelativeTime = (date) => {
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return { text: 'Overdue', class: 'deadline-urgent' };
    if (diffMins < 60) return { text: `in ${diffMins} mins`, class: 'deadline-urgent' };
    if (diffHours < 24) return { text: `in ${diffHours} hours`, class: 'deadline-urgent' };
    if (diffDays < 3) return { text: `in ${diffDays} days`, class: 'deadline-soon' };
    return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), class: 'deadline-later' };
  };

  const getDetailedDueDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const monthDay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${weekday}, ${monthDay} at ${time}`;
  };

  const renderBrowseList = (searchQuery = '') => {
    const browseList = document.getElementById('browse-list');
    if (!browseList) return;
    
    let assignments = [...currentTasks];
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      assignments = assignments.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.courseName.toLowerCase().includes(q)
      );
    }

    if (assignments.length === 0) {
      browseList.innerHTML = `<div class="empty-state" style="padding: 2rem 1rem;"><p style="font-size: 0.85rem;">No assignments found.</p></div>`;
      return;
    }

    browseList.innerHTML = assignments.map((task, index) => {
      const date = task.dueDate ? new Date(task.dueDate) : null;
      let dateStr = 'No Due Date';
      if (date) {
        const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
        const monthDay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        dateStr = `${weekday}, ${monthDay} at ${time}`;
      }

      return `
        <div class="hover-card" style="padding: 0.55rem 0.85rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.025); transition: all 0.2s;">
          <div style="flex: 1; min-width: 0; text-align: left;">
            <div class="task-course" style="font-size: 0.65rem; margin-bottom: 0.15rem;">${task.courseName}</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${task.title}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem;">${dateStr}</div>
          </div>
          <button class="browse-select-btn" data-id="${task.id}" title="Reschedule Assignment" style="background: var(--accent-primary); border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; transition: background 0.2s;">
            Select
          </button>
        </div>
      `;
    }).join('');

    browseList.querySelectorAll('.browse-select-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const task = currentTasks.find(t => t.id == id);
        if (task) {
          editingTaskId = null;
          overridingTaskId = task.id;
          
          newTaskTitle.value = task.title;
          newTaskTitle.disabled = true;
          newTaskCourse.value = task.courseName || '';
          newTaskCourse.disabled = true;
          
          if (task.dueDate) {
            const date = new Date(task.dueDate);
            const tzOffset = date.getTimezoneOffset() * 60000;
            newTaskDate.value = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
          } else {
            newTaskDate.value = '';
          }
          
          newTaskSchedule.value = '';
          
          switchView('add');
          viewTitle.innerText = 'Reassign Date';
          saveTaskBtn.innerText = 'Reassign Date';
        }
      };
    });
  };

  const renderCoursesList = (searchQuery = '') => {
    if (!coursesList) return;
    
    if (activeCourses.length === 0) {
      coursesList.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="loader"></div>
          <p style="font-size: 0.85rem;">Loading active courses...</p>
        </div>
      `;
      chrome.storage.local.get(['canvasUrl'], (data) => {
        chrome.runtime.sendMessage({ action: 'getCourses', baseUrl: data.canvasUrl }, (response) => {
          if (response && response.courses && Array.isArray(response.courses)) {
            activeCourses = response.courses.filter(c => c.name || c.course_code);
            renderCoursesList(searchQuery);
          } else {
            coursesList.innerHTML = `
              <div class="empty-state" style="padding: 2rem 1rem;">
                <p style="font-size: 0.85rem; color: var(--danger);">${response?.error || 'Failed to load courses.'}</p>
              </div>
            `;
          }
        });
      });
      return;
    }
    
    let filtered = [...activeCourses];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.course_code && c.course_code.toLowerCase().includes(q))
      );
    }
    
    if (filtered.length === 0) {
      coursesList.innerHTML = `<div class="empty-state" style="padding: 2rem 1rem;"><p style="font-size: 0.85rem;">No courses found.</p></div>`;
      return;
    }
    
    coursesList.innerHTML = filtered.map(course => {
      const code = course.course_code || 'Course';
      const name = course.name || course.course_code || 'Unnamed Course';
      return `
        <div class="hover-card course-item" data-id="${course.id}" data-name="${name}" style="padding: 0.55rem 0.85rem; margin-bottom: 0.4rem; cursor: pointer; display: flex; align-items: center; justify-content: space-between; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.025); transition: all 0.2s;">
          <div style="flex: 1; min-width: 0; text-align: left;">
            <div class="task-course" style="font-size: 0.65rem; margin-bottom: 0.15rem; display: inline-block; background: rgba(255,71,87,0.1); color: var(--accent-primary); padding: 2px 6px; border-radius: 4px;">${code}</div>
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; margin-top: 0.15rem;">${name}</div>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-secondary); opacity: 0.5;"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
      `;
    }).join('');
    
    coursesList.querySelectorAll('.course-item').forEach(item => {
      item.onclick = () => {
        selectedCourseId = item.dataset.id;
        selectedCourseName = item.dataset.name;
        courseAssignments = [];
        switchView('course-assignments');
      };
    });
  };

  const renderCourseAssignmentsList = (searchQuery = '') => {
    if (!courseAssignmentsList) return;
    
    if (courseAssignments.length === 0) {
      courseAssignmentsList.innerHTML = `
        <div class="empty-state" style="padding: 2rem 1rem;">
          <div class="loader"></div>
          <p style="font-size: 0.85rem;">Loading course assessments...</p>
        </div>
      `;
      chrome.storage.local.get(['canvasUrl'], (data) => {
        chrome.runtime.sendMessage({ 
          action: 'getCourseAssignments', 
          baseUrl: data.canvasUrl,
          courseId: selectedCourseId
        }, (response) => {
          if (response && response.assignments && Array.isArray(response.assignments)) {
            courseAssignments = response.assignments.sort((a, b) => {
              if (a.due_at && b.due_at) return new Date(a.due_at) - new Date(b.due_at);
              if (a.due_at) return -1;
              if (b.due_at) return 1;
              return a.title?.localeCompare(b.title || '') || 0;
            });
            renderCourseAssignmentsList(searchQuery);
          } else {
            courseAssignmentsList.innerHTML = `
              <div class="empty-state" style="padding: 2rem 1rem;">
                <p style="font-size: 0.85rem; color: var(--danger);">${response?.error || 'Failed to load assessments.'}</p>
              </div>
            `;
          }
        });
      });
      return;
    }
    
    let filtered = [...courseAssignments];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(a => 
        (a.name && a.name.toLowerCase().includes(q)) || 
        (a.title && a.title.toLowerCase().includes(q))
      );
    }
    
    if (filtered.length === 0) {
      courseAssignmentsList.innerHTML = `<div class="empty-state" style="padding: 2rem 1rem;"><p style="font-size: 0.85rem;">No assessments found.</p></div>`;
      return;
    }
    
    courseAssignmentsList.innerHTML = filtered.map(task => {
      const title = task.name || task.title || 'Untitled Assessment';
      const points = task.points_possible !== undefined && task.points_possible !== null ? `${task.points_possible} pts` : '';
      const date = task.due_at ? new Date(task.due_at) : null;
      let dateStr = 'No Due Date';
      if (date) {
        const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
        const monthDay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
        dateStr = `${weekday}, ${monthDay} at ${time}`;
      }
      
      return `
        <div class="hover-card" style="padding: 0.55rem 0.85rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.025); transition: all 0.2s;">
          <div style="flex: 1; min-width: 0; text-align: left;">
            <div style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;">${title}</div>
            <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem; display: flex; align-items: center; gap: 8px;">
              <span>${dateStr}</span>
              ${points ? `<span style="background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px; font-size: 0.65rem;">${points}</span>` : ''}
            </div>
          </div>
          <button class="assignment-select-btn" data-id="${task.id}" title="Create Task" style="background: var(--accent-primary); border: none; border-radius: 6px; padding: 4px 8px; cursor: pointer; color: white; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; transition: background 0.2s;">
            Select
          </button>
        </div>
      `;
    }).join('');
    
    courseAssignmentsList.querySelectorAll('.assignment-select-btn').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const task = courseAssignments.find(a => a.id == id);
        if (task) {
          resetForm();
          prefilledUrl = task.html_url || null;
          
          newTaskTitle.value = task.name || task.title || '';
          newTaskTitle.disabled = false;
          newTaskCourse.value = selectedCourseName || '';
          newTaskCourse.disabled = false;
          
          if (task.due_at) {
            const date = new Date(task.due_at);
            const tzOffset = date.getTimezoneOffset() * 60000;
            newTaskDate.value = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
          } else {
            newTaskDate.value = '';
          }
          
          newTaskSchedule.value = '';
          
          switchView('add');
          viewTitle.innerText = 'New Task';
          saveTaskBtn.innerText = 'Save Task';
        }
      };
    });
  };

  const renderTasks = () => {
    const allTasks = [...currentCustomTasks, ...currentTasks];
    
    let filtered = [];
    if (currentFilter === 'deadlines') {
      filtered = allTasks.filter(t => t.dueDate && !completedIds.includes(t.id))
                         .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else if (currentFilter === 'unscheduled') {
      filtered = allTasks.filter(t => !t.dueDate && !completedIds.includes(t.id))
                         .sort((a, b) => (a.scheduledDate || '9999') > (b.scheduledDate || '9999'));
    } else if (currentFilter === 'completed') {
      filtered = allTasks.filter(t => completedIds.includes(t.id))
                         .sort((a, b) => {
                           if (a.dueDate && b.dueDate) return new Date(b.dueDate) - new Date(a.dueDate);
                           return a.title.localeCompare(b.title);
                         });
    }

    if (filtered.length === 0) {
      taskList.innerHTML = `<div class="empty-state"><p>No tasks found in this category.</p></div>`;
      return;
    }

    taskList.innerHTML = filtered.map((task, index) => {
      const isCompleted = completedIds.includes(task.id);
      const date = task.dueDate ? new Date(task.dueDate) : null;
      
      let relative = { text: 'Unscheduled', class: 'deadline-later' };
      let timeStr = '';
      
      if (date) {
        relative = getRelativeTime(date);
        timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      }

      const isManual = task.id && task.id.toString().startsWith('manual-');
      const isOverdue = date && date < new Date() && !isCompleted;

      return `
        <div class="task-card ${isCompleted ? 'completed' : ''}" style="animation-delay: ${index * 0.05}s">
          <div class="task-header">
            <div style="display: flex; align-items: center; overflow: hidden; flex: 1; min-width: 0; margin-right: 0.5rem;">
              <button class="complete-btn" data-id="${task.id}"></button>
              <span class="task-course">${task.courseName}</span>
              ${isManual ? `
                <button class="edit-task-btn" data-id="${task.id}" title="Edit Task" style="background: none; border: none; padding: 2px; margin-left: 6px; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; transition: color 0.2s;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                </button>
                <button class="delete-task-btn" data-id="${task.id}" title="Delete Task" style="background: none; border: none; padding: 2px; margin-left: 4px; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; transition: color 0.2s;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
              ` : (isOverdue ? `
                <button class="clone-task-btn" data-id="${task.id}" title="Reschedule Overdue Assignment" style="background: none; border: none; padding: 2px; margin-left: 6px; cursor: pointer; color: var(--text-secondary); display: inline-flex; align-items: center; transition: color 0.2s;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
                </button>
              ` : '')}
            </div>
            <span class="deadline-tag ${relative.class}">
              ${relative.text}
            </span>
          </div>
          ${task.url ? `<a class="task-title" href="${task.url}" target="_blank">${task.title}</a>` : `<div class="task-title no-link">${task.title}</div>`}
          ${task.dueDate ? `
            <div class="task-due-details" style="font-size: 0.75rem; color: var(--text-secondary); display: flex; align-items: center; gap: 4px; margin-top: 4px; opacity: 0.85;">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              <span>${getDetailedDueDate(task.dueDate)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    document.querySelectorAll('.complete-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        completedIds.includes(id) ? (completedIds = completedIds.filter(i => i !== id)) : completedIds.push(id);
        chrome.storage.local.set({ completedTaskIds: completedIds });
        renderTasks();
      };
    });

    document.querySelectorAll('.edit-task-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const task = currentCustomTasks.find(t => t.id === id);
        if (task) {
          editingTaskId = task.id;
          newTaskTitle.value = task.title;
          
          if (task.dueDate) {
            const date = new Date(task.dueDate);
            const tzOffset = date.getTimezoneOffset() * 60000;
            newTaskDate.value = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
          } else {
            newTaskDate.value = '';
          }
          
          newTaskSchedule.value = task.scheduledDate || '';
          newTaskCourse.value = task.courseName || '';
          
          switchView('add');
        }
      };
    });

    document.querySelectorAll('.delete-task-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Delete this task permanently?')) {
          currentCustomTasks = currentCustomTasks.filter(t => t.id !== id);
          chrome.storage.local.set({ customTasks: currentCustomTasks }, () => {
            renderTasks();
          });
        }
      };
    });

    document.querySelectorAll('.clone-task-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        // Loose comparison because Canvas IDs are numeric, custom IDs are strings
        const task = currentTasks.find(t => t.id == id);
        if (task) {
          editingTaskId = null;
          overridingTaskId = task.id;
          
          newTaskTitle.value = task.title;
          newTaskTitle.disabled = true; // Disable title edit for synced Canvas assignments
          newTaskCourse.value = task.courseName || '';
          newTaskCourse.disabled = true; // Disable course edit for synced Canvas assignments
          
          if (task.dueDate) {
            const date = new Date(task.dueDate);
            const tzOffset = date.getTimezoneOffset() * 60000;
            newTaskDate.value = new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
          } else {
            newTaskDate.value = '';
          }
          
          newTaskSchedule.value = '';
          
          switchView('add');
          viewTitle.innerText = 'Reassign Date';
          saveTaskBtn.innerText = 'Reassign Date';
        }
      };
    });
  };

  const loadData = async () => {
    chrome.storage.local.get(['canvasUrl', 'canvasToken', 'customTasks', 'completedTaskIds', 'deadlineOverrides'], (data) => {
      canvasUrlInput.value = data.canvasUrl || '';
      apiTokenInput.value = data.canvasToken || '';
      currentCustomTasks = data.customTasks || [];
      completedIds = data.completedTaskIds || [];
      deadlineOverrides = data.deadlineOverrides || {};
      
      // Show beautiful welcome/setup prompt if URL or Token is missing
      if (!data.canvasUrl || !data.canvasToken) {
        taskList.innerHTML = `
          <div class="empty-state setup-prompt" style="animation: fadeIn 0.4s ease-out; padding: 3rem 1rem;">
            <svg class="setup-icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-primary); margin-bottom: 1.25rem;">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
              <path d="M8 14h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 18h.01"></path>
              <path d="M12 18h.01"></path>
              <path d="M16 18h.01"></path>
            </svg>
            <h3 style="color: var(--text-primary); margin-bottom: 0.5rem; font-size: 1.1rem; font-weight: 600;">Let's Get Started!</h3>
            <p style="font-size: 0.85rem; line-height: 1.5; color: var(--text-secondary); margin-bottom: 1.5rem; max-width: 280px;">
              Connect your Canvas account with a secure API token to sync all your upcoming deadlines and assignments automatically.
            </p>
            <button id="setup-btn" class="primary-btn" style="width: auto; padding: 0.6rem 1.2rem; font-size: 0.85rem; margin-top: 0.5rem;">Configure Settings</button>
          </div>
        `;
        document.getElementById('setup-btn').onclick = () => switchView('settings');
        return;
      }
      
      chrome.runtime.sendMessage({ action: 'getTasks', baseUrl: data.canvasUrl }, (response) => {
        if (response && response.tasks) {
          currentTasks = response.tasks.map(task => {
            if (deadlineOverrides[task.id]) {
              return { ...task, dueDate: deadlineOverrides[task.id] };
            }
            return task;
          });
        } else {
          currentTasks = [];
        }
        renderTasks();
      });
    });
  };

  // Tab Listeners
  tabContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.tab;
      renderTasks();
    };
  });

  settingsBtn.onclick = () => switchView('settings');
  addTaskBtn.onclick = () => {
    resetForm();
    switchView('add-menu');
  };

  // Onboarding Selection Menu Options
  document.getElementById('opt-custom-task').onclick = () => {
    resetForm();
    switchView('add');
  };

  document.getElementById('opt-browse-courses').onclick = () => {
    switchView('browse-courses');
  };

  document.getElementById('opt-browse-canvas').onclick = () => {
    switchView('browse');
  };

  document.getElementById('cancel-menu-btn').onclick = () => {
    switchView('tasks');
  };

  document.getElementById('back-browse-btn').onclick = () => {
    switchView('add-menu');
  };

  backCoursesBtn.onclick = () => {
    switchView('add-menu');
  };

  backCourseAssignmentsBtn.onclick = () => {
    switchView('browse-courses');
  };

  // Real-time Search Inputs
  document.getElementById('assignment-search').oninput = (e) => {
    renderBrowseList(e.target.value);
  };

  courseSearch.oninput = (e) => {
    renderCoursesList(e.target.value);
  };

  courseAssignmentSearch.oninput = (e) => {
    renderCourseAssignmentsList(e.target.value);
  };

  document.getElementById('back-to-tasks-btn').onclick = () => {
    resetForm();
    switchView('tasks');
  };
  document.getElementById('cancel-add-btn').onclick = () => {
    resetForm();
    switchView('tasks');
  };

  saveSettingsBtn.onclick = () => {
    let url = canvasUrlInput.value.trim();
    if (url) {
      // Auto-format: Prepend https:// if protocol is missing
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      // Remove trailing slashes
      url = url.replace(/\/+$/, '');
      canvasUrlInput.value = url;
    }

    chrome.storage.local.set({ canvasUrl: url, canvasToken: apiTokenInput.value.trim() }, () => {
      switchView('tasks');
      loadData();
    });
  };

  saveTaskBtn.onclick = () => {
    if (overridingTaskId) {
      // Direct Deadline Override Mode
      const newDueDateStr = newTaskDate.value ? new Date(newTaskDate.value).toISOString() : null;
      if (newDueDateStr) {
        deadlineOverrides[overridingTaskId] = newDueDateStr;
      } else {
        delete deadlineOverrides[overridingTaskId]; // Remove override to reset to original professor date
      }

      chrome.storage.local.set({ deadlineOverrides }, () => {
        resetForm();
        switchView('tasks');
        loadData();
      });
      return;
    }

    const title = newTaskTitle.value.trim();
    if (!title) return alert('Enter a title');
    
    const dueDate = newTaskDate.value ? new Date(newTaskDate.value).toISOString() : null;
    const scheduledDate = newTaskSchedule.value || null;
    const courseName = newTaskCourse.value.trim() || 'Manual';

    if (editingTaskId) {
      currentCustomTasks = currentCustomTasks.map(t => {
        if (t.id === editingTaskId) {
          return { ...t, title, dueDate, scheduledDate, courseName };
        }
        return t;
      });
    } else {
      const newTask = {
        id: 'manual-' + Date.now(),
        title,
        dueDate,
        scheduledDate,
        courseName,
        url: prefilledUrl || null
      };
      currentCustomTasks.push(newTask);
    }

    chrome.storage.local.set({ 
      customTasks: currentCustomTasks
    }, () => {
      resetForm();
      switchView('tasks');
      loadData();
    });
  };

  loadData();
});
