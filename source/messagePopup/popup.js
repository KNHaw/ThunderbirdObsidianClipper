///////////////////////////////////////////////////////////////////////////////
//
// Code for the Thunderbird add-on Obsidian Clipper.
//
// ObsidianClipper is an add-on for the Thunderbird email client that lets a 
// user clip messages to the Obsidian notetaking application. Both 
// applications are open source and free to use, just like this add-on!
//
// Project hosted at https://github.com/KNHaw/ThunderbirdObsidianClipper
//
// Code written by Kevin Haw. http://www.KevinHaw.com
//
// Released under the Mozilla Public Licence. 
// See https://github.com/KNHaw/ThunderbirdObsidianClipper/blob/main/LICENSE
//
// popup.js - Code for the Obsidian Clipper add-on for Thunderbird 
// to save a selected mail message .
//
///////////////////////////////////////////////////////////////////////////////

// Main execution path

// Get the active tab in the current window using the tabs API.
let tabs = await messenger.tabs.query({ active: true, currentWindow: true });

// User has hit the button - request a clip of the message via "cliprequest" command.
let messageResponse = await browser.runtime.sendMessage({
    command: "cliprequest",
    tabId: tabs[0].id
});

const {command} = messageResponse; // Ignore message response...

