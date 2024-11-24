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
var latestMsgDispTab = 1;       // Latest tab recorded on an incoming onMessageDisplay event. Used for later reference.
var plainTextMessageBody = "";  // Plain text of clipped message body
var htmlMessageBody = "";       // HTML of clipped message body translated to markdown 

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
function onError(error, context="") {
    if("" == context) {
        console.error("background.js: " + error);
    } else {
        console.error("background.js: " + error + " (" + context + ")");
    }
        
}

// Function to post an alert to the user
// NOTE: Do not pass escaped quotes in messageString as they can hose the executeScrpt()
async function displayAlert(messageString) {

    let retVal = "";
    console.log("displaying alert \"" + messageString + "\" in tab " + latestMsgDispTab);
    
    // Catch any errors thrown by executeScript()
    try {    
      const onelinecommand = 'alert(' + '"' + messageString + '");';
      retVal = await browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
    } catch(e) { onError(e, ("displayAlert - " + messageString)); }
    
    return retVal;
}


// Function to post an confirmation dialog to the user.
// Returns true if user selected OK and false on CANCEL.
// NOTE: Do not pass escaped quotes in messageString as they can hose the executeScrpt()
async function displayConfirm(messageString) {
    var retval ="";
    
    console.log("displaying confirm dialog \"" + messageString + "\" in tab " + latestMsgDispTab);
    const onelinecommand = 'confirm(' + '"' + messageString + '");';
    
    // Catch any errors thrown by executeScript()
    try {    
        // Run the confirmation dialog.
        retArray = await browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
        retval = retArray[0];
    } catch(e) { onError(e, ("displayConfirm - " + messageString)); }
    
    // Return the response
    return retval;
}


// Function to display clip status
// NOTE: Do not pass escaped quotes in messageString as they can hose the executeScrpt()
async function displayStatusText(messageString) {
    console.log("displaying status text \"" + messageString + "\" in tab " + latestMsgDispTab);
    
    // Catch any errors thrown by executeScript()
    try {    
        // First, inject script to create a DIV text element in the message content tab
        // where we can post text.
        await browser.tabs.executeScript(latestMsgDispTab, {
          file: "/statusLine/statusLine-script.js"
        });
        
        // Post the text to the innerText of the created DIV.
        const onelinecommand = 'document.getElementById("status-line-text").innerText = ' + '"' + messageString + '";';
            await browser.tabs.executeScript(latestMsgDispTab, { code: onelinecommand, });
        
        // Schedule status line for removal after a given time.
        setTimeout(deleteStatusLine, STATUSLINE_PERSIST_MS, latestMsgDispTab);
    } catch(e) { onError(e, ("displayStatusText - " + messageString)); }

}

// Function to remove the status message after clip completion
function deleteStatusLine(tabId) {
    
    // Catch any errors thrown by executeScript()
    try {    
        // Delete the status line DIV we have used for posting updates.
        //const onelinecommand = 'document.getElementById("status-line").remove();';
        const onelinecommand = 'var el = document.getElementById("status-line"); if(el != undefined) {el.remove();}';
        browser.tabs.executeScript(tabId, { code: onelinecommand, });
    } catch(e) { onError(e, ("deleteStatusLine - " + tabId)); }

}

// Function to read any selected text in an email in a given tab. Returns string of that text
// or empty string 
async function readTextSelection(tabId) {
    
    var retVal = "";
    
    // Catch any errors thrown by executeScript()
    try {    
        const onelinecommand = 'window.getSelection().toString();';
        var result = await browser.tabs.executeScript(tabId, { code: onelinecommand, });
        
        // Return any text selected.
        retVal = result[0];
        console.log("DEBUG: readTextSelection returns \"" + retVal + "\"");
        //return(result[0]);
    } catch(e) { onError(e, ("readTextSelection - " + tabId)); }
    
    return retVal;
    
}


/////////////////////////////
// Attachments Configuration
/////////////////////////////

