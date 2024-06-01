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
// Background.js - Main execution path
//
///////////////////////////////////////////////////////////////////////////////


console.log("DEBUG - background.js is running!!!");

// Global constants
const STATUSLINE_PERSIST_MS = 10000;    // Delete status line messgaes after indicated time

// Global, persistant variables.
var latestMsgDispTab;       // Latest tab recorded on an incoming onMessageDisplay event. Used for later reference.

// Table used to substitute reserved characters with Unicode equivilents
    const unicodeSubs = {
        '|':        '\u2223',   // Mathamatical OR operator U+2223
        '/':        '\u29F8',   // Big solidus U+29F8
        '\u005c':   '\u29F9',   // Big reverse solidus U+29F9
        '"':        '\u201C',   // Curved opening quote U+201C
        '<':        '\u02C2',   // Unicode less than U+02C2
        '>':        '\u02C3',   // Unicode greater than U+02C2
        '*':        '\u2217',   // Asterisk operator U+2217 
        ':':        '\uA789',   // Letter colon U+A789
        '?':        '\u0294',   // Glottal stop U+0294
        '[':        '\uFF3B',   // U+FF3B Fullwidth Left Square Bracket 
        ']':        '\uFF3D',   // U+FF3D Fullwidth Right Square Bracket 
        '^':        '\uFF3E',   // U+FF3E Fullwidth Caret
        '#':        '\uFF03',   // U+FF03 Fullwidth Number Sign 
        '{':        '\uFF5B',   // U+FF5B Fullwidth Left Curly Bracket
        '}':        '\uFF5D',   // U+FF5D Fullwidth Right Curly Bracket
        '~':        '\uFF5E',   // U+FF5E Fullwidth Tilde
        '`':        '\uFF40',   // U+FF40 Fullwidth Backtick
        '@':        '\uFF20',   // U+FF20 Fullwidth Commercial At
        '=':        '\uFF1D',   // U+FF1D Fullwidth Equals Sign
        ';':        '\uFF1B',   // U+FF1B Fullwidth Semicolon
        '+':        '\uFF0B',   // U+FF0B Fullwidth Plus Sign
        '\'':       '\uFF07',   // U+FF07 Fullwidth Apostrophe
        '%':        '\uFF05',   // U+FF05 Fullwidth Percent Sign
        '&':        '\uFF06',   // U+FF06 Fullwidth Amperstand
        '!':        '\uFF01',   // U+FF01 Fullwidth Exclamation Mark
        '(':        '\uFF08',   // U+FF08 Fullwidth Left Parenthesis
        ')':        '\uFF09',   // U+FF09 Fullwidth Right Parenthesis
    };
    

///////////////////////////
// Utility functions
///////////////////////////

// Generic error handler
function onError(error) {
  console.log("popup.js: " + error);
}

// Function to post an alert to the user
async function displayAlert(messageString) {
    const onelinecommand = 'alert(' + '"' + messageString + '");';
    return browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
}


// Function to post an confirmation dialog to the user.
// Returns true if user selected OK and false on CANCEL.
async function displayConfirm(messageString) {
    const onelinecommand = 'confirm(' + '"' + messageString + '");';
    
    // Run the confirmation dialog.
    retval = await browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
    
    // Return the response
    return retval[0];
}


// Function to display clip status
async function displayStatusText(messageString) {
    // First, inject script to create a DIV text element in the message content tab
    // where we can post text.
    await browser.tabs.executeScript(latestMsgDispTab, {
      file: "/statusLine/statusLine-script.js"
    })
    
    // Post the text to the innerText of the created DIV.
    const onelinecommand = 'document.getElementById("status-line-text").innerText = ' + '"' + messageString + '";';
    browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
    
    // Schedule status line for removal after a given time.
    setTimeout(deleteStatusLine, STATUSLINE_PERSIST_MS, latestMsgDispTab);
}

// Function to remove the status message after clip completion
function deleteStatusLine(tabId) {
    // Delete the status line DIV we have used for posting updates.
    //const onelinecommand = 'document.getElementById("status-line").remove();';
    const onelinecommand = 'var el = document.getElementById("status-line"); if(el != undefined) {el.remove();}';
    browser.tabs.executeScript(tabId, { code: onelinecommand, });
}

