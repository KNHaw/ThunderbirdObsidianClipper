# ThunderbirdObsidianClipper
ObsidianClipper is an Add-On for the Thunderbird email client that lets a user clip messages to the Obsidian notetaking application. Both applications are open source and free to use, just like this Ad-dOn!

## Installation
- You will first need to have the Obsidian notetaking app on your local platform as well as the Thunderbird email client.
  - You can download Thunderbird for free [here](https://www.thunderbird.net/en-US/download/).
  - You can download Obsidian for free [here](https://obsidian.md/download).
  - You can install the *Obsidian Clipper* Add-On into Thunderbird in two ways:
    - By searching for "ObsdianClipper" in the Add-On manager (*Settings->Add-Ons Manager*).
    - Or by downloading a file from the [Thuderbird Add-On Site](https://addons.thunderbird.net/en-US/thunderbird/addon/obsidianclipper/), clicking the "Download Now" button to get an XPI file, and installing that file from the Add-On manager (*Add-On Manager->Settings->Install Add-On from file*).
- After installing ObsidianClipper to your Thunderbird client, select the Options tab (*Settings->Add-Ons Manager->Obsidian Clipper->Options tab*) and configure the Add-On to work with Obsidian on your machine.
  - *Obsidian Vault Name* - is the name of the vault you created to keep your notes in when you set up Obsidian.
  - *Note Folder Path* - an optional parameter that allows the user to specifiy a location within the
  vault to place clipped emails By default, this will be the folder "ClippedEmails.". If this parameter is left blank, new notes in Obsidian will appear
  in the location indicated in 'Settings->Files & Links->Default location for new notes'.
  - *Note Filename and Content Templates* - allow you to specify how your clipped emails will be formatted and how the files will be named.

![Here is what the *Options* tab looks like](docs/OptionsTab.png)


- After you've installed and configured the Add-On, you're ready to clip emails!

## Usage
To use ObsidianClipper, just select an email and look for the "Obsidian" icon on the header (where you will also find the Reply and Forward buttons). Press the "Obsidian" button and your Obsidian application will launch and load your vault and your email will be clipped into Obsidian. 

![Click on the Obsidian Clipper icon when viewing a message to save it into Obsidian.](docs/MessagePane.png)

Once your email has been clipped, it will look like the screenshot below. By default, your note will be in the top level "ClippedEmails" folder (Obsidian will create the folder if needed), but you can change it with the *Note Folder Path* option mentioned above.


![This is what a clipped email message looks like in Obsidian. The location for the note, the format of the file name, and the format of the note itself are all customized via the "Options" tab..](docs/ClippedNote.png)



## Bugs
If ObsidianClipper is not properly working, please take a moment to reread the instructions and reinstall the Add-On. If it is still happening, take screenshots of the problem and send them to me via the *Feedback* instructions below.

## Limitations & Future Features
At this time, ObsidianClipper will only clip the text portion of an email and not HTML content (i.e. embedded images, bold or italics, etc). It will also not save attachments. If you're a user who is interested in these or other features, please let me know via the *Feedback* instructions below. Otherwise I will assume there is no demand for them.

## Questions? Feedback?
ObsidianClipper is still a work in progress. If you have any questions or want to give me feedback, please reach out to me on the contact links above or via the contact page on my personal website, [KevinHaw.com](http://www.kevinhaw.com).

I hope this Add-On proves useful to you.
