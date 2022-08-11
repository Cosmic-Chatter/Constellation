# Voting Kiosk

## Introduction
Voting Kiosk provides an easy way to survey visitors using a touchscreen device. The record of votes is stored on Control Server, which can also switch between multiple surveys using the standard content interface. Voting Kiosk is implemented in Javascript.

## Terminology
* `template`: A file describing the survey options and their layout.

## Setting up Voting Kiosk
Like other **_Constellation_** components, Voting Kiosk runs best from a dedicated Linux or Windows PC. When connected to a touchscreen, this PC becomes a powerful surveying platform. However, to facilitate use on iPads and Android tablets, Voting Kiosk can also be set up in a remote mode.

### Configuring the appearance
The colorrs and fonts used by Voting Kiosk are completely configurable. To do so, open the `style.css` file in a text editor. Changing a color is as simple as editing the approrpriate [hex code](https://htmlcolorcodes.com).

You may also change the various fonts. To specify a custom font, place the font file (.ttf or .otf) somewhere within your directory. Then, specify the font as such:

```
@font-face {
    font-family: OpenSans-Bold;
    src: url(fonts/OpenSans-Bold.ttf);
}
```
`OpenSans-Bold` gives the font's name, which `fonts/OpenSans-Bold.ttf` specifies the location of the font relative to `style.css`. Make sure to keep everything else, including the `url()` and semicolons exactly the same.

Once your font is defined, give the name in the appropriate place in the root settings section.

**Note: The values set in `style.css` apply to every `template`.**

## Creating a template
Each survey screen is defined by a `template`, which describes the option buttons and what they look like. A `template` is an INI file with the following form:

```
[SETTINGS]
header = How Are We Doing?
subheader = Press a button to give us feedback
footer = Your Feedback Matters!
subfooter = We use your feedback to improve our services
recording_interval = 30

[MyFirstOption]
title = Great
icon = icons/3-star_white.png

[MySecondOption]
title = Okay
icon = icons/2-star_white.png

[MyThirdOption]
title = Poor
icon = icons/1-star_white.png
```

### Settings
The `[SETTINGS]` section provides Voting Kiosk with details on how to configure the kiosk for this  question.

| Key | Meaning | Required | Default | Type |
| --- | ------- | -------- | ------- | ---- |
| bottom_height | Percent of the screen that should be used for the footer/subfooter. **Number only** | No | 20 | Number |
| button_height | Percent of the screen that should be used for the row of buttoms. **Number only** | No | 60 | Number |
| footer | The large text at the bottom of the screen | No | - | Text |
| header | The large text at the top of the screen | No | - | Text |
| recording_interval | How many seconds of data to batch for sending to Control Server | No | 60 | Numnber |
| subfooter | The small text at the bottom of hte screen | No | - | Text |
| subheader | The small text at the top of the screen | No | - | Text |
| top_height | Percent of the screen that should be used for the header/subheader. **Number only** | No | 20 | Number |
| touch_cooldown | Number of seconds that must pass before another vote is accepted. This is an anti-spam feature. | No | 2 | Number |

### Options
Each option in the survey is defined by its own INI section. The section header (e.g., `[MyFirstOption]`) sets the name of the column in the resulting CSV.

| Key | Meaning | Required | Default | Type |
| --- | ------- | -------- | ------- | ---- |
| title | Text to appear on the button | No | - | Text |
| icon | Path to an image to be shown on the button | No | - | File path |