// Function to read any selected text in an email in a given tab. Returns string of that text
// or empty string 
async function readTextSelection(tabId) {
    const onelinecommand = 'window.getSelection().toString();';
    var result = await browser.tabs.executeScript(tabId, { code: onelinecommand, });
    
    // Return any text selected.
    console.log("DEBUG: readTextSelection returns \"" + result[0] + "\"");
    return(result[0]);
}




///////////////////////////
// Mail clipping functions
///////////////////////////

// Function to replace a reserved character with its Unicode equivilent or default replacement
function replaceUnicodeChar(c, defaultReplace="") {
    let newChar = unicodeSubs[c];
    
    // If Unicode match not found, return default replacement character
    if(newChar == undefined) {
        newChar = defaultReplace;
    }
    
    return newChar;
}


// Function to change characters that are illegal in Obsidian file names to something palatable
function correctObsidianFilename(noteFileName, useUnicodeChars=true, subSpacesWithUnderscores=false, additionalDisallowedChars='', noteNameReplaceChar='-')
{
    // Replace any whitespace in the replacement character with a null string so it deletes instead.
    noteNameReplaceChar = noteNameReplaceChar.replaceAll(/\s/g, "");
    
    // Start with a list of reserved characters to replace. Because backslashes normally escape special charatcers, it's
    // necesarry to escape them. Use four backslashes on this line to get two in searchString. Those two escape to have
    // the RegExp() call below search on a single backslash 
    let searchString = '|\\\\/"<>*:?';
    
    // Add the user provided list of reserved characters. First remove backslashes, which cause chaos and are 
    // already handled above. Then escape every character in case something has special meaninging in regular expression syntax.
    additionalDisallowedChars.replaceAll(/\\/g, '');        // Remove backslashes
    additionalDisallowedChars.split('').forEach( c => {     // Add escaped chars to list
        searchString = searchString + '\\' + c;
    });
    
    // Either replace or strip reserved characters. Begin with any unicode replacement user requested.
    let searchRegExp = new RegExp("[" + searchString + "]", "g");
    if(true == useUnicodeChars) {
        noteFileName = noteFileName.replace(searchRegExp, m=>replaceUnicodeChar(m, noteNameReplaceChar) );
    }
    else {
        // Use normal character sustitution on requested characters.
        noteFileName = noteFileName.replace(searchRegExp, noteNameReplaceChar);
    }
    
    // Finally, sub spaces with underscores if requested
    if(true == subSpacesWithUnderscores) {
        noteFileName = noteFileName.replaceAll(' ', '_');
    }
    
    return noteFileName;
}

// Function to extract text from a message object (specifically, a messagePart object),
// then recurse through any part[] arrays beneath that for more text.
function buildMessageBody(msgPart)
{
    let messageText = "";
    
    console.log("popup.js - buildMessageBody -  msgPart.contentType=" +  msgPart.contentType);
    
    // See if there's plaintext email content
    if (typeof msgPart.body !== 'undefined' && msgPart.contentType == "text/plain") {
            messageText = messageText + msgPart.body;
        }
        
    // Is there a parts[] array?
    if(typeof msgPart.parts !== 'undefined') {
        // Loop through all elements of the parts[] array
        for (let i = 0; i < msgPart.parts.length; ++i) {
            // For each of those elements, add element's .body, if it exists
            messageText = messageText + buildMessageBody(msgPart.parts[i]);
        }
    }
    return messageText;
}

