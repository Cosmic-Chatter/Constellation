/* global Coloris, bootstrap */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'

function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  $('#availableDefinitionSelect').empty()
  availableDefinitions = definitions
  const keys = Object.keys(definitions).sort()

  keys.forEach((uuid) => {
    if ((uuid.slice(0, 9) === '__preview') || uuid.trim() === '') return
    const definition = definitions[uuid]
    const option = document.createElement('option')
    option.value = uuid
    option.innerHTML = definition.name

    $('#availableDefinitionSelect').append(option)
  })
}

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
          options: {},
          option_order: [],
          text: {},
          style: {
            color: {},
            font: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          options: {},
          option_order: [],
          text: {},
          style: {
            color: {},
            font: {}
          }
        })
      })
  }

  // Definition details
  $('#definitionNameInput').val('')

  // Reset style options
  const colorInputs = ['background-color', 'button-color', 'button-touched-color', 'success-message-color', 'header-color', 'subheader-color', 'footer-color', 'subfooter-color', 'button-text-color']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function deleteDefinition () {
  // Delete the definition currently listed in the select.

  const definition = $('#availableDefinitionSelect').val()

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + definition + '/delete'
  })
    .then(() => {
      constCommon.getAvailableDefinitions('voting_kiosk')
        .then((response) => {
          if ('success' in response && response.success === true) {
            populateAvailableDefinitions(response.definitions)
          }
        })
    })
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = getDefinitionByUUID(uuid)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Set the appropriate values for the text fields
  Object.keys(def.text).forEach((key) => {
    document.getElementById(key + 'Input').value = def.text[key]
  })

  // Create any existing options
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })

  // Set the appropriate values for the color pickers
  Object.keys(def.style.color).forEach((key) => {
    $('#colorPicker_' + key).val(def.style.color[key])
    document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Set the appropriate values for the font selects
  Object.keys(def.style.font).forEach((key) => {
    $('#fontSelect_' + key).val(def.style.font[key])
  })

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../voting_kiosk.html?standalone=true&definition=' + def.uuid
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
        $('#uploadFontName').html('Upload new')
        populateFontSelects()
      }
    } else if (this.status === 422) {
      console.log(JSON.parse(this.responseText))
    }
  }
  xhr.send(formData)
}

function formatOptionHeader (details) {
  // Return a string that labels the option with the best information we have
  if (details.label !== '') return details.label
  if (details.value !== '') return details.value
  if (details.icon !== '') {
    if (details.icon === 'user' && details.icon_user_file != '') return details.icon_user_file
    return details.icon
  }
  return ''
}

function createSurveyOption (userDetails) {
  // Create the HTML representation of a survey question and add it to the row.

  const optionOrder = $('#definitionSaveButton').data('workingDefinition').option_order

  const defaults = {
    uuid: String(Math.random() * 1e20),
    label: '',
    value: '',
    icon: '',
    icon_user_file: ''
  }
  // Merge in user details
  const details = { ...defaults, ...userDetails }

  if (optionOrder.includes(details.uuid) === false) {
    optionOrder.push(details.uuid)
    updateWorkingDefinition(['option_order', optionOrder])
    updateWorkingDefinition(['options', details.uuid, 'uuid'], details.uuid)
  }

  const col = document.createElement('div')
  col.setAttribute('id', 'Option_' + details.uuid)
  col.setAttribute('data-details', JSON.stringify(details))
  col.classList = 'col col-12 mt-2'

  const container = document.createElement('div')
  container.classList = 'mx-1'
  col.appendChild(container)

  const topRow = document.createElement('div')
  topRow.classList = 'row'
  container.appendChild(topRow)

  const headerCol = document.createElement('div')
  headerCol.classList = 'col-12 bg-secondary rounded-top'
  topRow.appendChild(headerCol)

  const headerText = document.createElement('div')
  headerText.setAttribute('id', 'OptionHeaderText_' + details.uuid)
  headerText.classList = 'text-light w-100 text-center font-weight-bold'
  headerText.innerHTML = formatOptionHeader(details) || 'New option'
  headerCol.appendChild(headerText)

  const bottomRow = document.createElement('div')
  bottomRow.classList = 'row'
  container.appendChild(bottomRow)

  const editCol = document.createElement('div')
  editCol.classList = 'col-6 mx-0 px-0'
  bottomRow.appendChild(editCol)

  const editButton = document.createElement('div')
  editButton.classList = 'text-light bg-info w-100 h-100 justify-content-center d-flex pl-1'
  editButton.style.borderBottomLeftRadius = '0.25rem'
  editButton.style.cursor = 'pointer'
  editButton.innerHTML = 'Edit'
  editButton.addEventListener('click', () => {
    populateOptionEditor(details.uuid)
  })
  editCol.appendChild(editButton)

  const leftArrowCol = document.createElement('div')
  leftArrowCol.classList = 'col-3 mx-0 px-0'
  bottomRow.appendChild(leftArrowCol)

  const leftArrowButton = document.createElement('div')
  leftArrowButton.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex'
  leftArrowButton.style.cursor = 'pointer'
  leftArrowButton.innerHTML = '◀'
  leftArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, -1)
  })
  leftArrowCol.appendChild(leftArrowButton)

  const RightArrowCol = document.createElement('div')
  RightArrowCol.classList = 'col-3 mx-0 px-0'
  bottomRow.appendChild(RightArrowCol)

  const rightArrowButton = document.createElement('div')
  rightArrowButton.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex'
  rightArrowButton.style.borderBottomRightRadius = '0.25rem'
  rightArrowButton.style.cursor = 'pointer'
  rightArrowButton.innerHTML = '▶'
  rightArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, 1)
  })
  RightArrowCol.appendChild(rightArrowButton)

  document.getElementById('optionRow').appendChild(col)
}

