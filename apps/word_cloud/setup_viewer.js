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
            },
            text_case: 'lowercase',
            text_size: {}
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
            },
            text_case: 'lowercase',
            text_size: {}
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
  document.getElementById('refreshRateInput').value = 15

  // Content details
  document.getElementById('promptInput').value = ''
  Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
    el.value = ''
  })

  // Reset word cloud options
  document.getElementById('wordRotationSelect').value = 'horizontal'
  document.getElementById('cloudShapeSelect').value = 'circle'
  document.getElementById('textCaseSelect').value = 'lowercase'

  // Reset color options
  const colorInputs = ['prompt']
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
  if ('refresh_rate' in def.behavior) {
    document.getElementById('refreshRateInput').value = def.behavior.refresh_rate
  } else {
    document.getElementById('refreshRateInput').value = 15
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

  // Set values for the word cloud shape
  if ('rotation' in def.appearance) {
    document.getElementById('wordRotationSelect').value = def.appearance.rotation
  } else {
    document.getElementById('wordRotationSelect').value = 'horizontal'
  }
  if ('cloud_shape' in def.appearance) {
    document.getElementById('cloudShapeSelect').value = def.appearance.cloud_shape
  } else {
    document.getElementById('cloudShapeSelect').value = 'circle'
  }
  if ('text_case' in def.appearance) {
    document.getElementById('textCaseSelect').value = def.appearance.text_case
  } else {
    document.getElementById('textCaseSelect').value = 'lowercase'
  }

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

  if ('prompt' in def.appearance.text_size) {
    document.getElementById('promptTextSizeSlider').value = def.appearance.text_size.prompt
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_viewer.html?standalone=true&definition=' + def.uuid
  constSetup.previewDefinition()
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'word_cloud_viewer'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('word_cloud_viewer')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
}

function showExcludedWordsModal () {
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const el = document.getElementById('excludedWordsInput')
  if ('excluded_words_raw' in workingDefinition.behavior) {
    el.value = workingDefinition.behavior.excluded_words_raw
  } else {
    el.value = ''
  }

  $('#excludedWordsModal').modal('show')
}

function updateExcludedWordsList () {
  // Use the input field from the modal to update the working definition.

  const text = document.getElementById('excludedWordsInput').value
  constSetup.updateWorkingDefinition(['behavior', 'excluded_words_raw'], text)

  const lines = text.split('\n')
  const words = []
  lines.forEach((line) => {
    const wordSplit = line.split(',')
    wordSplit.forEach((word) => {
      words.push(word.trim().toLowerCase())
    })
  })
  constSetup.updateWorkingDefinition(['behavior', 'excluded_words'], words)

  $('#excludedWordsModal').modal('hide')
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
document.getElementById('refreshRateInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['behavior', 'refresh_rate'], event.target.value)
  constSetup.previewDefinition(true)
})

// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  constSetup.previewDefinition(true)
})
document.getElementById('showExcludedWordsModalButton').addEventListener('click', showExcludedWordsModal)
document.getElementById('excludedWordsListSaveButton').addEventListener('click', updateExcludedWordsList)

// Appearance
// Rotation
document.getElementById('wordRotationSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'rotation'], event.target.value)
  constSetup.previewDefinition(true)
})
// Shape
document.getElementById('cloudShapeSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'cloud_shape'], event.target.value)
  constSetup.previewDefinition(true)
})
// Text case
document.getElementById('textCaseSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'text_case'], event.target.value)
  constSetup.previewDefinition(true)
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

document.getElementById('wordColorMode').addEventListener('change', (event) => {
  if (event.target.value === 'specific') {
    const value = document.getElementById('colorPicker_words').value
    constSetup.updateWorkingDefinition(['appearance', 'color', 'words'], value)
  } else {
    constSetup.updateWorkingDefinition(['appearance', 'color', 'words'], event.target.value)
  }
  constSetup.previewDefinition(true)
})

document.getElementById('colorPicker_words').addEventListener('change', (event) => {
  // We only need to save this change to the definition is the word color mode is set to specific.

  const mode = document.getElementById('wordColorMode').value
  if (mode !== 'specific') return

  constSetup.updateWorkingDefinition(['appearance', 'color', 'words'], event.target.value)
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

constSetup.configure({
  app: 'word_cloud_viewer',
  clearDefinition: clearDefinitionInput,
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
})
