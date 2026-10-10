const startBtn = document.querySelector('[data-autoBtn="auto-start-btn"]');
const stopBtn = document.querySelector('[data-autoBtn="auto-stop-btn"]');

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);

async function start() {
    // Reset the stop flag before starting, then query the active tab
    chrome.runtime.sendMessage({ resetStop: true }, async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },

            func: async () => {
                const mainBody = document.querySelector("body > woms-root > div > div > main > woms-technical-eval");
                const claimedTab = document.querySelector("[attr-e2e='claimed']");
                const refineBtn = document.querySelector("[attr-e2e$='_refine']");
                const username = document.querySelector('#fndi-left-nav fis-fc-avatar')?.shadowRoot?.querySelector('.username')?.textContent.trim();

                const REFRESH = 100;
                const TIMEOUT = 300000;

                // Polls the DOM until a child element appears inside a parent, or times out
                const waitForElement = (parent, child, validate = null) => {
                    return new Promise((resolve, reject) => {
                        const interval = setInterval(() => {
                            const element = parent.querySelector(child);
                            if (element && (!validate || validate(element))) {
                                clearInterval(interval);
                                resolve(element);
                            }
                        }, REFRESH);
                        setTimeout(() => {
                            clearInterval(interval);
                            reject(new Error(`Timeout while waiting for element: ${child}`));
                        }, TIMEOUT);
                    });
                };
                                
                // Checks with the background script whether the stop button has been clicked
                const isStopBtnClicked = async () => {
                    return new Promise((resolve) => {
                        chrome.runtime.sendMessage({ checkStop: true }, (response) => {
                            resolve(response.stopflag);
                        });
                    });
                };

                // Opens the task status dropdown and ensures only "Ready" is selected
                async function iterateTaskStatusMenu() {
                    const taskStatusMenu = await waitForElement(document, "[attr-e2e='task_status_options']");
                    const taskStatusMenuItems = taskStatusMenu.querySelectorAll("li");
                                        
                    taskStatusMenuItems.forEach(item => {
                        const title = item.getAttribute("title") || item.textContent.trim();
                        const selected = item.classList.contains("--selected");

                        // Click the item if its selection state doesn't match whether it's "Ready"
                        if (selected !== (title === "Ready")) {
                            item.click();
                        }
                    });
                };

                // Opens the "Assigned To" dropdown and selects the item matching the current user's email
                async function iterateAssignedTo() {
                    const assignedToMenu = await waitForElement(document, "[attr-e2e='assigned_to_options']");
                    const assignedToMenuItems = assignedToMenu.querySelectorAll("li");

                    for (const item of assignedToMenuItems) {
                        const title = item.getAttribute("title") || item.textContent.trim();

                        if (title.toLowerCase().includes(username.toLowerCase())) {
                            item.click();
                            break;
                        }
                    }
                };

                // Returns true if the jobs table is present and loaded in the main body
                async function isJobs(mainBody) {
                    const jobsTable = await waitForElement(mainBody, "section > woms-table > div > div.woms-table-grid.dsc-table-grid > ag-grid-angular > div > div.ag-root-wrapper-body.ag-layout-auto-height.ag-focus-managed > div.ag-root.ag-unselectable.ag-layout-auto-height");
                    if (jobsTable) {
                        return true;
                    }
                    return false;
                };

                // Processes the first job row: validates its status and assignee, then clicks through to initiate an AQC session
                async function initialiseJobs(mainBody, claimedTab, username) {
                    // Bail out early if the "Claimed" tab is no longer selected
                    if (!claimedTab.classList.contains("--selected")) {
                        console.error("Auto Initialiser Error: Claimed tab deselected");
                        return false;
                    }

                    // Apply filters before reading job data
                    await iterateTaskStatusMenu();
                    await iterateAssignedTo();

                    // Reset column layout via the pagination reset icon
                    const columnsReset = await waitForElement(mainBody, `section > woms-table > div > dsc-pagination > div > div.dsc-pagination-section.--right > i`);
                    columnsReset.click();

                    const rowBaseSelector = "section > woms-table > div > div.woms-table-grid.dsc-table-grid > ag-grid-angular > div > div.ag-root-wrapper-body.ag-layout-auto-height.ag-focus-managed > div.ag-root.ag-unselectable.ag-layout-auto-height > div.ag-body-viewport.ag-selectable.ag-layout-auto-height.ag-row-no-animation";

                    // Wait for the first row to appear in the grid
                    try {
                        await waitForElement(mainBody, `${rowBaseSelector} > div.ag-center-cols-clipper > div > div > div`);
                    } catch (error) {
                        console.error("Auto Initialiser Error: Job list not found");
                        return false;
                    }

                    // Wait for the status and assignee columns to be populated before reading them
                    const rowCellSelector = `${rowBaseSelector} > div.ag-center-cols-clipper > div > div > div > [col-id`;

                    const [taskStatusEl, assigneeEl] = await Promise.all([
                        waitForElement(mainBody, `${rowCellSelector}="taskStatus"]`, el => el.textContent.trim().length > 0),
                        waitForElement(mainBody, `${rowCellSelector}="assignee"]`, el => el.textContent.trim().length > 0)
                    ]);

                    const taskStatus = taskStatusEl.textContent.trim();
                    const assignee = assigneeEl.textContent.trim();

                    // Validate that the job is in the expected "Ready" state
                    if (taskStatus !== "Ready") {
                        console.error(`Auto Initialiser Error: status mismatch\nAccepted status: Ready\nStatus found: ${taskStatus}`);
                        return false;
                    }

                    // Validate that the job is assigned to the current user
                    if (assignee !== username) {
                        console.error(`Auto Initialiser Error: user mismatch\nAccepted user: ${username}\nAssigned: ${assignee}`);
                        return false;
                    }

                    // Open the action menu for the first row
                    const actionButton = await waitForElement(mainBody, `${rowBaseSelector} > div.ag-pinned-right-cols-container > div > div > div > span > woms-action-menu-cell > div > dsc-action-menu > div > div > i`);
                    actionButton.click();

                    // Find and click the "Initiate AQC Session" option in the dropdown menu
                    const actionsMenu = await waitForElement(document, "body > div > div > ul");
                    const initiateBtn = [...actionsMenu.querySelectorAll("li > span")]
                        .find(span => span.textContent.trim() === "Initiate AQC Session");

                    if (initiateBtn) {
                        initiateBtn.click();
                    } else {
                        console.error("Auto Initialiser Error: Initiate AQC Session button not found");
                        return false;
                    }
                    
                    return true;
                };

                // Main script — sets up filters and loops through jobs until none remain or the user stops it
                try {
                    claimedTab.click();
                    await iterateTaskStatusMenu();
                    await iterateAssignedTo();
                    refineBtn.click(); 

                    // Keep processing jobs as long as there are rows in the table
                    while (await isJobs(mainBody)) {
                        const shouldContinue = await initialiseJobs(mainBody, claimedTab, username);

                        // Stop if initialiseJobs encountered an error or validation failure
                        if (!shouldContinue) {
                            break;
                        }

                        // Stop if the user clicked the stop button
                        if (await isStopBtnClicked()) {
                            console.log("Initiate AQC Sessions stopped by user");
                            break;
                        }
                    }
                } catch (error) {
                    console.error("Auto Initialiser Error:", error);
                };
            },
        });
    });
};

// Sends a stop request to the background script via the content script
function stop() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                chrome.runtime.sendMessage({ stopRequested: true }); // Notify background script that stop is requested
            }
        });
    });
};