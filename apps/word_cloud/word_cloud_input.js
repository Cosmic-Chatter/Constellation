/* global swearList */

import * as constCommon from '../js/constellation_app_common.js'

function clear () {
  $('#inputField').val('')
  keyboard.input.default = ''
  keyboard.input.inputField = ''
}

function getCleanText () {
  // Run the profanity checker on the input field

  $('#profanityCheckingDiv').html($('#inputField').val()).profanityFilter({ customSwears: swearList, replaceWith: '#' })
  $('#profanityCheckingDiv').html($('#profanityCheckingDiv').html().replace(/#/g, ''))
  console.log($('#profanityCheckingDiv').html().trim())
  return ($('#profanityCheckingDiv').html().trim())
}

function sendTextToServer () {
  // Send the server the text that the user has inputted
  const text = getCleanText()
  const requestDict = {
    name: 'Word_Cloud_' + collectionName,
    text
  }

  if (constCommon.config.standalone === false) {
    constCommon.makeServerRequest(
      {
        method: 'POST',
        endpoint: '/tracker/flexible-tracker/submitRawText',
        params: requestDict
      })
      .then((result) => {
        if ('success' in result && result.success === true) {
          clear()
        }
      })
  } else {
    constCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/data/writeRawText',
      params: requestDict
    })
      .then((result) => {
        if ('success' in result && result.success === true) {
          clear()
        }
      })
  }
}

function updateFunc (update) {
  // Read updates for word cloud-specific actions and act on them

  // This should be last to make sure the path has been updated
  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    constCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Set up a new interface to collect input

  // Parse the settings and make the appropriate changes
  if ('prompt' in definition.content) {
    document.getElementById('promptText').innerHTML = definition.content.prompt
  } else {
    document.getElementById('promptText').innerHTML = ''
  }
  if ('collection_name' in definition.behavior) {
    collectionName = definition.behavior.collection_name
  } else {
    collectionName = 'default'
  }

  // Localization options
  if ('placeholder' in definition.content.localization && definition.content.localization.placeholder.trim() !== '') {
    document.getElementById('inputField').placeholder = definition.content.localization.placeholder
  } else {
    document.getElementById('inputField').placeholder = 'Type to enter response'
  }
  if ('clear' in definition.content.localization && definition.content.localization.clear.trim() !== '') {
    document.getElementById('clearButton').innerHTML = definition.content.localization.clear
  } else {
    document.getElementById('clearButton').innerHTML = 'Clear'
  }
  if ('submit' in definition.content.localization && definition.content.localization.submit.trim() !== '') {
    document.getElementById('submitButton').innerHTML = definition.content.localization.submit
  } else {
    document.getElementById('submitButton').innerHTML = 'Submit'
  }
  if ('backspace' in definition.content.localization && definition.content.localization.backspace.trim() !== '') {
    document.querySelector('.hg-button-bksp').querySelector('span').innerHTML = definition.content.localization.backspace
  } else {
    document.querySelector('.hg-button-bksp').querySelector('span').innerHTML = 'backspace'
  }

  const root = document.querySelector(':root')

  // Color settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#ffffff')
  root.style.setProperty('--prompt-color', '#000')
  root.style.setProperty('--input-color', '#000')
  root.style.setProperty('--input-background-color', '#e9ecef')
  root.style.setProperty('--submit-background-color', '#6c757d')
  root.style.setProperty('--submit-color', '#ffffff')
  root.style.setProperty('--clear-background-color', '#6c757d')
  root.style.setProperty('--clear-color', '#ffffff')
  root.style.setProperty('--keyboard-key-color', '#000')
  root.style.setProperty('--keyboard-key-background-color', '#fff')
  root.style.setProperty('--keyboard-background-color', '#ececec')

  // Then, apply the definition settings
  if ('color' in definition.appearance) {
    Object.keys(definition.appearance.color).forEach((key) => {
      const value = definition.appearance.color[key]
      root.style.setProperty('--' + key + '-color', value)
    })
  }

  // Backgorund settings
  if ('background' in definition.appearance) {
    constCommon.setBackground(definition.appearance.background, root, '#fff')
  }

  // Font settings
  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--prompt-font', 'prompt-default')
  root.style.setProperty('--input-font', 'input-default')
  root.style.setProperty('--submit-font', 'submit-default')
  root.style.setProperty('--clear-font', 'clear-default')

  // Then, apply the definition settings
  if ('font' in definition.appearance) {
    Object.keys(definition.appearance.font).forEach((key) => {
      const font = new FontFace(key, 'url(' + encodeURI(definition.appearance.font[key]) + ')')
      document.fonts.add(font)
      root.style.setProperty('--' + key + '-font', key)
    })
  }

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--prompt-font-adjust', 0)

  // Then, apply the definition settings
  if ('text_size' in definition.appearance) {
    Object.keys(definition.appearance.text_size).forEach((key) => {
      const value = definition.appearance.text_size[key]
      root.style.setProperty('--' + key + '-font-adjust', value)
    })
  }

  // Send a thumbnail to the helper
  setTimeout(() => constCommon.saveScreenshotAsThumbnail(definition.uuid + '.png'), 100)
}

const Keyboard = window.SimpleKeyboard.default

// Add a listener to each input so we direct keyboard input to the right one
document.querySelectorAll('.input').forEach(input => {
  input.addEventListener('focus', onInputFocus)
})
function onInputFocus (event) {
  keyboard.setOptions({
    inputName: event.target.id
  })
}
function onInputChange (event) {
  keyboard.setInput(event.target.value, event.target.id)
}
function onKeyPress (button) {
  if (button === '{lock}' || button === '{shift}') handleShiftButton()
}
document.querySelector('#inputField').addEventListener('input', event => {
  keyboard.setInput(event.target.value)
})
function onChange (input) {
  document.querySelector('#inputField').value = input
}

const keyboard = new Keyboard({
  onChange: input => onChange(input),
  onKeyPress: button => onKeyPress(button),
  layout: {
    default: [
      'Q W E R T Y U I O P',
      'A S D F G H J K L',
      'Z X C V B N M {bksp}',
      '{space}'
    ]
  }
})

constCommon.configureApp({
  name: 'word_cloud_input',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

let currentDefintion = ''
let collectionName = 'default'

document.getElementById('clearButton').addEventListener('click', clear)
document.getElementById('submitButton').addEventListener('click', sendTextToServer)
