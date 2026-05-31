# Canvas Pulse

A Chrome extension that brings your Canvas deadlines and tasks to your fingertips—no need to visit the Canvas site and works even when your Canvas login has expired.

## Features

✨ **Check Deadlines & Tasks Without Leaving Your Browser** - View all your upcoming Canvas assignments, due dates, and custom tasks from the extension popup without navigating to Canvas.

🔐 **Token-Based Authentication** - Works independently of your Canvas session. As long as you have a valid API token, you can access your tasks even if your Canvas login has expired.

⚡ **Real-Time Task Management** - Add custom tasks, manage deadlines, and track completion status all from the extension.

📊 **Course & Assignment Browsing** - Browse your Canvas courses and assignments directly from the extension to quickly add tasks.

🎯 **Smart Task Filtering** - Filter tasks by "All Tasks," "Deadlines," and "Custom Tasks" to stay organized.

## Installation

### From Release (Zip File) - Easiest

1. **Download the latest release** from the [Releases page](https://github.com/itsriffchan/canvas-pulse/releases)

2. **Extract the zip file** to a folder on your computer

3. **Open Chrome** and navigate to `chrome://extensions/`

4. **Enable Developer Mode** - Toggle the switch in the top right corner.

5. **Click "Load unpacked"** and select the extracted folder.

6. The extension should now appear in your Chrome toolbar. Click the icon to open Canvas Pulse.

### From Source (Development)

1. **Clone or download** this repository to your local machine.

2. **Open Chrome** and navigate to `chrome://extensions/`

3. **Enable Developer Mode** - Toggle the switch in the top right corner.

4. **Click "Load unpacked"** and select the folder containing the extension files.

5. The extension should now appear in your Chrome toolbar. Click the icon to open Canvas Pulse.


## Setup & Configuration

### Adding Your Canvas Token

1. **Open Canvas Pulse** by clicking the extension icon in your toolbar.

2. **Click the ⚙️ Settings button** (bottom right of the popup).

3. **Enter your Canvas Base URL**
   - Example: `https://canvas.example.com` or `https://mycanvasinstance.instructure.com`

4. **Generate a Canvas API Token**
   - Go to your Canvas instance
   - Click **Account** → **Settings**
   - Scroll to **Approved Integrations**
   - Click **"+ New Access Token"**
   - Give it a name (e.g., "Canvas Pulse")
   - Leave the expiration date blank or set it far in the future
   - Click **Create Token** and copy the generated token

5. **Paste the token** into the **API Token** field in Canvas Pulse settings.

6. **Click "Save Settings"** - Your configuration is now saved locally in Chrome.

## How to Use

### View Your Tasks

- **Open the extension** to see all your upcoming deadlines and custom tasks
- **Filter by "Deadlines"** to see Canvas assignments
- **Filter by "Custom Tasks"** to see tasks you've added manually

### Add a Custom Task

1. Click the **"+ Add Task"** button
2. Choose between:
   - **Add Custom Task** - Create a task with a custom title and due date
   - **Browse Canvas** - Browse your Canvas courses and assignments to add them as tasks
3. Fill in the task details and click **Save**

### Browse Canvas Courses & Assignments

1. Click **"+ Add Task"**
2. Select **"Browse Canvas"**
3. Search and select a course
4. View assignments and add them as tasks to Canvas Pulse

### Manage Tasks

- **Mark complete** - Click the checkbox next to a task
- **Edit deadline** - Click the reassign icon to change a task's due date
- **Delete** - Click the delete icon to remove a task

## Privacy & Security

- All your data (tasks, settings, token) is stored **locally** in your browser using Chrome's storage API
- Your Canvas API token is **never sent** anywhere except directly to your Canvas instance
- Canvas Pulse does **not** collect, store, or transmit any of your personal data to external servers

## Troubleshooting

**"Unauthorized: Please check your API token"**
- Verify your Canvas Base URL is correct
- Regenerate your API token and try again

**"Canvas has temporarily disabled Free-for-Teacher Access"**
- This is a Canvas-side issue. Check the [Instructure status page](http://www.instructure.com/incident_update)

**Tasks are not loading**
- Ensure your Canvas Base URL is correct (include `https://`)
- Check that your API token is valid and hasn't expired
- Refresh the extension or browser

## Requirements

- Chrome/Chromium browser (v88 or later)
- Active Canvas account with API token access
- Internet connection

## License

This project is open source. Feel free to modify and use it as needed.

## Contributing

Found a bug or have a feature request? Feel free to open an issue or submit a pull request!
