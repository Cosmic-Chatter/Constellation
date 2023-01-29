# InfoStation
InfoStation provides a touchscreen interface for creating digital labels. It supports text, images, and videos across multiple languages.

## Limitations
* Optimized for use with a vertical 16:9 display powered by a Linux or Windows PC.

## Configuration

### Choosing hardware
InfoStation works best in **_Constellation's_** default, locally-installed mode. This means that it is best to run InfoStation on a Linux or Windows PC connected to the display that you want to use. 

Connecting to a remote instance (such as using an iPad) is supported, but, requires a stable network connection.


### Settings file

To create an instance of InfoStation, you must provide an `INI` file as content. This settings file describes what content you want to display and how it should be organizaed. Let's start with a minimal example:

```ini
[SETTINGS]
languages = en, es
language_en = English
language_es = Español
```

Every InfoStation content should start with a `[SETTINGS]` section. In this case, we are defining that our InfoStation will support two langauges, called `en` and `es`. These shorthand values will be used repeatedly throughout the rest of the file. We then give a written name for each.

Next, let's imagine we are creating an InfoStation to explore the Apollo lunar landings. We might want a section that describes the history, followed by a collection of images and videos to explore.

Let's add this to our settings file:

```ini
[SETTINGS]
languages = en, es
language_en = English
language_es = Español
order = TEXT, PHOTOS, VIDEO
title_en = The Apollo Missions
title_es = Las misiones Apolo
```

The `order` line gives the order the three tabs should be in. Their names will be `TEXT`, `PHOTOS` and `VIDEO`, but we could have called them anythiing. We also give our InfoStation a header title in every language we want to support.

Finally, let's add an attractor. This is a fullscreen image or video that is shown with the InfoStation is idle to attract visitor attention.

```ini
[SETTINGS]
languages = en, es
language_en = English
language_es = Español
order = TEXT, PHOTOS, VIDEO
title_en = The Apollo Missions
title_es = Las misiones Apolo
attractor = content/attractor.mp4
timeout = 30
```

Here, we are saying that we have placed the file `attractor.mp4` into the content directory and that this file should be shows after 30 secodns of no interaction. If a video is playing, the 30-second timer won't start until after the vidoe is complete.

It's now time to point InfoStation to the rest of our content. Let's start with the text tab:

```ini
[SETTINGS]
...

[TEXT]
type = text
title_en = History
title_es = Historia
content_en = content/history_en.md
content_es = content/history_es.md
```

Again, we give a title in each of ouro supported languages. Then, we point InfoStation to a text file giving the content.

Now, let's do the same for the `PHOTOS` and `VIDEO` tabs:

```ini
[SETTINGS]
...

[TEXT]
type = text
title_en = History
title_es = Historia
content_en = content/history_en.md
content_es = content/history_es.md

[PHOTOS]
type = image
title_en = Images
title_es = Imágenes
content_en = content/photos_en.ini
content_es = content/photos_es.ini

[VIDEO]
type = video
title_en = Videos
title_es = Vídeos
content_en = content/video_en.ini
content_es = content/video_es.ini
```

With all that done, your settings file is complete! But the InfoStation isn't ready yet. We still need to detail the content for each of these sections.

### Text tabs

Text tabs use a text file to describe their content. This text file should be formatted as a [Markdown file](https://www.markdownguide.org/basic-syntax/). Markdown is a powerful way of formatting text using simple symbols, but let's go over just a few of the basics.

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

`placement` should be one of `left`, `right`, or `full` and the title must be in quotes.

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

### Options