function changeOptionOrder (uuid, direction) {
  // Move the option given by uuid in the direction specified
  // direction should be -1 or 1

  const def = $('#definitionSaveButton').data('workingDefinition')
  const searchFunc = (el) => el === uuid
  const currentIndex = def.option_order.findIndex(searchFunc)

  // Handle the edge cases
  if (currentIndex === 0 && direction < 0) return
  if (currentIndex === def.option_order.length - 1 && direction > 0) return

  // Handle middle cases
  const newIndex = currentIndex + direction
  const currentValueOfNewIndex = def.option_order[newIndex]
  def.option_order[newIndex] = uuid
  def.option_order[currentIndex] = currentValueOfNewIndex

  // Rebuild the optionList GUI
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })
  previewDefinition(true)
}

function populateOptionEditor (id) {
  // Take the details from an option and fill in the editor GUI

  const details = JSON.parse(document.getElementById('Option_' + id).getAttribute('data-details'))
  document.getElementById('optionEditor').setAttribute('data-option-id', id)

  // Fill in the input fields
  document.getElementById('optionInput_label').value = details.label
  document.getElementById('optionInput_value').value = details.value
  document.getElementById('optionInput_icon').value = details.icon
  if (details.icon_user_file !== '') {
    document.getElementById('optionInput_icon_user_file').innerHTML = details.icon_user_file
  } else {
    document.getElementById('optionInput_icon_user_file').innerHTML = 'Select file'
  }
}

function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  constCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
  console.log($('#definitionSaveButton').data('workingDefinition'))
}

function getDefinitionByUUID (uuid = '') {
  // Return the definition with this UUID

  if (uuid === '') {
    uuid = $('#availableDefinitionSelect').val()
  }
  let matchedDef = null
  Object.keys(availableDefinitions).forEach((key) => {
    const def = availableDefinitions[key]
    if (def.uuid === uuid) {
      matchedDef = def
    }
  })
  return matchedDef
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
  def.uuid = '__previewVoting'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../voting_kiosk.html?standalone=true&definition=__previewVoting'
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'voting_kiosk'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('voting_kiosk')
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

function resizePreview () {
  const paneWidth = $('#previewPane').width()
  const frameWidth = $('#previewFrame').width()
  const transformRatio = paneWidth / frameWidth

  $('#previewFrame').css('transform', 'scale(' + transformRatio + ')')
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').getAttribute('data-filename')
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  workingDefinition.attractor = file
  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))

  previewDefinition(true)
}

