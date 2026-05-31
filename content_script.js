/**
 * Canvas Pulse Content Script 3.0
 */

(function() {
  const baseUrl = window.location.origin;
  const isHomePage = window.location.pathname === '/' || 
                     window.location.pathname.startsWith('/dashboard') || 
                     /^\/courses\/\d+\/?$/i.test(window.location.pathname);

  function init() {
    if (!isHomePage) return;

    // Wait for Canvas elements to load
    const observer = new MutationObserver((mutations, obs) => {
      const sidebar = document.getElementById('right-side');
      
      if (sidebar) {
        injectIntoSidebar();
        // Keep observing to ensure it stays there if Canvas re-renders the sidebar
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check
    if (document.getElementById('right-side')) injectIntoSidebar();
  }

  // 2. Inject into Sidebar (Right side)
  function injectIntoSidebar() {
    if (document.getElementById('better-canvas-sidebar-widget')) {
      const widget = document.getElementById('better-canvas-sidebar-widget');
      const sidebar = document.getElementById('right-side');
      if (sidebar.firstChild !== widget) sidebar.prepend(widget); // Keep at top
      return;
    }
    const sidebar = document.getElementById('right-side');
    if (!sidebar) return;

    // Hide original elements
    const originalTodo = sidebar.querySelectorAll('.todo-list-container, .coming_up, .recent_feedback, .todo-list-header, .coming_up_header');
    originalTodo.forEach(el => el.style.display = 'none');

    const widget = document.createElement('div');
    widget.id = 'better-canvas-sidebar-widget';
    widget.className = 'sidebar-widget-integrated';
    widget.innerHTML = `
      <h2 class="sidebar-header-integrated">To Do</h2>
      <div id="better-canvas-sidebar-list" class="task-container-integrated">
        <p style="padding: 1rem; color: #94a3b8; font-size: 0.8rem;">Loading your tasks...</p>
      </div>
    `;

    sidebar.prepend(widget);
    fetchAndRender('better-canvas-sidebar-list', 'all');
  }

  function getRelativeTime(date) {
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) return { text: 'Overdue', class: 'deadline-urgent' };
    if (diffMins < 60) return { text: `in ${diffMins} mins`, class: 'deadline-urgent' };
    if (diffHours < 24) return { text: `in ${diffHours} hours`, class: 'deadline-urgent' };
    if (diffDays < 3) return { text: `in ${diffDays} days`, class: 'deadline-soon' };
    if (diffDays < 7) return { text: `in ${diffDays} days`, class: 'deadline-later' };
    return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), class: 'deadline-later' };
  }

  function getDetailedDueDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const monthDay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `${weekday}, ${monthDay} at ${time}`;
  }

  function fetchAndRender(containerId, filter = 'all') {
    chrome.runtime.sendMessage({ action: 'getTasks', baseUrl }, (response) => {
      const container = document.getElementById(containerId);
      if (!container) return;

      if (response.error) {
        container.innerHTML = `<p style="padding: 1rem; color: #ef4444; font-size: 0.8rem;">Error: ${response.error}</p>`;
        return;
      }

      const { tasks, customTasks, completedIds = [] } = response;
      const allTasks = [...(tasks || []), ...(customTasks || [])];
      
      const sorted = allTasks.sort((a, b) => {
        if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.title.localeCompare(b.title);
      });

      if (sorted.length > 0) {
        container.innerHTML = sorted.map((task, index) => {
          const isDone = completedIds.includes(task.id);
          const date = task.dueDate ? new Date(task.dueDate) : null;
          
          let relative = { text: 'No Deadline', class: 'deadline-later' };
          let timeStr = '';
          
          if (date) {
            relative = getRelativeTime(date);
            timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
          }

          return `
            <div class="task-card-integrated ${isDone ? 'completed' : ''}" style="animation-delay: ${index * 0.03}s">
               <div class="task-row">
                 <button class="complete-btn-integrated" data-id="${task.id}" title="Mark as complete"></button>
                 <div class="task-info">
                    ${task.url ? `<a class="task-title-integrated" href="${task.url}" target="_blank">${task.title}</a>` : `<div class="task-title-integrated no-link">${task.title}</div>`}
                    ${task.dueDate ? `
                      <div class="task-due-details-integrated" style="font-size: 0.7rem; color: #697783; display: flex; align-items: center; gap: 4px; margin-top: 4px; font-weight: 500; opacity: 0.9;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; opacity: 0.7;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${getDetailedDueDate(task.dueDate)}</span>
                      </div>
                    ` : ''}
                    <div class="task-meta-integrated">
                      <span class="course-name-integrated">${task.courseName}</span>
                      <span class="deadline-tag-integrated ${relative.class}">
                        ${relative.text}
                      </span>
                    </div>
                  </div>
                </div>
             </div>
          `;
        }).join('');

        // Event Listeners
        container.querySelectorAll('.complete-btn-integrated').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            chrome.storage.local.get(['completedTaskIds'], (data) => {
              let ids = data.completedTaskIds || [];
              ids.includes(id) ? (ids = ids.filter(i => i !== id)) : ids.push(id);
              chrome.storage.local.set({ completedTaskIds: ids }, () => {
                fetchAndRender(containerId, filter);
              });
            });
          };
        });

      } else {
        container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #94a3b8; font-size: 0.85rem;">No upcoming tasks.</p>';
      }
    });
  }

  init();
})();