// Function to get "to," "cc," and "bcc" fields and format them as requested.
function getRecipients(msg, field, yamlFormat=false)
{
    let recipientArray = "";
    let messageRecipients = "";
    
    // Get the correct array of recipents.
    if(field == "to") {
       recipientArray = msg.recipients;
    } else if (field == "cc") {
       recipientArray = msg.ccList;
    } else if (field == "bcc") {
       recipientArray = msg.bccList;
    } else {
        // Not a match - throw an error
        console.log("getRecipients() error - unrecognized field "+ field);
        return "";
    }
    
    // Now, build a list of recipients based on user request
    if(yamlFormat == false) {
        // Build comma delimited list of recipients from message
        if(recipientArray.length == 0) {
            messageRecipients = "None Listed";
        }
        else {
            for (let index = 0; index < recipientArray.length; ++index) {
                // Add commas if we have a multi recipent list
                if(index > 0) {
                    messageRecipients = messageRecipients + ", ";
                }
                
                // Add next recipient
                const nextRecipient = recipientArray[index];
                messageRecipients = messageRecipients + nextRecipient;
            }
        }
    } else {
        // Build a YAML formatted list of recipients from message
        if(recipientArray.length == 0) {
            messageRecipients = "";
        }
        else {
            for (let index = 0; index < recipientArray.length; ++index) {
                
                // Add next recipient to the list. Replace quotes with backslashed quotes, per YAML specification.
                const nextRecipient = recipientArray[index].replaceAll('\"', '\\"');
                
                // Make a new line with 
                messageRecipients = messageRecipients + "\n- \"" + nextRecipient + "\"";
            }
        }
    }
    
    return messageRecipients;
}