function populateFontSelects () {
  // Get a list of all the content and add the available font files to the appropriate selects.

  const types = ['header', 'subheader', 'footer', 'subfooter', 'button']
  $('.font-select').empty()

  // First, search the content directory for any user-provided fonts
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      types.forEach((type) => {
        // First, add the default
        const defaultFont = document.createElement('option')
        defaultFont.value = $('#fontSelect_' + type).data('default')
        defaultFont.innerHTML = 'Default'
        $('#fontSelect_' + type).append(defaultFont)

        const header = document.createElement('option')
        header.value = 'User-provided'
        header.innerHTML = 'User-provided'
        header.setAttribute('disabled', true)
        $('#fontSelect_' + type).append(header)

        result.all_exhibits.forEach((item) => {
          if (['ttf', 'otf', 'woff'].includes(item.split('.').pop().toLowerCase())) {
            const option = document.createElement('option')
            option.value = '../content/' + item
            option.innerHTML = item
            $('#fontSelect_' + type).append(option)
          }
        })
      })

      // Then, add the defaults
      const defaultFonts = ['OpenSans-Light.ttf', 'OpenSans-LightItalic.ttf', 'OpenSans-Regular.ttf', 'OpenSans-Italic.ttf', 'OpenSans-Medium.ttf', 'OpenSans-MediumItalic.ttf', 'OpenSans-SemiBold.ttf', 'OpenSans-SemiBoldItalic.ttf', 'OpenSans-Bold.ttf', 'OpenSans-BoldItalic.ttf', 'OpenSans-ExtraBoldItalic.ttf', 'OpenSans-ExtraBold.ttf']

      types.forEach((type) => {
        const header = document.createElement('option')
        header.value = 'Built-in'
        header.innerHTML = 'Built-in'
        header.setAttribute('disabled', true)
        $('#fontSelect_' + type).append(header)

        defaultFonts.forEach((font) => {
          const option = document.createElement('option')
          option.value = '../_fonts/' + font
          option.innerHTML = font
          $('#fontSelect_' + type).append(option)
        })
      })
    })
}

function rotatePreview () {
  // Toggle the preview between landscape and portrait orientations.

  document.getElementById('previewFrame').classList.toggle('preview-landscape')
  document.getElementById('previewFrame').classList.toggle('preview-portrait')
}

// All the available definitions
let availableDefinitions = {}

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
// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

constCommon.getAvailableDefinitions('voting_kiosk')
  .then((response) => {
    if ('success' in response && response.success === true) {
      populateAvailableDefinitions(response.definitions)
    }
  })

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

// Add event listeners
// -------------------------------------------------------------

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#editDefinitionButton').click(() => {
  editDefinition()
})
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})
document.getElementById('previewRotateButton').addEventListener('click', () => {
  rotatePreview()
})

// Definition delete popover button
const deleteDefinitionButton = document.getElementById('deleteDefinitionButton')
deleteDefinitionButton.setAttribute('data-bs-toggle', 'popover')
deleteDefinitionButton.setAttribute('title', 'Are you sure?')
deleteDefinitionButton.setAttribute('data-bs-content', '<a id="DefinitionDeletePopover" class="btn btn-danger w-100">Confirm</a>')
deleteDefinitionButton.setAttribute('data-bs-trigger', 'focus')
deleteDefinitionButton.setAttribute('data-bs-html', 'true')
$(document).on('click', '#DefinitionDeletePopover', function () {
  deleteDefinition()
})
deleteDefinitionButton.addEventListener('click', function () { deleteDefinitionButton.focus() })
const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
popoverTriggerList.map(function (popoverTriggerEl) {
  return new bootstrap.Popover(popoverTriggerEl)
})

// Definition fields
Array.from(document.querySelectorAll('.definition-text-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-def-key')
    updateWorkingDefinition(['text', key], event.target.value)
    previewDefinition(true)
  })
})

// Option fields
document.getElementById('addOptionButton').addEventListener('click', () => {
  createSurveyOption()
})
document.getElementById('optionInput_icon_user_file').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        const id = document.getElementById('optionEditor').getAttribute('data-option-id')
        updateWorkingDefinition(['options', id, 'icon_user_file'], result[0])
        event.target.innerHTML = result[0]
        previewDefinition(true)
      }
    })
})
Array.from(document.getElementsByClassName('option-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const id = document.getElementById('optionEditor').getAttribute('data-option-id')
    const field = event.target.getAttribute('data-field')
    if (id == null) return
    updateWorkingDefinition(['options', id, field], event.target.value)
    document.getElementById('OptionHeaderText_' + id).innerHTML = formatOptionHeader($('#definitionSaveButton').data('workingDefinition').options[id])
    previewDefinition(true)
  })
})

// Style fields
$('.coloris').change(function () {
  const value = $(this).val().trim()
  updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
  previewDefinition(true)
})
$('#uploadFontInput').change(onFontUploadChange)

$('.font-select').change(function () {
  const value = $(this).val().trim()
  updateWorkingDefinition(['style', 'font', $(this).data('property')], value)
  previewDefinition(true)
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Preview frame
window.addEventListener('load', resizePreview)
window.addEventListener('resize', resizePreview)

populateFontSelects()
clearDefinitionInput()
