//
// popup.js - Code for the Obsidian Clipper add-on for Thunderbird to save a selected mail message .
//



/* generic error handler */
function onError(error) {
  console.log("popup.js: " + error);
}

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
        
        
    console.log("popup.js - buildMessageBody -      msgPart.parts.length=" + msgPart.parts.length);
    
        
        // Loop through all elements of the parts[] array
        for (let i = 0; i < msgPart.parts.length; ++i) {
            // For each of those elements, add element's .body, if it exists
            messageText = messageText + buildMessageBody(msgPart.parts[i]);
        }
    }
    return messageText;
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
    let useColorCodedMsgTags = true;

    // Check stored parameters - test  options that cause fatal errors if not present
    if( (storedParameters["obsidianVaultName"] == undefined) ||
        (storedParameters["noteFolderPath"] == undefined) ||
        (storedParameters["noteFilenameTemplate"] == undefined) ||
        (storedParameters["noteContentTemplate"] == undefined) ) {
            alert("ERROR: Please configure ObsidianClipper on its Options page before using.\n" +
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
        useColorCodedMsgTags = storedParameters["useColorCodedMsgTags"];
        
        // Correct any parameters the won't cause fatal errors when missing
        // by giving them default values.
        if(undefined == useUnicodeInFilenames) {useUnicodeInFilenames = true;}
        if(undefined == subSpacesWithUnderscores) {subSpacesWithUnderscores = true;}
        if(undefined == additionalDisallowedChars) {additionalDisallowedChars = "";}
        if(undefined == noteNameReplaceChar) {noteNameReplaceChar = "-";}
        if(undefined == useColorCodedMsgTags) {useColorCodedMsgTags = true;}
        }

    // Get the active tab in the current window using the tabs API.
    let tabs = await messenger.tabs.query({ active: true, currentWindow: true });

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
                
                // Does the user want colored tags?
                if( (useColorCodedMsgTags) && (undefined != matchingTagEntry.color) ) {
                    // Add tag and enclosing HTML to the tag list
                     messageTagList = messageTagList + "<span style=\"color:" + matchingTagEntry.color + ";\">" + tagText + "</span>";
                } else {
                    // Add tag to the tag list without HTML
                     messageTagList = messageTagList + tagText;
                }
            }
        }
    }
    
    // Build comma delimited list of recipients from message
    let messageRecipients = "";
    if(message.recipients.length == 0) {
        messageRecipients = "None Listed";
    }
    else {
        for (let index = 0; index < message.recipients.length; ++index) {
            // Add commas if we have a multi recipent list
            if(index > 0) {
                messageRecipients = messageRecipients + ", ";
            }
            
            // Add next recipient
            const nextRecipient = message.recipients[index];
            messageRecipients = messageRecipients + nextRecipient;
        }
    }
        

    // Update the HTML fields of popup.html with the message subject, sender and date.
    document.getElementById("subject").textContent = messageSubject;
    document.getElementById("from").textContent = messageAuthor;
    document.getElementById("received").textContent = messageDate + ", " + messageTime;
    document.getElementById("status").textContent = "Sending data to Obsidian application.";

    // Extract message body text from the message.
    let messageBody = "";
    messageBody = buildMessageBody(full);
    
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
        _MSGRECIPENTS:messageRecipients,
        _MSGAUTHOR:messageAuthor,
        _MSGTAGSLIST:messageTagList,
        _MSGIDURI:messageIdUri,
        _MSGCONTENT:messageBody,
        
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
    
    // Create new note
    // Supposedly, there's a defacto 200 char limit to URIs (https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers)
    // However, testing fof12K+ emails is fine.
    // TODO: If there's problems with long notes, add a loop with APPEND for note content to handle bigger emails.
    let openedWindow;
    openedWindow = window.open(obsidianUri, "_self");

    // Put up a status message in case above window open failed.
    document.getElementById("status").textContent = "If this window does not close, something has failed. Check the Vault Name and other parameters in the Obsidian Clipper add-on options window.";
}

// Get the stored parameters and pass them to a function to populate fields.
browser.storage.local.get(null).then(clipEmail, onError);

