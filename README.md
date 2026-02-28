# Auto AQC Session Initialiser (Chrome Extension)

This script is part of a Chrome Extension that automates the initiation of AQC sessions on Duplo's Technical Evaluation Tasks webpage. It repeatedly scans claimed jobs that are in the **Ready** state and assigned to the current user, then automatically triggers the **“Initiate AQC Session”** action.

The automation can be started and stopped by the user via extension UI buttons.

---

## Features

- Automatically filters jobs to Ready status

- Verifies jobs are assigned to the logged-in user

- Initiates AQC sessions sequentially

- Continuously processes jobs until:
  - No valid jobs remain, or
  - The user manually stops the process

- Safe stop mechanism using Chrome runtime messaging

- Built-in timeouts and error handling to prevent infinite waits

---

## How It Works

##### Extension UI

The script is triggered by two buttons in the extension popup:

- Start ```(auto-start-btn)```
  - Injects and runs the automation script in the active tab

- Stop ```(auto-stop-btn)```
  - Sends a stop signal to halt the automation loop safely

---

## Automation Flow

- Start button clicked

- Script is injected into the active browser tab

- The script:
  - Detects the logged-in username
  - Switches to the **Claimed** tab
  - Filters tasks to **Ready**
  - 
- For each job found:
  - Extracts job metadata
  - Verifies:
    - Status is **Ready**
    - Assignee matches the current user

  - Opens the action menu
  - Clicks **“Initiate AQC Session”**

- Loop continues until:
  - No valid jobs are found
  - A validation check fails
  - User clicks Stop

---

## Limitations & Notes

- The script relies on exact DOM selectors. UI changes may break functionality.

---

## Live Preview

- Live Preview: https://mjcw88.github.io/auto-initialiser/