// Function to clip and save a message's attachments.
// Returns a string suitable for the _MSGATTACHMENTLIST field. Either a newline and list
// of attachments in the vault or "none" if no attachments on the message.
// Note that attachmentFolderPath must be an absolute position in the vault and begin with "/"
async function saveAttachments(messageId, attachmentFolderPath,
    attachmentSaveEnabled, contentIdToFilenameMap) {
    
    var attachmentList = "";        // Returned markdown formatted list
    var attachmentCount = 0;        // Count attachments as they're saved
    var attachmentCountTotal = 0;   // Total count of attachments in this mail message
    
    // Get attachments
    let attachments = await browser.messages.listAttachments(messageId);
    attachmentCountTotal = attachments.length;  // Count, starting from one instead of zero
    
    // Process the attachments
    if(false == attachmentSaveEnabled){
        // No attachments. Return "none"
        attachmentList = "none";
    } else {
        
        // Step through the attachments
        for (let att of attachments) {
            // Get the attached file.
            let file = await browser.messages.getAttachmentFile(messageId, att.partName);
            let filename = file.name;
            let fileType = file.type;
            let contentId = att.contentId;  // Optional field - be sure to verify it exists before use
            
            console.log("Getting attachment " + filename + ", type " + fileType);
            
            let flobUrl = URL.createObjectURL(file);
            
            var imgId = await browser.downloads.download({
              url: flobUrl,
              filename: filename,
              conflictAction: "uniquify",
              saveAs:false
            });
            
            // Check to see if the write operation worked.
            let fileDownloadStatus = await browser.downloads.search({id:imgId});
            // TODO - throw error on download fail.

            console.log("Downloaded attachment " + fileDownloadStatus[0].filename);
            
            // To find the filename, take the full file path of the attachment and (if needed) convert it 
            // to a UNIX-like path (slashes instead of backslashes). Then take the last part of it.
            let fileNameAsWritten = fileDownloadStatus[0].filename.replaceAll(/\\/g, "/").split("/").pop();
            
            // Log file as saved
            attachmentCount = attachmentCount + 1;
            var attachmentSaveSuccessMsg = "Saved attachment file '"+ filename + "' (" + attachmentCount + " of " + attachmentCountTotal + ")";
            console.log(attachmentSaveSuccessMsg);
            await displayStatusText(attachmentSaveSuccessMsg);
            
            // Append link to attachment file list
            attachmentList += "\n - [" + fileNameAsWritten + "](" + attachmentFolderPath + "/" + fileNameAsWritten + ")";
            
            // If the content ID field is used, map the content ID to the file path
            if(contentId) {
                contentIdToFilenameMap[contentId] = attachmentFolderPath + "/" + fileNameAsWritten;
                }
            
            }
    }
    
    // If no attachments clipped, correct list to read "none"
    if("" == attachmentList) {
        attachmentList = "none";
    }
    
    // Report completed number of attachments
    return attachmentList;
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
    // already handled above. Then escape every character in case something has special meaning in regular expression syntax.
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

////////////////////////////////
// HTML to Markdown Functions
////////////////////////////////

// Function to convert HTML tables to markdown. Called by a replaceAll() with
// a regular expression so to parameters are the matches.
function replaceHtmlTable(wholeMatch, tagContents) {
    
    console.log("KNH DEBUG: Table to replace:\n"+tagContents);
    
    
    tagContents = tagContents.replace(/\n/gi, ""); // Remove all newlines
    
    // Begin by escaping any pipe characters in the HTML source, as they 
    // are used in markdown syntax for tables.
    tagContents = tagContents.replaceAll(/\|/gm, "\\|");
    

    // Now, get rid of table header (<th>), footer (<tf>), and body (<tb>) start and end tags. 
    // We will simply use first row of table to be the markdown table header instead.
    tagContents = tagContents.replace(/<(\/)?t(h|f|b).*?>/gi, "");    
    
    // Convert HTML tags to markdown equivilent
    tagContents = tagContents.replaceAll(/<tr.*?>/gm, "");         // Put rows on own lines
    tagContents = tagContents.replaceAll(/<\/tr.*?>/gm, "|\n");
    tagContents = tagContents.replaceAll(/<td.*?>/gm, "| ");       // Separate cells w/ pipe characters
    tagContents = tagContents.replaceAll(/<\/td.*?>/gm, " ");
    
    //console.log("KNH DEBUG: In work:\n"+tagContents.split("\n")[0].match(/ \|/g).length);
    
    // Count number of columns in first row, then inject
    // a markdown table header with that many columns after that row.
    numCol = tagContents.split("\n")[0].match(/ \|/g).length;
    tagContents = tagContents.replace(/ \|$/m, "|\n|--------".repeat(numCol) + "|");
    
    return "\n" + tagContents;
}

// Function to convert HTML to markdown text.
//
function htmlToMarkdown(html, contentIdToFilenameMap) {
    var text = html;        // Inputed text
    var workingText = "";   // Working area for text processing
    var currPos = 0;        // Positon in TEXT bring processed - used sporadically
    
    console.group("htmlToMarkdown() converting HTML to markdown");
    console.log("HTML input:\n" + text);
    
    // Discard formatting that was ignored by HTML anyways.
    text = text.replaceAll(/^\s+/gim, "");  // Remove all leading whitespace - the "m" allows start-of-line match
    text = text.replace(/\n/gi, ""); // Remove all newlines
    text = text.replace(/\r/gi, ""); // Remove all CRs
    text = text.replace(/ +/gi, " "); // Replace all multiple spaces with just one.
    
    // Remove style and script contents
    text = text.replace(/<style([\s\S]*?)<\/style>/gi, ""); 
    text = text.replace(/<script([\s\S]*?)<\/script>/gi, "");
    
    // Handle links
    text = text.replace(/<a.*?href="(.*?)[\?\"].*?>(.*?)<\/a.*?>/gi, "[$2]($1)");
    
    // Some tags are treated as extra lines
    text = text.replace(/<div>/gi, "\n\n");
    text = text.replace(/<p>/gi, "\n\n");
    text = text.replace(/<br\s*[\/]?>/gi, "\n");
    
    // Discard end tags for previous deleted start tags
    text = text.replace(/<\/div>/gi, "");
    text = text.replace(/<\/p>/gi, "");
    text = text.replace(/<br\s*[\/]?>/gi, "\n");
    
    // Handle header tags - 6 levels should be enough
    text = text.replace(/<h1>/gi, "\n# ");
    text = text.replace(/<h2>/gi, "\n## ");
    text = text.replace(/<h3>/gi, "\n### ");
    text = text.replace(/<h4>/gi, "\n#### ");
    text = text.replace(/<h5>/gi, "\n##### ");
    text = text.replace(/<h6>/gi, "\n###### ");
    text = text.replace(/<\/h[1-6]>/gi, "\n");    // Discard end tags
    
    // Handle IMG Tags
    var imgTagRegex = /(\<img[^>]+>)/gid;
    var imgTagMsgTextArray;
    workingText = "";   // Zero out working area
    currPos = 0;        // Zero out position in text that we're processing
    
    // Look through IMG HTML tags, using the regex to grab text before the tag and the tag itself.
    // TODO: Refactor to use calls to replaceAll() instead of building string one element at a time.
    while ((imgTagMsgTextArray = imgTagRegex.exec(text)) !== null) {
        let imgTagHtml = imgTagMsgTextArray[0];                     // The <img> tag
        let imgTagStartLoc = imgTagMsgTextArray.indices[0][0];
        let imgTagEndLoc = imgTagMsgTextArray.indices[0][1];
        
        currText = text.substr(currPos, imgTagStartLoc-currPos);    // Text from last IMG tag to start of new IMG tag
        workingText += currText;                                    // Add that text to working area
        
        let imgTagContentId = /src\s*="cid:(.*?)"/i.exec(imgTagHtml);   // The CONTENTID of the 'src="cid:CONTENTID"' in the IMG tag of an attached image
        let imgTagUrl = /src\s*="(http(s)?\:\/\/.*?)"/i.exec(imgTagHtml);   // The URL of the 'src' field in the IMG tag of a remote image
        let imgTagAltText = /alt\s*="(.*?)"/i.exec(imgTagHtml);         // The alt text in the IMG tag
        
        // Get the data from the image tag needed for markdown.
        var imgMarkdownTitle = "";
        var imgMarkdownLink = "";
        if(imgTagContentId != null) {
            // This is an embedded image. Get filename from the content id
            filename = contentIdToFilenameMap[imgTagContentId[1]];
            if(filename != undefined) {
                imgMarkdownLink = filename;
            } else {
                // KNH TODO - flag when attachments are not supported
                // No filename that matches content ID. Log an error
                imgMarkdownLink = "FileNotFound";
                console.error("Could not find embedded file for content-ID="+imgTagContentId);
            }
        }
        if(imgTagUrl != null) {
            // This is an external image. Embed the HTTP link
            imgMarkdownLink = imgTagUrl[1];
        }
        
        // Now, get any alt text from the IMG tag
        if(imgTagAltText != null) {
            imgMarkdownTitle = imgTagAltText[1];
        } else {
            // No alt txt - use link as a default
            imgMarkdownTitle = imgMarkdownLink;
        }
        
        // Add markdown image to the working area
        var imgMarkdown = "![" + imgMarkdownTitle + "](" + imgMarkdownLink + ")";
        workingText += imgMarkdown;
        
        // Move forward in HTML text for next IMG tag
        currPos = imgTagEndLoc;
        };

    // Take any text following last IMG tag
    workingText += text.substr(currPos, text.length-currPos);        
        
    // Overwrite text with the one containing the image markdown syntax.
    text = workingText;
    
    // Handle list (ordered and unordered) HTML tags
    var listTagRegex = /(<(\/)?(ol|ul|li).*?>)/gid;   // Regex to match LI, OL, or UL start and end tags. Allow for modifiers and properties inside tag.
    var ListTagMsgTextArray;
    workingText = "";   // Zero out working area
    currPos = 0;        // Zero out position in text that we're processing
    var listCounterStack = [];  // Keep a stack to track ordered (+1) and unordered (-1) lists.
    
    // Loop through all list HTML tags, using the regex to grab text before the tag and the tag itself.
    // TODO: Refactor to use calls to replaceAll() instead of building string one element at a time.
    while ((ListTagMsgTextArray = listTagRegex.exec(text)) !== null) {
        tagStart = ListTagMsgTextArray.indices[0][0];
        tagEnd = ListTagMsgTextArray.indices[0][1];
        
        // Get the text before the tag and the tag itself.
        currText = text.substr(currPos, tagStart-currPos);
        tag = text.substr(tagStart, tagEnd-tagStart);
        
        // Add text before the tag to our working text.
        workingText += currText;
        
       // Now, handle list item tags. 
       if(/<li.*?>/gid.test(tag)) {    // Check for <LI> tag.
           // Are there existing ul/ol lists?
           if(listCounterStack.length < 1) {
               console.error("Malformed HTML - LI tags without OL/UL setup");
               continue;
           }
           
           // Replace multiple line breaks with single line breaks, as the list controls line spacing.
           workingText = workingText.replace(/\n+/gi, "\n");
           
           // Pad the list element with indent
           workingText += "\n" + "    ".repeat(listCounterStack.length - 1);
           
           // Check if this is an ordered (posative number on stack) or unordered list (-1 on stack) 
           if(listCounterStack.at(-1) > 0) {
               // Ordered list - add markdown syntax
               workingText += listCounterStack.at(-1).toString() + ". ";
               
               // Increment ordered list counter on the stack. We cna reference it later if needed.
               listCounterStack[listCounterStack.length-1]++;
           } else {
               // Unordered list - just add markdown syntax
               workingText += "- ";
           }
       } else if(/<\/li.*?>/gid.test(tag)) {   // Check for </LI> tag.
           // Nothing to do for </LI> tags - just discard them.
       } else if(/<ol.*?>/gid.test(tag)) {     // Check for <OL> tag.
           // Start of ordered list - discard tag and put a +1 on stack for tracking nesting lists
           listCounterStack.push(1);
       } else if(/<ul.*?>/gid.test(tag)) {     // Check for <UL> tag.
           // Start of unordered list - discard tag and put a +1 on stack for tracking nesting lists
           listCounterStack.push(-1);
       } else if(/<\/(o|u)l.*?>/gid.test(tag)) {   // Check for </OL> or </UL> tag.
           // End list - just discard the tag and pop the stack
           listCounterStack.pop(1);
       } else {
            console.error("Shouldn't get here with list tag '" + tag + "'");
       }
        
        // Move forward in HTML text for to seek the next list tag
        currPos = tagEnd;
    }

    // Take any text following last list tag
    workingText += text.substr(currPos, text.length-currPos);

    // Overwrite text with the one containing markdown formatted lists.
    text = workingText;
    
    // Handle tables
    text = text.replaceAll(/<table.*?>(.*)<\/table.*?>/gims, replaceHtmlTable);
    
    // Handle italics and bold. It's important to use different
    // syntax for each (underscores vs. asterisks) to allow interleaving.
    text = text.replace(/<i>/gi, "_");
    text = text.replace(/<\/i>/gi, "_");
    text = text.replace(/<b>/gi, "**");
    text = text.replace(/<\/b>/gi, "**");
    
    // Strikethrough - handle obsolete <s> and up to date <strike> tags
    text = text.replace(/<s>/gi, "~~");
    text = text.replace(/<\/s>/gi, "~~");
    text = text.replace(/<strike>/gi, "~~");
    text = text.replace(/<\/strike>/gi, "~~");
    
    // Handle horizontal lines
    text = text.replace(/<hr[^>]+>/gi, "\n\n---");

    text = text.replace(/<[^>]+>/gi, "");  // Remove any remaining tags we haven't processed.
    
    text = text.replace(/ ,/gi, ",");   // Trim spaces in front of commas. May not be needed, but it can't hurt.

    // Make any HTML character substitutions
    text = text.replace(/&Auml;/g, "Ä");
    text = text.replace(/&Uuml;/g, "Ü");
    text = text.replace(/&Ouml;/g, "Ö");
    text = text.replace(/&auml;/g, "ä");
    text = text.replace(/&uuml;/g, "ü");
    text = text.replace(/&ouml;/g, "ö");
    text = text.replace(/&szlig;/gi, "ß");
    text = text.replace(/&lt;/gi, "<");
    text = text.replace(/&gt;/gi, ">");
    text = text.replace(/&amp;/gi, "&");
    text = text.replace(/&quot;/gi, "\"");
    text = text.replace(/&nbsp;/gi, " ");

    console.log("Translated markdown:\n" + workingText);
    console.groupEnd();

    return text;
}




// Function to extract text from a message object (specifically, a messagePart object),
// then recurse through any part[] arrays beneath that for more text.
function buildMessageBody(msgPart, maxEmailSize, contentIdToFilenameMap)
{
    console.log("background.js - buildMessageBody -  msgPart.contentType=" +  msgPart.contentType);
        
    // See if there's HTML content
    if (typeof msgPart.body !== 'undefined' && msgPart.contentType == "text/html") {
            htmlMessageBody = htmlMessageBody + htmlToMarkdown(msgPart.body, contentIdToFilenameMap);
        }
    // If no HTML, see if there's plaintext
    else if (typeof msgPart.body !== 'undefined' && msgPart.contentType == "text/plain") {
            plainTextMessageBody = plainTextMessageBody + msgPart.body;
        }
        
    // Is there a parts[] array?
    if(typeof msgPart.parts !== 'undefined') {
        // Loop through all elements of the parts[] array
        for (let i = 0; i < msgPart.parts.length; ++i) {
            // For each of those elements, add element's .body, if it exists
            buildMessageBody(msgPart.parts[i], maxEmailSize, contentIdToFilenameMap);
        }
    }
    
    // Do we need to crop the email text? Check for plain text first.
    if (plainTextMessageBody.length > maxEmailSize) {
        plainTextMessageBody = plainTextMessageBody.substr(1, maxEmailSize);
        plainTextMessageBody = plainTextMessageBody + "\n\n\n ========= Plain text Email cropped after " + maxEmailSize + " bytes ========= \n";
    }
    
    // Now check for HTML text size.
    if (htmlMessageBody.length > maxEmailSize) {
        htmlMessageBody = htmlMessageBody.substr(1, maxEmailSize);
        htmlMessageBody = htmlMessageBody + "\n\n\n ========= HTML Email cropped after " + maxEmailSize + " bytes ========= \n";
    }
}

// Function to get "to," "cc," and "bcc" fields of an email and format them as requested.
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
    let attachmentFolderPath = "";
    let attachmentSaveEnabled = false;
    let maxEmailSize = Number.MAX_SAFE_INTEGER;
    
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
            attachmentFolderPath = storedParameters["attachmentFolderPath"];
            attachmentSaveEnabled = storedParameters["attachmentSaveEnabled"];
            maxEmailSize = storedParameters["maxEmailSize"];
            
            // Correct any parameters the won't cause fatal errors when missing
            // by giving them default values.
            if(undefined == useUnicodeInFilenames) {useUnicodeInFilenames = true;}
            if(undefined == subSpacesWithUnderscores) {subSpacesWithUnderscores = true;}
            if(undefined == additionalDisallowedChars) {additionalDisallowedChars = "";}
            if(undefined == noteNameReplaceChar) {noteNameReplaceChar = "-";}
            if(undefined == attachmentFolderPath) {attachmentFolderPath = "";}
            
            // Correct any parameters requiring additional processing
            if((undefined == maxEmailSize) || (NaN == parseInt(maxEmailSize))){            
                maxEmailSize = Number.MAX_SAFE_INTEGER;     // Set no limit
            } else {
                maxEmailSize = parseInt(maxEmailSize);      // Set user defined limit
            }
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
    
    // Build the message tag list that reflects how the email was tagged.
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
    
    // Save message attachments and get a markdown list with links to them and a map of content-id to the files.
    const contentIdToFilenameMap = [];
    attachmentList = await saveAttachments(message.id, attachmentFolderPath, 
        attachmentSaveEnabled, contentIdToFilenameMap);
    
    // Extract message body text from the message. First, see if user
    // selected specific text to be saved.    
    // TODO - Make this handle HTML.
    let messageBody = await readTextSelection(latestMsgDispTab);
    
    // Was anything selected?
    if(messageBody == "") {
        // No text was selected - get entire message text. Zero out variables for extraced message content.
        plainTextMessageBody = "";  // Plain text of clipped message body
        htmlMessageBody = "";       // HTML of clipped message body translated to markdown 
        
        //messageBody = buildMessageBody(full, maxEmailSize, contentIdToFilenameMap);
        
        // Get the message text
        buildMessageBody(full, maxEmailSize, contentIdToFilenameMap);
        
        // Set the message body to the HTML content (if present) or the plain text.
        if(htmlMessageBody != "") {
            // Use the HTML, translated to markdown.
            messageBody = htmlMessageBody;
        } else {
            // There is no HTML. Just use the plain text.
            messageBody = plainTextMessageBody;
        }
    }
    
    console.log("background.js - clipEmail - messageBody: " + messageBody);
    
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
        
        _MSGATTACHMENTLIST:attachmentList,
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

    console.log("background.js: Note subject: \"" + noteSubject + "\"");
    console.log("background.js: Note content:\n" + noteContent);
    
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
    console.log("background.js: obsidianUri: " + obsidianUri);
    
    // Log status
    await displayStatusText("ObsidianClipper: Sending data to Obsidian application.");
    
    // Create new note
    // Supposedly, there's a defacto 200 char limit to URIs (https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers)
    // However, testing of emails of near 20K found a URI max size of 35717 bytes.
    // TODO: If there's problems with long notes, add a loop with APPEND to append 
    // note content a piece at a time to handle bigger emails.
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
    
    // Record tab for later reference
    latestMsgDispTab = tabId;
    
    // Get an incoming message.
    let thisCommand = command.toLocaleLowerCase();
    console.log("Command '"+thisCommand+"' received from tab "+tabId);
    
    // Act on the command
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
            console.error("Do not recognize internal message '"+ thisCommand + "'");
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
  
