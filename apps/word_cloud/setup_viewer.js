/* global Coloris, bootstrap */

import * as constCommon from '../js/constellation_app_common.js'
import * as constSetup from '../js/constellation_setup_common.js'

function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
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
        previewDefinition(false)
      })
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

  // Font details
  Array.from(document.querySelectorAll('.font-select')).forEach((el) => {
    el.value = el.getAttribute('data-default')
  })

  document.getElementById('promptTextSizeSlider').value = 0
}
function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = constSetup.getDefinitionByUUID(uuid)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))
  console.log(def)
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

  // Fonts
  if ('font' in def.appearance) {
    Object.keys(def.appearance.font).forEach((key) => {
      document.getElementById('fontSelect_' + key).value = def.appearance.font[key]
    })
  }

  if ('prompt' in def.appearance.text_size) {
    document.getElementById('promptTextSizeSlider').value = def.appearance.text_size.prompt
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_viewer.html?standalone=true&definition=' + def.uuid
  previewDefinition()
}

function onFontUploadChange () {
  // Classed when the user selects font files to upload

  const fileInput = $('#uploadFontInput')[0]
  const files = fileInput.files
  const formData = new FormData()

  $('#uploadFontName').html('Uploading')

  Object.keys(files).forEach((key) => {
    const file = files[key]
    formData.append('files', file)
  })

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/uploadContent', true)

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      const response = JSON.parse(this.responseText)

      if ('success' in response) {
        $('#uploadFontName').html('Upload')
        populateFontSelects()
      }
    } else if (this.status === 422) {
      console.log(JSON.parse(this.responseText))
    }
  }
  xhr.send(formData)
}

function previewDefinition (automatic = false) {
  // Save the definition to a temporary file and load it into the preview frame.
  // If automatic == true, we've called this function beceause a definition field
  // has been updated. Only preview if the 'Refresh on change' checkbox is checked

  if ((automatic === true) && $('#refreshOnChangeCheckbox').prop('checked') === false) {
    return
  }

  const def = $('#definitionSaveButton').data('workingDefinition')
  // Set the uuid to a temp one
  def.uuid = '__previewWordCloudViewer'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../word_cloud_viewer.html?standalone=true&definition=__previewWordCloudViewer'
      }
    })
}

function saveDefintion () {
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

function populateFontSelects () {
  // Get a list of all the content and add the available font files to the appropriate selects.

  const selects = ['fontSelect_prompt', 'fontSelect_words']
  $('.font-select').empty()

  // First, search the content directory for any user-provided fonts
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      selects.forEach((id) => {
        const el = document.getElementById(id)
        // First, add the default
        const defaultFont = document.createElement('option')
        defaultFont.value = el.getAttribute('data-default')
        defaultFont.innerHTML = 'Default'
        el.appendChild(defaultFont)

        const header = document.createElement('option')
        header.value = 'User-provided'
        header.innerHTML = 'User-provided'
        header.setAttribute('disabled', true)
        el.appendChild(header)

        result.all_exhibits.forEach((item) => {
          if (['ttf', 'otf', 'woff'].includes(item.split('.').pop().toLowerCase())) {
            const option = document.createElement('option')
            option.value = '../content/' + item
            option.innerHTML = item
            el.appendChild(option)
          }
        })
      })

      // Then, add the defaults
      const defaultFonts = ['OpenSans-Light.ttf', 'OpenSans-LightItalic.ttf', 'OpenSans-Regular.ttf', 'OpenSans-Italic.ttf', 'OpenSans-Medium.ttf', 'OpenSans-MediumItalic.ttf', 'OpenSans-SemiBold.ttf', 'OpenSans-SemiBoldItalic.ttf', 'OpenSans-Bold.ttf', 'OpenSans-BoldItalic.ttf', 'OpenSans-ExtraBoldItalic.ttf', 'OpenSans-ExtraBold.ttf']

      selects.forEach((id) => {
        const el = document.getElementById(id)
        const header = document.createElement('option')
        header.value = 'Built-in'
        header.innerHTML = 'Built-in'
        header.setAttribute('disabled', true)
        el.appendChild(header)

        defaultFonts.forEach((font) => {
          const option = document.createElement('option')
          option.value = '../_fonts/' + font
          option.innerHTML = font
          el.appendChild(option)
        })
      })
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

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})

// Settings
document.getElementById('collectionNameInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['behavior', 'collection_name'], event.target.value)
  previewDefinition(true)
})
document.getElementById('refreshRateInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['behavior', 'refresh_rate'], event.target.value)
  previewDefinition(true)
})

// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  previewDefinition(true)
})

Array.from(document.querySelectorAll('.localization-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['content', 'localization', property], event.target.value)
    previewDefinition(true)
  })
})

// Appearance
// Rotation
document.getElementById('wordRotationSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'rotation'], event.target.value)
  previewDefinition(true)
})
// Shape
document.getElementById('cloudShapeSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'cloud_shape'], event.target.value)
  previewDefinition(true)
})
// Text case
document.getElementById('textCaseSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['appearance', 'text_case'], event.target.value)
  previewDefinition(true)
})

// Font upload
document.getElementById('uploadFontInput').addEventListener('change', onFontUploadChange)

// Font change
$('.font-select').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['appearance', 'font', $(this).data('property')], value)
  previewDefinition(true)
})

// Color
$('.coloris').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['appearance', 'color', $(this).data('property')], value)
  previewDefinition(true)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['appearance', 'text_size', property], event.target.value)
    previewDefinition(true)
  })
})

document.getElementById('wordColorMode').addEventListener('change', (event) => {
  if (event.target.value === 'specific') {
    const value = document.getElementById('colorPicker_words').value
    constSetup.updateWorkingDefinition(['appearance', 'color', 'words'], value)
  } else {
    constSetup.updateWorkingDefinition(['appearance', 'color', 'words'], event.target.value)
  }
  previewDefinition(true)
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

populateFontSelects()
clearDefinitionInput()

constSetup.configure({
  app: 'word_cloud_viewer',
  clearDefinition: clearDefinitionInput,
  loadDefinition: editDefinition
})
