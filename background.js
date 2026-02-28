let stopflag = false;

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.stopRequested !== undefined) {
        stopflag = true;
        sendResponse({ success: true });
    } else if (message.resetStop) {
        stopflag = false;
        sendResponse({ success: true });
    }  else if (message.checkStop) {
        sendResponse({ stopflag });
    } 
    return true;
});
