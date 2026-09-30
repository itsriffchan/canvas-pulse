/**
 * Canvas Pulse Content Script 3.0
 */

(function() {
  const baseUrl = window.location.origin;
  const isHomePage = window.location.pathname === '/' || 
                     window.location.pathname.startsWith('/dashboard') || 
                     /^\/courses\/\d+\/?$/i.test(window.location.pathname);

  function isDarkModeActive() {
    const html = document.documentElement;
    const body = document.body;

    // Check Dark Reader or theme attributes
    if (html.hasAttribute('data-darkreader-scheme') || 
        html.getAttribute('data-darkreader-mode') ||
        html.getAttribute('data-theme') === 'dark' ||
        body?.getAttribute('data-theme') === 'dark') {
      return true;
    }

    // Check common dark mode classes
    if (html.classList.contains('dark') || 
        html.classList.contains('dark-mode') || 
        body?.classList.contains('dark') || 
        body?.classList.contains('dark-mode') || 
        body?.classList.contains('canvas-dark-mode') ||
        body?.classList.contains('ic-theme-dark')) {
      return true;
    }

    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return true;
    }

    // Check computed background lightness of body / sidebar / container
    try {
      const target = document.getElementById('right-side') || body || html;
      if (target) {
        const bg = window.getComputedStyle(target).backgroundColor;
        const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
          const r = parseInt(match[1], 10);
          const g = parseInt(match[2], 10);
          const b = parseInt(match[3], 10);
          // Perceived luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum < 140) return true;
        }
      }
    } catch (e) {}

    return false;
  }

  function updateWidgetTheme(widget) {
    if (!widget) widget = document.getElementById('better-canvas-sidebar-widget');
    if (!widget) return;
    if (isDarkModeActive()) {
      widget.classList.add('dark-theme');
    } else {
      widget.classList.remove('dark-theme');
    }
  }

  function init() {
    if (!isHomePage) return;

    // Observe changes for sidebar injection, native todo hiding, and theme changes
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById('right-side');
      if (sidebar) {
        injectIntoSidebar();
      }
      updateWidgetTheme();
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true, 
      attributes: true, 
      attributeFilter: ['class', 'data-theme', 'style', 'data-darkreader-scheme'] 
    });

    // Listen for system theme changes
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        updateWidgetTheme();
      });
    }

    // Initial check
    if (document.getElementById('right-side')) injectIntoSidebar();
  }

  // 2. Inject into Sidebar (Right side)
  function injectIntoSidebar() {
    const sidebar = document.getElementById('right-side');
    if (!sidebar) return;

    // Hide original elements and keep them hidden
    const originalTodo = sidebar.querySelectorAll('.todo-list-container, .coming_up, .recent_feedback, .todo-list-header, .coming_up_header');
    originalTodo.forEach(el => {
      if (el.style.display !== 'none') el.style.display = 'none';
    });

    let widget = document.getElementById('better-canvas-sidebar-widget');
    if (widget) {
      if (sidebar.firstChild !== widget) sidebar.prepend(widget); // Keep at top
      updateWidgetTheme(widget);
      return;
    }

    widget = document.createElement('div');
    widget.id = 'better-canvas-sidebar-widget';
    widget.className = 'sidebar-widget-integrated';
    updateWidgetTheme(widget);

    widget.innerHTML = `
      <h2 class="sidebar-header-integrated">To Do</h2>
      <div id="better-canvas-sidebar-list" class="task-container-integrated">
        <p class="task-loading-integrated">Loading your tasks...</p>
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
        container.innerHTML = `<p class="task-error-integrated">Error: ${response.error}</p>`;
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
          
          if (date) {
            relative = getRelativeTime(date);
          }

          return `
            <div class="task-card-integrated ${isDone ? 'completed' : ''}" style="animation-delay: ${index * 0.03}s">
               <div class="task-row">
                 <button class="complete-btn-integrated" data-id="${task.id}" title="Mark as complete"></button>
                 <div class="task-info">
                    ${task.url ? `<a class="task-title-integrated" href="${task.url}" target="_blank">${task.title}</a>` : `<div class="task-title-integrated no-link">${task.title}</div>`}
                    ${task.courseName ? `<div class="course-name-integrated">${task.courseName}</div>` : ''}
                    <div class="task-meta-integrated">
                      ${task.dueDate ? `
                        <div class="task-due-details-integrated">
                          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="calendar-icon-integrated"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                          <span>${getDetailedDueDate(task.dueDate)}</span>
                        </div>
                      ` : '<div></div>'}
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
        container.innerHTML = '<p class="task-empty-integrated">No upcoming tasks.</p>';
      }

      updateWidgetTheme();
    });
  }

  init();
})();

