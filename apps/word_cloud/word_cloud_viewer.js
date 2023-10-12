/* global swearList, pluralize, WordCloud */

import * as constCommon from '../js/constellation_app_common.js'

function cleanText (text) {
  // Converver to lowercase and remove special characters, while attempting
  // to retain apostrophes that are part of names. E.g., ja'mar
  // Then, check the text for profanity

  const simpleText = text.toLowerCase().replace(/'\B|[^a-z'? ]/g, ' ')
  $('#profanityCheckingDiv').html(simpleText).profanityFilter({ customSwears: swearList, replaceWith: '#' })
  $('#profanityCheckingDiv').html($('#profanityCheckingDiv').html().replace(/#/g, ''))
  return ($('#profanityCheckingDiv').html().trim())
}

function countText (text) {
  // Segment the text into words and count word frequency, attempting to
  // combine different variants of the same word.

  const ignoreList = ['a', 'about', 'all', 'also', 'am', 'and', 'as', 'at', 'be',
    'because', 'but', 'by', 'can', 'come', 'could', 'even',
    'find', 'for', 'from', 'get', 'go', 'have',
    'here', 'how', 'i', 'if', 'in',
    'into', 'is', 'it', 'its', 'just', 'like', 'look', 'make',
    'many', 'more', 'my', 'not', 'of', 'on', 'one',
    'only', 'or', 'so', 'some', 'than', 'that', 'the', 'their',
    'them', 'then', 'there', 'these', 'they', 'thing',
    'this', 'those', 'to', 'very', 'with', 'which', 'would']

  const result = {}

  text.split(' ').forEach((item) => {
    if (item !== '') {
      // Make sure we have a singular form
      const word = pluralize.singular(item)
      if (word in result) {
        result[word] += 1
      } else {
        if (!ignoreList.includes(word)) {
          result[word] = 1
        }
      }
    }
  })

  return result
}

function createWordCloud () {
  WordCloud(divForWC, WordCloudOptions)
}

function createWordList (textDict) {
  // Take a dictionary of the form {"word": num_occurances} and convert it
  // into the nested list required by the wordcloud

  let maxValue = 0
  Object.keys(textDict).forEach((item) => {
    if (textDict[item] > maxValue) {
      maxValue = textDict[item]
    }
  })
  // Then, format the list, scaling each value to the range [3, 9]
  const wordList = []
  Object.keys(textDict).forEach((item) => {
    wordList.push([item, 6 * textDict[item] / maxValue + 3])
  })
  return (wordList)
}

function getTextUpdateFromServer () {
  // Ask the server to send the latest raw text, then trigger the wordcloud
  // to rebuild

  if (constCommon.config.standalone === false) {
    // If this app is running ina preview frame for setup, we won't have a valid
    // server IP address. Default to the built-in word list for testing.
    if (constCommon.config.serverAddress === '') {
      WordCloudOptions.list = createWordList(animalDict)
      createWordCloud()
      return
    }

    constCommon.makeServerRequest(
      {
        method: 'POST',
        endpoint: '/tracker/flexible-tracker/getRawText',
        params: { name: 'Word_Cloud_' + collectionName }
      })
      .then((result) => {
        if ('success' in result && result.success === true) {
          if ('text' in result && result.text !== '') {
            WordCloudOptions.list = createWordList(countText(cleanText(result.text)))
          }
        }
        createWordCloud()
      })
  } else {
    constCommon.makeHelperRequest(
      {
        method: 'POST',
        endpoint: '/data/getRawText',
        params: { name: 'Word_Cloud_' + collectionName }
      })
      .then((result) => {
        if ('success' in result && result.success === true) {
          if ('text' in result && result.text !== '') {
            WordCloudOptions.list = createWordList(countText(cleanText(result.text)))
          }
        }
        createWordCloud()
      })
  }
}

function updateFunc (update) {
  // Read updates for word cloud-specific actions and act on them

  if ('definition' in update && update.definition !== currentDefinition) {
    currentDefinition = update.definition
    constCommon.loadDefinition(currentDefinition)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Clean up the old word cloud, then create the new one.

  // Parse the settings and make the appropriate changes
  const promptText = document.getElementById('promptText')
  const wordCloudContainer = document.getElementById('wordCloudContainer')

  if ('prompt' in definition.content) {
    promptText.innerHTML = definition.content.prompt
    promptText.classList.replace('promptText-none', 'promptText-full')
    wordCloudContainer.classList.add('wordCloudContainer-small')
    wordCloudContainer.classList.remove('wordCloudContainer-full')
  } else {
    promptText.innerHTML = ''
    promptText.classList.replace('promptText-full', 'promptText-none')
    wordCloudContainer.classList.add('wordCloudContainer-full')
    wordCloudContainer.classList.remove('wordCloudContainer-small')
  }

  if ('collection_name' in definition.behavior) {
    collectionName = definition.behavior.collection_name
  } else {
    collectionName = 'default'
  }

  if ('refresh_rate' in definition.behavior) {
    const newRate = parseFloat(definition.behavior.refresh_rate)
    if (newRate !== textUpdateRate) {
      textUpdateRate = newRate
      clearInterval(textUpdateTimer)
      textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)
    }
  } else {
    if (textUpdateRate !== 15) {
      textUpdateRate = 15
      textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)
    }
  }

  if ('rotation' in definition.appearance) {
    if (definition.appearance.rotation === 'horizontal') {
      WordCloudOptions.minRotation = 0
      WordCloudOptions.maxRotation = 0
    } else if (definition.appearance.rotation === 'right_angles') {
      WordCloudOptions.minRotation = 1.5708
      WordCloudOptions.maxRotation = 1.5708
      WordCloudOptions.rotationSteps = 2
    } else {
      WordCloudOptions.minRotation = -1.5708
      WordCloudOptions.maxRotation = 1.5708 // 6.2821
      WordCloudOptions.rotationSteps = 100
      WordCloudOptions.rotateRatio = 0.5
    }
  } else {
    // Set horizontal only
    WordCloudOptions.minRotation = 0
    WordCloudOptions.maxRotation = 0
  }

  if ('cloud_shape' in definition.appearance) {
    WordCloudOptions.shape = definition.appearance.cloud_shape
  } else {
    WordCloudOptions.shape = 'circle'
  }

  const root = document.querySelector(':root')

  // Color settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#ffffff')
  WordCloudOptions.backgroundColor = '#ffffff'
  root.style.setProperty('--prompt-color', '#000')

  // Then, apply the definition settings
  if ('color' in definition.appearance) {
    if ('prompt' in definition.appearance.color) {
      root.style.setProperty('--prompt-color', definition.appearance.color.prompt)
    }
    if ('background' in definition.appearance.color) {
      root.style.setProperty('--background-color', definition.appearance.color.background)
      WordCloudOptions.backgroundColor = definition.appearance.color.background
    }
    if ('words' in definition.appearance.color) {
      WordCloudOptions.color = definition.appearance.color.words
    } else {
      WordCloudOptions.color = 'random-dark'
    }
  }

  // Font settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--prompt-font', 'prompt-default')
  WordCloudOptions.fontFamily = 'words-default'

  // Then, apply the definition settings
  if ('font' in definition.appearance) {
    if ('prompt' in definition.appearance.font) {
      const font = new FontFace('prompt', 'url(' + encodeURI(definition.appearance.font.prompt) + ')')
      document.fonts.add(font)
      root.style.setProperty('--prompt-font', 'prompt')
    }
    if ('words' in definition.appearance.font) {
      const font = new FontFace('words', 'url(' + encodeURI(definition.appearance.font.words) + ')')
      document.fonts.add(font)
      WordCloudOptions.fontFamily = 'words'
    }
  }

  if ('text_size' in definition.appearance && 'prompt' in definition.appearance.text_size) {
    root.style.setProperty('--prompt-font-adjust', definition.appearance.text_size.prompt)
  } else {
    root.style.setProperty('--prompt-font-adjust', 0)
  }

  getTextUpdateFromServer()

  // Send a thumbnail to the helper
  setTimeout(() => constCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 3000)
}

