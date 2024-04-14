//
// popup.js - Code for the Obsidian Clipper add-on for Thunderbird to save a selected mail message .
//

///////////////////////
// Main execution path
///////////////////////

// Get the active tab in the current window using the tabs API.
let tabs = await messenger.tabs.query({ active: true, currentWindow: true });

// User has hit the button - request a clip of the message via "cliprequest" command.
let messageResponse = await browser.runtime.sendMessage({
    command: "cliprequest",
    tabId: tabs[0].id
});

const {command} = messageResponse; // Ignore message response...

