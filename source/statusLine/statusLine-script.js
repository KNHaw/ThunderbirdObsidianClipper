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
// statusLine-script.js - create a status line DIV in a message display script 
// with a known ID ("status-line-text"). Invoke this by injecting the fileCreatedDate
// into a tab on reciept of an onMessageDisplayed event. Then change the
// element's innerText attribute.
//
///////////////////////////////////////////////////////////////////////////////


// Function to create (if needed) and post to a status line element.
function createStatusLine() {
    var statusLineText = document.getElementById("status-line-text");
    
    // Does the status line text element already exist?
    if(undefined == statusLineText) {
        // No. Create the statusLine element itself
        const statusLine = document.createElement("div");
        statusLine.className = "statusLine";
        statusLine.id = "status-line";
        
        // Create the statusLine text element
        statusLineText = document.createElement("div");
        statusLineText.className = "statusLine_Text";
        statusLineText.id = "status-line-text";
        
        // Insert new elements as the very first element in the message
        statusLine.appendChild(statusLineText);
        document.body.insertBefore(statusLine, document.body.firstChild);
    }
}


////////////////////////
// Main execution path
////////////////////////

createStatusLine();
