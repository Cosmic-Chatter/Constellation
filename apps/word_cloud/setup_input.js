/* global Coloris */

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
      })
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

  // Font details
  Array.from(document.querySelectorAll('.font-select')).forEach((el) => {
    el.value = el.getAttribute('data-default')
  })

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

  // Fonts
  if ('font' in def.appearance) {
    Object.keys(def.appearance.font).forEach((key) => {
      document.getElementById('fontSelect_' + key).value = def.appearance.font[key]
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

function populateFontSelects () {
  // Get a list of all the content and add the available font files to the appropriate selects.

  const selects = ['fontSelect_prompt', 'fontSelect_input', 'fontSelect_submit', 'fontSelect_clear']
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
document.getElementById('uploadFontInput').addEventListener('change', onFontUploadChange)

// Font change
$('.font-select').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['appearance', 'font', $(this).data('property')], value)
  constSetup.previewDefinition(true)
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

populateFontSelects()
clearDefinitionInput()

constSetup.configure({
  app: 'word_cloud_input',
  clearDefinition: clearDefinitionInput,
  loadDefinition: editDefinition,
  saveDefinition
})
