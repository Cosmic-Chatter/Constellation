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
          appearance: {},
          attractor: {},
          behavior: {},
          content: {}
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          appearance: {},
          attractor: {},
          behavior: {},
          content: {}
        })
        previewDefinition(false)
      })
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''

  // Content details

  // Attractor details
  document.getElementById('attractorInput_attractor_timeout').value = 30
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

  $('#definitionNameInput').val(def.name)

  // Set the appropriate values for the attractor fields

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true&definition=' + def.uuid
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
  def.uuid = '__previewWordCloudInput'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../word_cloud_input.html?standalone=true&definition=__previewWordCloudInput'
      }
    })
}

function saveDefintion () {
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

  const selects = ['fontSelect_prompt']
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

// Content
document.getElementById('promptInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['content', 'prompt'], event.target.value)
  previewDefinition(true)
})

// Attractor

// Font upload
document.getElementById('uploadFontInput').addEventListener('change', onFontUploadChange)

// Font change
$('.font-select').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['appearance', 'font', $(this).data('property')], value)
  previewDefinition(true)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['attractor', property], event.target.value)
    previewDefinition(true)
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
  loadDefinition: editDefinition
})
