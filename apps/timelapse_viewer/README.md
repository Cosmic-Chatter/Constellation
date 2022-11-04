# Timelapse Viewer
Timelapse Viewer provides a flexible interface for exploring and animating timelapse content.

## Limitations
* Only supports images sequences, not video files.
  * You can easily split any video into its frames using freely available tools.
* Runs best on a Linux or Windows PC, not an iPad.
## Configuration

### Choosing hardware
Timelapse Viewer works best in **_Constellation's_** default, locally-installed mode. This means that it is best to run Timelapse Viewer on a Linux or Windows PC connected to the display that you want to use. 

Connecting to a remote instance (such as using an iPad) is supported, but, since every frame of the animation must be transmitted over the network, performance is often less than ideal.

#### Supported inputs
Timelapse Viewer supports the following ways of interacting with the animation. There is no need to turn anything on—all methods are always active.
* **Touchscreen**
  * Swipe left and right to move forwards and backwards through the animation.
* **Mouse scroll**
  * Scroll the wheel to move forwards and backwards.
* **Mouse click-and-drag**
  * While holding the left mouse button, move the mouse left and right to move forwards and backwards.
  * The mouse cursor will not appear on the screen.
* **Arrow keys**
  * Move forwards and backwards using up/down or left/right on the keyboard.

### Configuring your media
Timelapse Viewer animates sequences of images. These images should be numbered sequentially in the order that they should be viewed. These files should be added to the standard **_Constellation_** `content` folder:

```
content/
    myImage_0001.jpg
    myImage_0002.jpg
    ...
    myImage_1949.jpg
```

For best performance, resize your images to be no larger than the resolution of your display and use a common image format such as JPEG.

### Options
You tell Timelapse Viewer what to display and how to display it using an `INI` file placed in the standard `content` directory.

This file must contain the required key `files`, which gives the names of the files you want to animate. Once your files are named sequentially, you mark the location of the numbers with an asterisk `*` (This asterisk is a standard wildcard). 

For example, if your files are `frame_0001.jpeg, frame_0002.jpeg, ..., frame_0240.jpeg`, then you would add `files = frame_*.jpeg` to your `INI` file.

```
[SETTINGS]
files = myImages_*.jpg
animation_length = 15
attractor_timeout = 20
```

Every `INI` file must begin with the header `[SETTINGS]`. Each line then defines one option for Timelapse Viewer.

#### Available keys
| Name              | Required | Default                      | Meaning                                                                       |
|-------------------|----------|------------------------------|-------------------------------------------------------------------------------|
| files             | Yes      | -                            | The name of the files to be displayed, using a wildcard (`*`).                |
 | animation_length  | No       | Dependent on number of files | The duration in seconds of the animation.                                     | 
 | attractor_timeout | No       | 30                           | The number of seconds to wait after interaction to begin the animation again. |