# Word Cloud
Word Cloud provides an interface to collect visitor responses and then turns them into a word cloud. Profanity-checking is built-in.

## Limitations
* Input only supports devices in a landscape orientation.
* Profanity-checking is never 100%.

## Configuration

### Options
Both the input kiosk and viewer are configured using a definition file in the form of an `INI` file selected as the component's `content`. An example definition is:

```ini
[SETTINGS]
prompt = What is your favorite animal?
collection_name = WC_animals
prompt_size = 9
prompt_color = #348ceb
background_color = black
word_colors = random-light
refresh_rate = 30
```

Every `INI` file must begin with the header `[SETTINGS]`. Each line then defines one option.

#### Available options
| Name             | Input | Viewer | Default     | Meaning                                                                                                                                                          |
|------------------|-------|--------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| prompt           | Yes   | Yes    | -           | The text prompt for visitors to answer.                                                                                                                          |
| collection_name  | Yes   | Yes    | default     | A unique name for this activity that must be the same for both the input kiosk and viewer.                                                                       |
| prompt_size      | Yes   | Yes    | 10          | The font size for the prompt (in percent of vertical screen size).                                                                                               |
| prompt_color     | Yes   | Yes    | black       | The color of the prompt (either a color name or a hex code).                                                                                                     |
| background_color | Yes   | Yes    | white       | The color of the background (either a color name or a hex code).                                                                                                 |
| word_colors      | No    | Yes    | random-dark | The colors of the words in the viewer. This can be a single color, a comma-separated list of colors, or one of two special options: random-dark or random-light. |
| refresh_rate     | No    | Yes    | 15          | Interval (in seconds) between retrieving updates to the word list.                                                                                               |