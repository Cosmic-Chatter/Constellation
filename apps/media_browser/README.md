# Media Browser
Media Browser provides a touch-screen interface for browsing large sets of images.

## Configuration

### Describing your media
Using Media Browser requires creating a simple spreadsheet that describes your files. This spreadsheet will guide the app in arranging the content you wish to display. It must be saved in comma-separated value (`CSV`) format and placed in your standard **_Constellation_** `content` directory. Microsoft Excel, Apple Numbers, LibreOffice Calc, and other apps can save `CSV` files.

A simple spreadsheet might look like this:

| File             | Name    | Image credit | Caption                                                                   |
|------------------|---------|--------------|---------------------------------------------------------------------------|
| Mercury.jpg      | Mercury | NASA         | Mercury is the cloest planet to the Sun.                                  |
| Venus.png        | Venus   | NASA         | Venus is the hottest planet in the solar system.                          |
| Blue Marble.jpeg | Earth   | USGS         | This image of Earth is made of multiple Landsat images stitched together. |
| Mars.png         | Mars    | ESA          | Mars is the best-explored planet beyond Earth.                            |
| Jupiter.png      | Jupiter | NASA         | Jupiter is the largest planet in the solar system.                        |
 | Saturn.png       | Saturn  | NASA         | Saturn has the most impressive ring system in the solar system.           |
| Uranus.jpeg      | Uranus  | NASA         | Uranus is the only planet to orbit on its side.                           |
| Neptune.jpg      | Neptune | NASA         | Neptune is the farthest planet in the solar system.                       |
 | Pluto.jpg        | Pluto   | NASA         | Pluto is the best-studied Kuiper belt object.                             |

Each line in the spreadsheet will represent one item in the browser. The name of each column is called its `key`. The media files (listed here under the `File` key) should be placed in the standard **_Constellation_** `content` directory.
                         |

#### Thumbnails
The thumbnail is the first representation of the item that your user will see. If you upload your files through the web interface, **_Constellation_** will create a thumbnail for you. For more control over the thumbnails, you may provide your own. To do this, place these files in the `thumbnails` directory. They must have the same filename as the main image, and use the JPEG extension `.jpg`.