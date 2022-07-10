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

**Note: At this time, the values set in `style.css` apply to every `template`.**

## Creating a template
Each survey screen is defined by a `template`, which describes the option buttons and what they look like.