const divForWC = document.getElementById('wordCloudContainer')
const WordCloudOptions = {
  color: 'random-dark',
  gridSize: Math.round(16 * $(divForWC).width() / 1024),
  list: createWordList({ test: 1 }),
  weightFactor: function (size) {
    return Math.pow(size, 2.3) * $(divForWC).width() / 1024
  },
  drawOutOfBound: false,
  minRotation: 1.5708,
  maxRotation: 1.5708,
  rotationSteps: 2,
  rotateRatio: 0.125,
  shrinkToFit: true,
  shuffle: true,
  backgroundColor: 'white',
  fontFamily: 'words-default'
}

let currentDefinition = ''
let collectionName = 'default'
let textUpdateRate = 15

constCommon.configureApp({
  name: 'word_cloud_viewer',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

let textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)

const animalDict = {
  dog: 108,
  cat: 94,
  pony: 71,
  horse: 63,
  butterfly: 62,
  moose: 61,
  penguin: 51,
  dolphin: 46,
  fox: 40,
  elk: 39,
  lion: 37,
  tiger: 35,
  deer: 35,
  leopard: 34,
  turtle: 28,
  snake: 25,
  robin: 19,
  seagull: 19,
  parrot: 18,
  jellyfish: 16,
  kangaroo: 15,
  coyote: 15,
  rabbit: 11,
  moth: 7,
  snail: 6,
  zebra: 5,
  beetle: 5,
  bear: 4,
  hare: 4,
  lizard: 3,
  tuna: 2,
  donkey: 1,
  slug: 1
}