// Function to actually clip the email. Pass in the saved array of parameters.
async function clipEmail(storedParameters)
{
    // Read the passed parameters that configure the app.
    let obsidianVaultName = "";
    let noteFolderPath = "";
    let useUnicodeInFilenames = false;
    let noteTitleTemplate = "";
    let noteTemplate = "";
    let subSpacesWithUnderscores = false;
    let additionalDisallowedChars = "";
    let noteNameReplaceChar = "-";
    
    // Log that we're clipping the message
    await displayStatusText("ObsidianClipper: Clipping message.");
    
    // Get the active tab in the current window using the tabs API.
    let tabs = await messenger.tabs.query({ active: true, currentWindow: true });
    
    // Check stored parameters - test  options that cause fatal errors if not present
    if( (storedParameters["obsidianVaultName"] == undefined) ||
        (storedParameters["noteFolderPath"] == undefined) ||
        (storedParameters["noteFilenameTemplate"] == undefined) ||
        (storedParameters["noteContentTemplate"] == undefined) ) {
            // Warn user that add-on needs configuring.
            await displayAlert("ERROR: Please configure ObsidianClipper on its Options page before using.  " +
                "Look in Settings->Add-ons Manager->Obsidian Clipper->Options tab");
            return;
        } else {
        // Load parameters from storage
        obsidianVaultName = storedParameters["obsidianVaultName"];
        noteFolderPath = storedParameters["noteFolderPath"];
        useUnicodeInFilenames = storedParameters["unicodeCharSub"];
        noteTitleTemplate = storedParameters["noteFilenameTemplate"];
        noteTemplate = storedParameters["noteContentTemplate"];
        subSpacesWithUnderscores = storedParameters["subSpacesWithUnderscores"];
        additionalDisallowedChars = storedParameters["additionalDisallowedChars"]; 
        noteNameReplaceChar = storedParameters["noteNameReplaceChar"];
        
        // Correct any parameters the won't cause fatal errors when missing
        // by giving them default values.
        if(undefined == useUnicodeInFilenames) {useUnicodeInFilenames = true;}
        if(undefined == subSpacesWithUnderscores) {subSpacesWithUnderscores = true;}
        if(undefined == additionalDisallowedChars) {additionalDisallowedChars = "";}
        if(undefined == noteNameReplaceChar) {noteNameReplaceChar = "-";}
        }
    

    // Get the message currently displayed in the active tab, using the
    // messageDisplay API. Note: This needs the messagesRead permission.
    // The returned message is a MessageHeader object with the most relevant
    // information.
    let message = await messenger.messageDisplay.getDisplayedMessage(tabs[0].id);

    // Request the full message to access its full set of headers.
    let full = await messenger.messages.getFull(message.id);

    // Extract data from the message headers
    let messageSubject = message.subject;
    let messageAuthor = message.author;
    let messageDate = message.date.toLocaleDateString();
    let messageTime = message.date.toLocaleTimeString();
    
    // Create a mail "mid:" URI with the message ID
    // TODO: Put in template subsitition so it's only processed if used
    let messageIdUri = "mid:" + message.headerMessageId;        // Create a mail "mid:" URI with the message ID
    
    // Build the message tag list that refelcts howthe email was tagged.
    // TODO: Put in a function so it's not processed if not used
    let messageTagList = "";
    if(undefined != message.tags) {
        // Get a master list of tags known by Thunderbird
        let knownTagArray = await messenger.messages.listTags();
        
        // Loop through the tags on the email and find any matches
        for (var currMsgTagKeyString of message.tags) {
            // Check for a match of the email's tag against the master list.
            // Note that we're testing ".key" values here. Human readable strings are processed after a match.
            var matchingTagEntry = knownTagArray.find((t) => t.key == currMsgTagKeyString);
            if(undefined != matchingTagEntry) {
                // We have a match. Take the human readable string, replace spaces, and add a hashtag.
                var tagText = " #" + matchingTagEntry.tag.replaceAll(' ', '-');
                
                // Add tag to the tag list
                messageTagList = messageTagList + tagText;
            }
        }
    }
    
    // Extract message body text from the message. First, see if user
    // selected specific text to be saved.    
    let messageBody = await readTextSelection(latestMsgDispTab);
    
    // Was anything selected?
    if(messageBody == "") {
        // No text was selected - get entire message text.
        messageBody = buildMessageBody(full);
    }
    
    console.log("popup.js - clipEmail - messageBody: " + messageBody);

    // Build note name and content from templates and message data.
    // Use these placeholders for note and time content:
    //     Note Info: _NOTEDATE, _NOTETIME
    //     Message info: _MSGDATE, _MSGTIME, _MSGSUBJECT, _MSGRECIPENTS, _MSGAUTHOR, _MSGCONTENT

    // Create a mapping of template fields to the data to be inserted and an regular expression to use it.
    const thisMoment = new Date();   // For note time and date
    var templateMap = {
        _MSGDATE:message.date.toLocaleDateString(),
        
        _MSGYEAR:String(message.date.getFullYear()),
        _MSGMONTH:String(message.date.getMonth()+1).padStart(2, '0'),
        _MSGDAY:String(message.date.getDate()).padStart(2, '0'),
        _MSGHOUR:String(message.date.getHours()).padStart(2, '0'),
        _MSGMIN:String(message.date.getMinutes()).padStart(2, '0'),
        _MSGSEC:String(message.date.getSeconds()).padStart(2, '0'),
        
        _MSGTIME:message.date.toLocaleTimeString(),
        _MSGSUBJECT:messageSubject,
        _MSGAUTHOR:messageAuthor,
        _MSGTAGSLIST:messageTagList,
        _MSGIDURI:messageIdUri,
        _MSGCONTENT:messageBody,
        
        _MSGRECIPENTS_YAML:getRecipients(message, "to", true),
        _MSGCC_YAML:getRecipients(message, "cc", true),
        _MSGBCC_YAML:getRecipients(message, "bcc", true),
        _MSGRECIPENTS:getRecipients(message, "to"),
        _MSGCC:getRecipients(message, "cc"),
        _MSGBCC:getRecipients(message, "bcc"),
        
        _NOTEDATE:thisMoment.toLocaleDateString(),
        _NOTEYEAR:String(thisMoment.getFullYear()),
        _NOTEMONTH:String(thisMoment.getMonth()+1).padStart(2, '0'),
        _NOTEDAY:String(thisMoment.getDate()).padStart(2, '0'),

        _NOTETIME:thisMoment.toLocaleTimeString(),
        _NOTEHOUR:String(thisMoment.getHours()).padStart(2, '0'),
        _NOTEMIN:String(thisMoment.getMinutes()).padStart(2, '0'),
        _NOTESEC:String(thisMoment.getSeconds()).padStart(2, '0'),
    };
    
    // Build a regular expression that will trip on each key in templateMap
    const templateRegExp = new RegExp(Object.keys(templateMap).join('|'), 'gi');
    
    // Substitute the template fields with the actual message and note data
    let noteSubject = noteTitleTemplate.replaceAll(templateRegExp, function(matched){
      return templateMap[matched];
    });
    let noteContent = noteTemplate.replaceAll(templateRegExp, function(matched){
      return templateMap[matched];
    });

    // Now, replace characters that are not supported in Obsidian filenames.
    noteSubject = correctObsidianFilename(noteSubject, useUnicodeInFilenames, subSpacesWithUnderscores, additionalDisallowedChars, noteNameReplaceChar);

    console.log("popup.js: Note subject: \"" + noteSubject + "\"");
    console.log("popup.js: Note content:\n" + noteContent);
    
    // Build the Obsidian URI, encoding characters like spaces or punctuation as required.
    // Start with the vault name.
    let obsidianUri = "obsidian://new?vault=" + obsidianVaultName;

    // The PATH parameter to the URI is optional. Only add it if user specified a non-blank path.
    if(noteFolderPath != undefined && /[^\s]/.test(noteFolderPath) ) {
        // Path specified. Use FILE parameter to specify where the file should
        // go and what it should be called.
        obsidianUri = obsidianUri + "&file=" + encodeURIComponent(noteFolderPath + "/" + noteSubject);
    } else {
        // Path not specified. Use NAME parameter to specify file anme and that it should be placed
        // at Obsidian's default location for notes.
        obsidianUri = obsidianUri + "&name=" + encodeURIComponent(noteSubject);
    }
    
    // Finally, append the actual email content as the note content.
    obsidianUri = obsidianUri + "&content=" + encodeURIComponent(noteContent);
    console.log("popup.js: obsidianUri: " + obsidianUri);
    
    // Log status
    await displayStatusText("ObsidianClipper: Sending data to Obsidian application.");
    
    // Create new note
    // Supposedly, there's a defacto 200 char limit to URIs (https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers)
    // However, testing fof12K+ emails is fine.
    // TODO: If there's problems with long notes, add a loop with APPEND for note content to handle bigger emails.
    let openedWindow;
    openedWindow = window.open(obsidianUri, "_self");
    
    
    // Log status
    await displayStatusText("ObsidianClipper: Message clipped.");
}

