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
    name: 'Word_Cloud_' + collectionName,
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

  console.log(definition)

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
  if ('prompt_size' in definition.appearance) {
    document.getElementById('promptText').style.fontSize = definition.appearance.prompt_size + 'vh'
  } else {
    document.getElementById('promptText').style.fontSize = '10vh'
  }
  if ('prompt_color' in definition.appearance) {
    document.getElementById('promptText').style.color = definition.appearance.prompt_color
  } else {
    document.getElementById('promptText').style.color = 'black'
  }
  if ('background_color' in definition.appearance) {
    document.body.style.backgroundColor = definition.appearance.background_color
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

constCommon.configureApp({
  name: 'word_cloud_input',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

let currentDefintion = ''
let collectionName = 'default'

document.getElementById('clearButton').addEventListener('click', clear)
document.getElementById('submitButton').addEventListener('click', sendTexttoServer)
