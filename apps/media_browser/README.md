# Media Browser
Media Browser provides a touch-screen interface for browsing, searching, and filtering large sets of images and videos.

## Limitations
- Multiple languages are not currently supported.
- The interface is optimized for a landscape 16:9 display.
  - Portrait 16:9 displays work reasonably well.
  - 4:3 displays such as the iPad do not display well.
- 4K resolution is poorly supported.
  - If you are using a 4K display, set it to 1080P for best results.
- It is assumed that you are using a touchscreen.

## Configuration

### Describing your media
Using Media Browser requires creating a simple spreadsheet that describes your files. This spreadsheet will guide the app in arranging the content you wish to display. It must be saved in comma-separated value (`CSV`) format and placed in your standard **_Constellation_** `content` directory. Microsoft Excel, Apple Numbers, LibreOffice Calc, and other apps can save `CSV` files.

A simple spreadsheet might look like this:

| File             | Name    | Image credit | Type         | Has Moons |
|------------------|---------|--------------|--------------|-----------|
| Mercury.jpg      | Mercury | NASA         | Rocky planet | No        |
| Venus.png        | Venus   | NASA         | Rocky planet | No        |
| Blue Marble.jpeg | Earth   | USGS         | Rocky planet | Yes       |
| Mars.png         | Mars    | ESA          | Rocky planet | Yes       |
| Jupiter.png      | Jupiter | NASA         | Gas planet   | Yes       |
 | Saturn.png       | Saturn  | NASA         | Gas planet   | Yes       |
| Uranus.jpeg      | Uranus  | NASA         | Gas planet   | Yes       |
| Neptune.jpg      | Neptune | NASA         | Gas planet   | Yes       | 
 | Pluto.jpg        | Pluto   | NASA         | Dwarf planet | Yes       |

Each line in the spreadsheet will represent one item in the browser. The name of each column is called its `key`. The media files (listed here under the `File` key) should be placed in the standard **_Constellation_** `content` directory.

### Describing the browser
A given set of media can be displayed by Media Browser in multiple ways. Your desired way is defined by an `INI` file. The `INI` file connects `keys` in your spreadsheet with various display options in the browser. It should be placed in your `content` directory with the other files. An example `INI` file for the above table would be:

```
[SETTINGS]
data = planet_data.csv
attractor = my_attracor.mp4
media_key = File
title_key = Name
credit_key = Image credit
filter_keys = Type, Has Moons
search_keys = Name
```

Every `INI` file must begin with the header `[SETTINGS]`. Each line then connects one aspect of Media Browser with something from your spreadsheet.

In addition to connecting Media Browser to your `keys`, there are two special lines. The `data` line gives the filename of your spreadsheet. The `attractor` key gives the name of an optional video file in your `content` directory that will be the "cover image" for this `component`.

#### Available keys
| Name          | Required            | Default             | Meaning                                                                                      |
|---------------|---------------------|---------------------|----------------------------------------------------------------------------------------------|
| attractor     | No                  | -                   | A video file that serves as your attractor                                                   |
 | data          | Yes                 | -                   | The filename of your `CSV` spreadsheet                                                       | 
 | caption_key   | No                  | Caption             | A text caption for the media file.                                                           |
| credit_key    | No                  | Credit              | A credit line for the media file.                                                            | 
 | filter_keys   | No                  | -                   | A column-separated list of keys that should be turned into filterable options                |
| filter_titles | No                  | -                   | Comma separated list of titles for the different filters, in the same order as `filter_keys` |
 | media_key     | No                  | Media               | The column listing hte filenames for the media files.                                        |
| search_keys   | No                  | Title               | A comma-separated list of keys to use when searching.                                        | 
| thumbnail_key | Yes if using videos | Same as `media_key` | The names of the file thumbnails.                                                            |
| title_key     | No                  | Title               | The name of the column giving the name of the item.                                          |

#### A special note on thumbnails
The thumbnail is the first representation of the item that your user will see. **Thumbnails are always images, regardless of the kind of media you are using**.

If your media are only images, you have two options:
1. **Use the default **_Constellation_** thumbnails.** Note that these may be lower resolution than you want to use.
2. **Provide your own thumbnails.** Place these files in the standard **_Constellation_** `thumbnails` directory. This allows you to use your desired resolution, shape, and image.

If your media includes videos, you must provide your own thumbnails in the `thumbnails` directory. These must be listed in a column in your spreadsheet, and you must set the `thumbnail_key` item in the `INI` file.