// Wrapper to run the email clip code
function doEmailClip() {
    // Get the stored parameters and pass them to a function to perform the actual mail clipping.
    browser.storage.local.get(null).then(clipEmail, onError);
}

//////////
// doHandleCommand() - handler for messages from content scripts
//////////
const doHandleCommand = async (message, sender) => {
    // Get command name and the sending tab ID
    const { command } = message;
    const { tabId } = message;

    const messageHeader = await browser.messageDisplay.getDisplayedMessage(tabId);
    
    // Check for known commands.
    let thisCommand = command.toLocaleLowerCase();
    console.log("Command '"+thisCommand+"' received from tab "+tabId)
    switch (thisCommand) {
        // Button requests that an email be clipped.
        // Reply with clipstatus and eventually clipdone
        case "cliprequest" : {
            console.log("message 'cliprequest' received.");
            
            // Clip email
            doEmailClip();
            
            // Reply with status
            return true;
            }
            break;
        
        // Tab responded to a textselectrequest with selectresponse
        case "textselectresponse" : {
            console.log("message 'selectresponse' received.");
            
            // Check to see if any data was sent back
            const { textselectdata } = message;
            if(textselectdata) {
                //
                console.log("DEBUG: Got text selection of: " + textselectdata);
            } else {
                //
                console.log("DEBUG: No text selected");
            }
        }
        break;
        
        default: {
            console.log("ERROR: Do not recognize internal message '"+ thisCommand + "'");
        }
        break;
    }
};


///////////////////////
// Main execution path
///////////////////////

// Add a handler for communication with other parts of the extension:
//  - Display popup will request a clip with a "cliprequest" command.
//      - Background will reply with "clipstatus" messages and eventually "clipcomplete"
//  - Message tab will send a "textselectresponse" in reply to a "textselectrequest"

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.hasOwnProperty("command")) {
        // If we have a command, return a promise from the command handler.
        return doHandleCommand(message, sender);
    }
  return false;
});


// Add clipper to the message_list menu
browser.menus.create({
    title: "ObsidianClipper",
    contexts: ["message_list"],
    onclick: doEmailClip,
  });

// Add listener for status line in the message content tab
browser.messageDisplay.onMessageDisplayed.addListener(async (tab, message) => {
    // Inject style sheet into the message content tab.
    await browser.tabs.insertCSS(tab.id, {
      file: "/statusLine/statusLine-styles.css"
    });
    
    // Record the tab for later updates. 
    console.log("Got messageDisplayed event for tab " + tab.id + ". Previous tab was " + latestMsgDispTab);
    latestMsgDispTab = tab.id;
    
    // To display text on the tab, call displayStatusText() to set text in the DIV
});

  