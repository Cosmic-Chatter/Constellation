# InfoStation
InfoStation provides a touchscreen interface for creating digital labels. It supports text, images, and videos across multiple languages.

## Limitations
* Optimized for use with a vertical 16:9 display powered by a Linux or Windows PC.

## Configuration

### Choosing hardware
InfoStation works best in **_Constellation's_** default, locally-installed mode. This means that it is best to run InfoStation on a Linux or Windows PC connected to the display that you want to use. 

Connecting to a remote instance (such as using an iPad) is supported, but, requires a stable network connection.

### Text tabs

Text tabs format text using [Markdown](https://www.markdownguide.org/basic-syntax/). Markdown is a powerful way of formatting text using simple symbols, but let's go over just a few of the basics.

Here is some simple text formatted with Markdown:

```md
# The Space Race
The Space Race was a competition between the United States and Soviet Union for scientific and technological preeminence in space that extended from the early 1950s until 1975.

[left](content/Sputnik.jpg "A model of the Sputnik 1 satellite.")

Milestones during the Space Race included the launch of **Sputnik 1** by the U.S.S.R in 1957, the landing of _Eagle_ on the surface of the Moon as part of **Apollo 11**, and the joint U.S.-U.S.S.R **Apollo-Soyuz Test Project** in 1975.

## First Steps
...
```
Markdown uses the `#` symbol to indicate headers. The headers get smaller as symbols are added, so `#` is a bigger header than `##` and so forth. Text is italicized by placing underscores around it (`_italics_`) and bolded using asterisks (`**bold**`). Finally, you can embed and place images following this pattern:

```md
[placement](file_path "Title")
```

`placement` should be one of `left`, `right`, or `full` and the title must be in quotes. Images should be uploaded as content and the `file_path` should begin with `content/` as shown above.

InfoStation will break up the text into sections defined by top-level headers (`#`).

### Image tabs

Image tabs are defined using an `INI` file. The file should contain a series of sections, each of which defines a single image as such:

```ini
[Sputnik]
image = content/Sputnik.jpg
thumb = thumbnails/Sputnik.jpg
caption = A model of Sputnik 1.
title = Sputnik 1
credit = NSSDC, NASA

[JFK]
image = content/JFK.webp
thumb = thumbnails/JFK.jpg
caption = President John F. Kennedy delivered his famous "We choose to go to the Moon" speech at Rice University on September 12, 1962.
title = We choose to go to the Moon
credit = NASA
```

### Video tabs

Video tabs are defined using an `INI` file. The file should contain a series of sections, each of which defines a single video as such:

```ini
[Video 1]
video = content/SaturnV.mp4
thumb = content/SaturnV_thumb.webp
caption = A video for a Saturn V launch.
title = Saturn V Launch
credit = NASA

[Video 2]
video = content/CSM.mp4
thumb = content/CSM_thumb.webp
caption = A video of the Command and Service modules.
title = Command and Service Modules
credit = NASA
```