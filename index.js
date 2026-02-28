const startBtn = document.getElementById("auto-start-btn");
const stopBtn = document.getElementById("auto-stop-btn");

startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);

async function start() {
    chrome.runtime.sendMessage({ resetStop: true }, async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },

            func: async () => {
                const mainBody = document.querySelector("body > woms-root > div > div > main > woms-technical-eval");
                const claimedTab = document.querySelector("[attr-e2e='claimed']");
                const refineBtn = document.querySelector("[attr-e2e$='_refine']");
                const username = document.querySelector("[attr-e2e='user_menu_user'] strong")?.textContent.trim();
                const email = document.querySelector('[attr-e2e="user_menu_user"] .user-data span')?.textContent.trim();

                const REFRESH = 100;
                const TIMEOUT = 10000;

                // Helper functions
                const waitForElement = (parent, child) => {
                    return new Promise((resolve, reject) => {
                        const interval = setInterval(() => {
                            const element = parent.querySelector(child);
                            if (element) {
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

                const isStopBtnClicked = async () => {
                    return new Promise((resolve) => {
                        chrome.runtime.sendMessage({ checkStop: true }, (response) => {
                            resolve(response.stopflag);
                        });
                    });
                };

                async function iterateTaskStatusMenu() {
                    const taskStatusMenu = await waitForElement(document, "[attr-e2e='task_status_options']");
                    const taskStatusMenuItems = taskStatusMenu.querySelectorAll("li");
                                        
                    taskStatusMenuItems.forEach(item => {
                        const title = item.getAttribute("title") || item.textContent.trim();
                        const selected = item.classList.contains("--selected");

                        if (selected !== (title === "Ready")) {
                            item.click();
                        }
                    });
                };

                async function iterateAssignedTo() {
                    const assignedToMenu = await waitForElement(document, "[attr-e2e='assigned_to_options']");
                    const assignedToMenuItems = assignedToMenu.querySelectorAll("li");

                    for (const item of assignedToMenuItems) {
                        const title = item.getAttribute("title") || item.textContent.trim();

                        if (title.toLowerCase().includes(email.toLowerCase())) {
                            item.click();
                            break;
                        }
                    }
                };

                async function isJobs(mainBody) {
                    const jobsTable = await waitForElement(mainBody, "section > woms-table > div > div.woms-table-grid.dsc-table-grid > ag-grid-angular > div > div.ag-root-wrapper-body.ag-layout-auto-height.ag-focus-managed > div.ag-root.ag-unselectable.ag-layout-auto-height");
                    if (jobsTable) {
                        return true;
                    }
                    return false;
                };

                async function initialiseJobs(mainBody, claimedTab, username) {
                    let taskStatus, assignee;
                    
                    if (!claimedTab.classList.contains("--selected")) {
                        console.error("Auto Initialiser Error: Claimed tab deselected");
                        return false;
                    }

                    await iterateTaskStatusMenu();
                    await iterateAssignedTo();

                    const columnsReset = await waitForElement(mainBody, `section > woms-table > div > dsc-pagination > div > div.dsc-pagination-section.--right > i`);
                    columnsReset.click();

                    const rowBaseSelector = "section > woms-table > div > div.woms-table-grid.dsc-table-grid > ag-grid-angular > div > div.ag-root-wrapper-body.ag-layout-auto-height.ag-focus-managed > div.ag-root.ag-unselectable.ag-layout-auto-height > div.ag-body-viewport.ag-selectable.ag-layout-auto-height.ag-row-no-animation";

                    let row;
                    try {
                        row = await waitForElement(mainBody, `${rowBaseSelector} > div.ag-center-cols-clipper > div > div > div`);
                    } catch (error) {
                        console.error("Auto Initialiser Error: Job list not found");
                        return false;
                    }

                    const columns = ["taskStatus", "assignee"];
                    await Promise.all(
                        columns.map(colId => waitForElement(row, `[col-id="${colId}"]:not(:empty)`))
                    );

                    [...row.children].forEach(column => {
                        const colId = column.getAttribute("col-id");
                        const text = column.textContent.trim();

                        switch (colId) {
                            case "taskStatus":
                                taskStatus = text;
                                break;
                            case "assignee":
                                assignee = text;
                                break;
                        }
                    });

                    if (taskStatus !== "Ready") {
                        console.error(`Auto Initialiser Error: status mismatch\nAccepted status: Ready\nStatus found: ${taskStatus}`);
                        return false;
                    }

                    if (assignee !== username) {
                        console.error(`Auto Initialiser Error: user mismatch\nAccepted user: ${username}\nAssigned: ${assignee}`);
                        return false;
                    }

                    const actionButton = await waitForElement(mainBody, `${rowBaseSelector} > div.ag-pinned-right-cols-container > div > div > div > span > woms-action-menu-cell > div > dsc-action-menu > div > div > i`);
                    actionButton.click();

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

                // Main script
                try {
                    claimedTab.click();
                    await iterateTaskStatusMenu();
                    await iterateAssignedTo();
                    refineBtn.click();

                    while (await isJobs(mainBody)) {
                        const shouldContinue = await initialiseJobs(mainBody, claimedTab, username);

                        if (!shouldContinue) {
                            break;
                        }

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