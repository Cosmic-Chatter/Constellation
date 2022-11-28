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
  wc = WordCloud(divForWC, wc_options)
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

  constCommon.makeServerRequest(
    {
      method: 'POST',
      endpoint: '/tracker/flexible-tracker/getRawText',
      params: { name: 'Word_Cloud_' + collectionNmae }
    })
    .then((result) => {
      if ('success' in result && result.success == true) {
        if ('text' in result && result.text !== '') {
          wc_options.list = createWordList(countText(cleanText(result.text)))
        }
      }
      createWordCloud()
    })
}

function updateFunc (update) {
  // Read updates for word cloud-specific actions and act on them

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    if (!constCommon.arraysEqual(update.content, currentContent)) {
      currentContent = update.content

      // Get the file from the helper and build the interface
      const definition = currentContent[0] // Only one INI file at a time

      constCommon.makeHelperRequest(
        {
          method: 'GET',
          endpoint: '/content/' + definition,
          rawResponse: true
        })
        .then((response) => {
          updateContent(definition, constCommon.parseINIString(response))
        })
    }
  }
}

function updateContent (name, definition) {
  // Clean up the old survey, then create the new one.

  // Parse the settings and make the appropriate changes
  if ('prompt' in definition.SETTINGS) {
    document.getElementById('promptText').innerHTML = definition.SETTINGS.prompt
    $('#promptText').addClass('promptText-full').removeClass('promptText-none')
    $('#wordCloudContainer').addClass('wordCloudContainer-small').removeClass('wordCloudContainer-full')
  } else {
    document.getElementById('promptText').innerHTML = ''
    $('#promptText').removeClass('promptText-full').addClass('promptText-none')
    $('#wordCloudContainer').addClass('wordCloudContainer-full').removeClass('wordCloudContainer-small')
  }
  if ('collection_name' in definition.SETTINGS) {
    collectionNmae = definition.SETTINGS.collection_name
  } else {
    collectionNmae = 'default'
  }
  if ('prompt_size' in definition.SETTINGS) {
    document.getElementById('promptText').style.fontSize = definition.SETTINGS.prompt_size + 'vh'
  } else {
    document.getElementById('promptText').style.fontSize = '10vh'
  }
  if ('prompt_color' in definition.SETTINGS) {
    document.getElementById('promptText').style.color = definition.SETTINGS.prompt_color
  } else {
    document.getElementById('promptText').style.color = 'black'
  }
  if ('background_color' in definition.SETTINGS) {
    document.body.style.backgroundColor = definition.SETTINGS.background_color
    wc_options.backgroundColor = definition.SETTINGS.background_color
  } else {
    document.body.style.backgroundColor = 'white'
    wc_options.backgroundColor = 'white'
  }
  if ('word_colors' in definition.SETTINGS) {
    setCustomColors(definition.SETTINGS.word_colors)
  } else {
    wc_options.color = 'random-dark'
  }
  if ('refresh_rate' in definition.SETTINGS) {
    if (parseFloat(definition.SETTINGS.refresh_rate) !== textUpdateRate) {
      textUpdateRate = parseFloat(definition.SETTINGS.refresh_rate)
      clearInterval(textUpdateTimer)
      textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)
    }
  } else {
    if (textUpdateRate !== 15) {
      textUpdateRate = 15
      textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)
    }
  }
}

function setCustomColors (colorStr) {
  // Parse a string taken from the INI file and use it to set colors
  console.log(colorStr)
  const split = colorStr.split(',')

  if (split.length === 1) {
    // Assume this is the color we want
    wc_options.color = split[0].trim()
  } else if (split.length > 1) {
    // Build a simple function to return colors, per the WordCloud2 spec
    const colorList = []
    split.forEach(item => {
      colorList.push(item.trim())
    })
    const colorFunc = function (word, weight, fontSize, distance, theta) {
      // Return a random color each time
      return colorList[Math.floor(Math.random() * colorList.length)]
    }
    wc_options.color = colorFunc
  } else {
    wc_options.color = 'random-dark'
  }
}

const divForWC = document.getElementById('wordCloudContainer')
let wc = null // This will hold the reference to the wc generator
var wc_options = {
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
  backgroundColor: 'white'
}

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.constellationAppID = 'word_cloud'
constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

let currentContent = {}
let collectionNmae = 'default'
let textUpdateRate = 15

constCommon.askForDefaults()
  .then(() => {
    setTimeout(getTextUpdateFromServer, 1000)
  })
constCommon.checkForSoftwareUpdate()
setInterval(constCommon.sendPing, 5000)

let textUpdateTimer = setInterval(getTextUpdateFromServer, textUpdateRate * 1000)
