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

function sendTexttoServer () {
  // Send the server the text that the user has inputted
  const text = getCleanText()
  const requestDict = {
    name: 'Word_Cloud_' + collectionNmae,
    text
  }

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
  } else {
    document.getElementById('promptText').innerHTML = ''
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
  } else {
    document.body.style.backgroundColor = 'white'
  }
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

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/apps/word_cloud/version.txt'
constCommon.config.constellationAppID = 'word_cloud'
constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

let currentContent = {}
let collectionNmae = 'default'

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
setInterval(constCommon.sendPing, 5000)

document.getElementById('clearButton').addEventListener('click', clear)
document.getElementById('submitButton').addEventListener('click', sendTexttoServer)
