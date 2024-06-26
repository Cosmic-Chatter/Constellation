/* global Coloris */

import * as constCommon from '../js/constellation_app_common.js'
import * as constSetup from '../js/constellation_setup_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'

function initializeDefinition () {
  // Create a blank definition at save it to workingDefinition.

  return new Promise(function (resolve, reject) {
    // Get a new temporary uuid
    constCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/uuid/new'
    })
      .then((response) => {
        $('#definitionSaveButton').data('initialDefinition', {
          uuid: response.uuid,
          appearance: {
            background: {
              mode: 'color',
              color: '#fff'
            }
          },
          attractor: {},
          behavior: {},
          content: {
            localization: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          appearance: {
            background: {
              mode: 'color',
              color: '#fff'
            }
          },
          attractor: {},
          behavior: {},
          content: {
            localization: {}
          }
        })
        constSetup.previewDefinition(false)
        resolve()
      })
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await initializeDefinition()
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('collectionNameInput').value = ''

  // Content details
  document.getElementById('promptInput').value = ''
  Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
    el.value = ''
  })

  // Attractor details
  // document.getElementById('attractorInput_attractor_timeout').value = 30

  // Reset color options
  const colorInputs = ['input', 'input-background', 'submit', 'submit-background', 'clear', 'clear-background', 'prompt', 'keyboard-key', 'keyboard-key-background', 'keyboard-background']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })
  constSetup.updateAdvancedColorPicker('appearance>background', {
    mode: 'color',
    color: '#fff',
    gradient_color_1: '#fff',
    gradient_color_2: '#fff'
  })

  // Reset font face options
  constSetup.resetAdvancedFontPickers()

  document.getElementById('promptTextSizeSlider').value = 0
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = constSetup.getDefinitionByUUID(uuid)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)
  if ('collection_name' in def.behavior) {
    document.getElementById('collectionNameInput').value = def.behavior.collection_name
  } else {
    document.getElementById('collectionNameInput').value = ''
  }

  // Content
  if ('prompt' in def.content) {
    document.getElementById('promptInput').value = def.content.prompt
  } else {
    document.getElementById('promptInput').value = ''
  }

  Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
    const property = el.getAttribute('data-property')
    if (property in def.content.localization) el.value = def.content.localization[property]
  })

  // Set the appropriate values for the attractor fields

  // Set the appropriate values for the color pickers
  if ('color' in def.appearance) {
    Object.keys(def.appearance.color).forEach((key) => {
      $('#colorPicker_' + key).val(def.appearance.color[key])
      document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.appearance) {
    constSetup.updateAdvancedColorPicker('appearance>background', def.appearance.background)
  }

  // Set the appropriate values for the advanced font pickers
  if ('font' in def.appearance) {
    Object.keys(def.appearance.font).forEach((key) => {
      const picker = document.querySelector(`.AFP-select[data-path="appearance>font>${key}"`)
      constSetup.setAdvancedFontPicker(picker, def.appearance.font[key])
    })
  }

  if ('text_size' in def.appearance) {
    if ('prompt' in def.appearance.text_size) {
      document.getElementById('promptTextSizeSlider').value = def.appearance.text_size.prompt
    }
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true&definition=' + def.uuid
  constSetup.previewDefinition()
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'word_cloud_input'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('word_cloud_input')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
}

// Set up the color pickers
function setUpColorPickers () {
  Coloris({
    el: '.coloris',
    theme: 'pill',
    themeMode: 'dark',
    formatToggle: false,
    clearButton: false,
    swatches: [
      '#000',
      '#22222E',
      '#393A5A',
      '#719abf',
      '#fff'
    ]
  })
}

// Set helperAddress for calls to constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

// Add event listeners
// -------------------------------------------------------------

// Settings
document.getElementById('collectionNameInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['behavior', 'collection_name'], event.target.value)
  constSetup.previewDefinition(true)
})

// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  constSetup.previewDefinition(true)
})

Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['content', 'localization', property], event.target.value)
    constSetup.previewDefinition(true)
  })
})

// Font upload
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(constSetup.refreshAdvancedFontPickers)
})

// Color
$('.coloris').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['appearance', 'color', $(this).data('property')], value)
  constSetup.previewDefinition(true)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['appearance', 'text_size', property], event.target.value)
    constSetup.previewDefinition(true)
  })
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

constSetup.configure({
  app: 'word_cloud_input',
  clearDefinition: clearDefinitionInput,
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
})

constCommon.askForDefaults(false)
  .then(() => {
    if (constCommon.config.standalone === false) {
      // We are using Control Server, so attempt to log in
      constSetup.authenticateUser()
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
    }
  })
