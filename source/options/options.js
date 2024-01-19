//
// options.js - Handle Options tab for Obsidian Clipper Add-on for Thunderbird.
//

/* generic error handler */
function onError(error) {
  console.log("options.js: " + error);
}


///////////////////////////////////////////////////////////////
// DEBUG: Start with a clean slate when tesing Add-on...
// console.log("DEBUG: Clearing local store values for testing...");
// browser.storage.local.clear();
///////////////////////////////////////////////////////////////

// Set up array of default parameters for each HTML field.
// remember to assign listeners to any new field (below)
var defaultParameters = [];
defaultParameters["obsidianVaultName"] = "_myNotes";
defaultParameters["noteFolderPath"] = "ClippedEmails";
defaultParameters["noteFilenameTemplate"] = "Email (_MSGDATE) : _MSGSUBJECT";
defaultParameters["noteContentTemplate"] = 
    "Tagged: #email _MSGTAGSLIST\n" +
    "Created: _NOTEDATE, _NOTETIME\n" +
    "Subject: _MSGSUBJECT\n" +
    "Message Date: _MSGDATE, _MSGTIME\n" +
    "Author: _MSGAUTHOR\n" +
    "Recipients: _MSGRECIPENTS\n" +
    "[Click to open message in email client](_MSGIDURI)\n\n" +
    "---\n\n" +
    "_MSGCONTENT";
defaultParameters["useColorCodedMsgTags"] = true;
defaultParameters["unicodeCharSub"] = true;
defaultParameters["subSpacesWithUnderscores"] = false;
defaultParameters["additionalDisallowedChars"] = "[]#^";

// Store the data to local storage with the given key
function parameterStore(key, value) {
    storeLocal = browser.storage.local.set({ [key] : value });
    storeLocal.then(() => {
        console.log("parameterStore: Stored parameter [" + key + ", " + value + "] success");  // Huh? Not seeing this on console, but appears to work.
      }, onError);
}

// Store the contents of an options field to local storage
function storeOption(id) {
    fieldContent = "";
    
    // Read the options field
    var elem = document.getElementById(id);
    if(typeof elem !== 'undefined' && elem !== null) {
        
        if(elem.type == "checkbox") {
            // Unlike text fields, read boolean to see if checkboxes are set or cleared
            fieldContent = elem.checked;
        } else {
            // Read field
            fieldContent = elem.value;
        }
        
        // Store away field data
        parameterStore(id, fieldContent);
    }
    else {
        console.log("storeOption("+id+") ERROR: typeof elem == " + typeof elem + "elem == " + elem);
    }
}


// Store the default value of an option to local storage
function storeDefault(id) {
    defaultValue = defaultParameters[id];
    
    // Is element in the array of default values?
    if(undefined != defaultValue) {
        // There is an entry - save this default value away.
        console.log("storeDefault("+id+") storing default value of "+defaultValue);
        parameterStore(id, defaultValue);
    } else {
        console.log("ERROR: storeDefault("+id+") can't find a default value");
    }
}

function loadOptionsFields(storedParameters)
{
    // Loop through list of expected parameters to set the fields
    for(key in defaultParameters) {
        fieldContent = "";
        if(storedParameters[key] == undefined) {
            console.log("loadOptionsFields: Parameter ["+key+"] not found. Using default value \"" + defaultParameters[key] +"\'");
            
            // Save field content
            fieldContent =  defaultParameters[key];  // Save filed content
            
            // Store default parameter
            parameterStore(key, fieldContent);
            
        } else  {
            console.log("loadOptionsFields: Parameter ["+key+"] found. Using value \"" + storedParameters[key] +"\'");
            
            // Save field content
            fieldContent =  storedParameters[key];  
        }
        
        // Now set the field's value on the options webpage.
        var elem = document.getElementById(key);
        if(typeof elem !== 'undefined' && elem !== null) {
            if(elem.type == "checkbox") {
                // Unlike text fields, use a boolean to set/clear checkboxes
                elem.checked = fieldContent;
            } else {
                // Set field to the indicated string
                elem.value = fieldContent;
            }
        }
    }
}

///////////////////////
// Main execution path
///////////////////////

// Set up event listeners for buttons.
document.getElementById('submit-obsidianVaultName').onclick = function() {storeOption("obsidianVaultName"); };
document.getElementById('default-obsidianVaultName').onclick = function() {storeDefault("obsidianVaultName"); };

document.getElementById('submit-noteFolderPath').onclick = function() {storeOption("noteFolderPath"); };
document.getElementById('default-noteFolderPath').onclick = function() {storeDefault("noteFolderPath"); };

document.getElementById('submit-noteFilenameTemplate').onclick = function() {storeOption("noteFilenameTemplate"); };
document.getElementById('default-noteFilenameTemplate').onclick = function() {storeDefault("noteFilenameTemplate"); };

document.getElementById('submit-noteContentTemplate').onclick = function() {storeOption("noteContentTemplate"); };
document.getElementById('default-noteContentTemplate').onclick = function() {storeDefault("noteContentTemplate"); };

document.getElementById('submit-useColorCodedMsgTags').onclick = function() {storeOption("useColorCodedMsgTags"); };
document.getElementById('default-useColorCodedMsgTags').onclick = function() {storeDefault("useColorCodedMsgTags"); };

document.getElementById('submit-unicodeCharSub').onclick = function() {storeOption("unicodeCharSub"); };
document.getElementById('default-unicodeCharSub').onclick = function() {storeDefault("unicodeCharSub"); };

document.getElementById('submit-subSpacesWithUnderscores').onclick = function() {storeOption("subSpacesWithUnderscores"); };
document.getElementById('default-subSpacesWithUnderscores').onclick = function() {storeDefault("subSpacesWithUnderscores"); };

document.getElementById('submit-additionalDisallowedChars').onclick = function() {storeOption("additionalDisallowedChars"); };
document.getElementById('default-additionalDisallowedChars').onclick = function() {storeDefault("additionalDisallowedChars"); };






// Get the stored parameters and pass them to a function to populate fields.
browser.storage.local.get(null).then(loadOptionsFields, onError);


