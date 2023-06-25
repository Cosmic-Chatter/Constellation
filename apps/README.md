# Constellation Apps
A collection of visitor-facing apps to help you create rich digital experiences, connected by **_Constellation_**.

## Philosophy
Constellation Apps is focused on flexibility. To that end, it uses the web browser to display its visitor-facing content. That means any device that can display a website can turn into a digital exhibit component.

However, web browsers are limited in their ability to interact with the underlying computer. Your browser can't, for instance, reboot your PC—probably a good thing! Because of this, Apps uses a secondary program (the _helper_) running outside the browser to store your content and interact with the PC itself.

As mentioned, the interface can be anything with a web browser. But the helper must be a PC running Windows, macOS, or Linux. Thus, the easiest way to use Constellation Apps is on a PC. If you want to, for instance, collect word cloud input from an iPad, you'll need both a PC and the iPad.

## First-time setup
Constellation Apps must be hosted by a PC running Windows, macOS, or Linux, even if the user-facing interface is a mobile device such as an iPad.

### Installation
Download the version appropriate for your operating system [here](https://cosmicchatter.org/constellation/constellation.html) and place the file in the location you would like to run Apps from. Then, launch the file.

A command-line setup window will launch, asking you a few basic questions. Once you use the keyboard to answer, Apps will launch and open a graphical interface in your default web browser.

### Local vs. remote `BETA`
During the first-time setup, you will be asked if Constellation Apps will be displayed on a remote device or on the installation PC. Choosing `local` will configure the app to run as a self-contained GUI. Choosing `remote` will launch the app in the terminal, as was standard prior to **_Constellation 3.2_**.

## Deploying Constellation Apps
When configuring the app for use in production (i.e., on the museum floor), it is strongly recommended to set it up in kiosk mode. This will lock users into the application and supress many pop-ups.

### Disabling gestures
If the device has a touchscreen, it is important to disable any system gestures that allow a user to escape the application. This can be done on Windows 10/11 using [these instructions](https://support.honeywellaidc.com/s/article/How-to-disable-touchscreen-edge-swipes-in-Windows-10) and on Ubuntu 22.04 using these commands:

```commandline
wget "https://extensions.gnome.org/extension-data/disable-gestures-2021verycrazydog.gmail.com.v4.shell-extension.zip"

gnome-extensions install disable-gestures-2021verycrazydog.gmail.com.v4.shell-extension.zip

reboot
```

On macOS, it is not possible to hide the dock and menu bar permanently, so macOS is not recommended for use with a touchscreen.

### Local mode
If you are running Constellation Apps in local mode, launching as a kiosk is very easy. On Windows, create a shortcut for Constellation_Apps.exe, open the properties of the shortcut, and add the word `fullscreen` to the end of the target. On Linux, simply use this command to launch the app:

```commandline
./Constellation_Apps fullscreen
```

### Remote mode
If you are running Constellation Apps in remote mode, you must configure your browser of choice to open in Kiosk mode. Follow the linked instructions for [Firefox](https://support.mozilla.org/en-US/kb/firefox-enterprise-kiosk-mode) and [Edge](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode).

For iOS or iPadOS, first add the app to the home screen following the section _Add a website icon to your Home Screen_ [here](https://support.apple.com/guide/iphone/bookmark-favorite-webpages-iph42ab2f3a7/ios). Then, configure Guided Access by following [these instructions](https://support.apple.com/en-us/HT202612).