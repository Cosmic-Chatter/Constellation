# Media Player

## Introduction
Media player displays images and videos using the browser as its rendering engine. The player and its optional kiosk are implemented in JavaScript.

## Terminology
* `collateral`: Material other than the `content`, such as thumbnails, label text, etc.
* `content`: A single media file to be displayed by the player, such as one image or one video.

## Setting up Media Player

### Installation

To install Media Player, follow the following steps:

1. Download the files from GitHub and place them somewhere permanent.
3. From System Helper, download `helper.py`, `config.py`, and `requirements.txt`. Place them in the same directory as the Media Player files.
4. From a terminal within the directory, run `python3 -m pip install --upgrade -r requirements.txt`.

### Starting Media Player

To run Media Player, you first launch System Helper, then open the `media_player.html` in a supported web browser. Specifically:

1. Ensure you have configured `defaults.ini` as described in the section Configuration options.
2. Navigate to the directory with the Media Player files. Open a terminal or command prompt.
3. Run the System Helper by typing `python3 helper.py` in a terminal.
4. Open `media_player.html` in a supported browser and set it fullscreen.

Media player is based on HTML 5 and JavaScript, so it should work on any modern browser; however, it has only been tested significantly on Chromium. Videos that include audio are most easily set up in the Chromium version of Microsoft Edge (available for Windows/macOS/Linux).

### Configuration options
* `autoplay_audio` (default: `false`): Allow media files to play audio without interaction.
 * If you enable audio, you **must** whitelist the player HTML file in the browser. Otherwise, no media will play. This is a feature mandated by all modern browsers. If you cannot whitelist the file, the user must click/tap on the video once to start the audio.
* `allow_sleep` (default: `true`): Allow System Helper to put the display to sleep on command from the Control Server. This does not override any operating system settings, which may interfere with sleeping/waking the screen.
* `id`: A unique name for communicating with the Control Server. Every media player must have an `id`.
* `image_duration` (Default: 10 seconds): The number of seconds an image is displayed before the next item in the playlist is shown. Specify with a number only, no units.
* `kiosk_id` (default: `UNKNOWN`): A unique name for the optional kiosk.
* `kiosk_type` (default: `PLAYER_KIOSK`): A user-defined grouping name for the optional kiosk
* `synchronize_with`: A list of other Media Player `id`s with which to synchronize playback.
* `type`: A user-defined grouping name. Every media player must have a `type`.

## Synchronizing with other Media Player instances

_Synchronization is experimental_

Media Player can perform a limited synchronization with other Media Player instances. **This synchronization only occurs when playback begins.** Steps to synchronize:

1. Use the keyword `synchronize_with` in `defaults.ini` to list the `id` of each other Media Player with which you want to synchronize. Add this keyword into the `defaults.ini` for every Media Player, listing in each the other `id`s.
2. Launch the `system helper` associated with each player.
3. Launch the media player webpage for each player.
4. As each player launches, it will contact the Control Server and indicate that it is ready for synchronization. As the player waits, it will display a black screen.
5. Once every player has checked in, the server will send the synchronization information. Synchronization will begin shortly.

Synchronization can occur between players running on the same physical machine, or between players on separate machines.

Synchronization always begins with the first `content` item. **Players do not resynchronize when switching between files. Since file loading is not a constant time process, players will likely become desynchronized if multiple `content` items are used**

## Using the kiosk

Media Player includes an optional kiosk, `player_kiosk.html`, that allows a user to control the player from an external device. The kiosk can also provide a label for each piece of `content`.

### Displaying the kiosk
From a remote device, use a web browser to connect to the System Helper with `player_kiosk.html` as the pathname. For example, `http://10.8.0.125:8082/player_kiosk.html`. On iOS, the kiosk can be saved to the Home Screen and will display as a Progressive Web App, without any of the Safari interface. **For the reliability of the connection, the host machine should have a static IP address.**

### Configuring collateral
Properly displaying the kiosk requires adding several pieces of `collateral`, which are described below.

#### Thumbnails
Each piece of `content` may have a single thumbnail, regardless of how many `exhibits` it belongs to. That thumbnail should be a square PNG of any resolution, although resolutions over 768x768 are unnecessarily large. The thumbnail must have the same file name as the `content`, with an extension of `.png`. Thumbnails should be placed in the directory called `thumbnails`.

For example, the media file `myVideo.mp4` should have thumbnail `myVideo.png`. Depending on your browser and operating system, matching the case of the extension may be necessary. If a suitable thumbnail is not found, the default image of a magnifying glass is used. Thumbnails may have transparency.

#### Labels
Each piece of `content` should have a label for both English and Spanish. This label is a plain text file with the same filename as the media, but using the extension `.txt`. The label may be richly formatted using [Markdown](https://www.markdownguide.org/basic-syntax/).

For example, the media file `myImage.JPG` should have a label `myImage.txt`. If a suitable label cannot be found, the label display panel on the kiosk will display blank. Labels should be placed in nesting subfolders, with the first folder being `labels`, followed by the name of each `exhibit`, followed by `en` and `es`.

#### Titles
Each piece of `content` can have a display name, which appears on its button in the kiosk interface. The kiosk itself can also have a title, which appears in both the attractor and at the top of the interface.

These titles are specified in the file `dictionary.ini`, which should be placed in the root of the media player directory. The INI file should have a section `[EN]` for English and `[ES]` for Spanish, as such:

```
[EN]
myVideo.mp4 = Centripetal Force Example
myImage.JPG = A Geometric Design
mySecondImage.png = A Beautiful Sunset

[ES]
myVideo.mp4 = Ejemplo de fuerza centrípeta
myImage.JPG = Un diseño geométrico
mySecondImage.png = Una hermosa puesta de sol
```

Because of the format of an INI file, titles may not have an equals sign (`=`) in them.

## Sample directory structure
The following code snippet shows the directory structure for a complete media player and kiosk.

```
media_player/
    content/
        myVideo.mp4
        myImage.jpeg
        mySecondImage.png
    css/
        ...
    js/
        ...
    labels/
        exhibit1/
            en/
                myVideo.txt
                myImage.txt
            es/
                myVideo.txt
                myImage.txt
        exhibit2/
            en/
                myVideo.txt
                mySecondImage.txt
            es/
                myVideo.txt
                mySecondImage.txt
    thumbnails/
        myVideo.png
        myImage.png
        mySecondImage.png

    config.js
    defaults.ini
    dictionary.ini

    helper.py
    config.py
    media_player.html
    player_kiosk.html
```
