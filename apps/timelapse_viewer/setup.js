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
          attractor: {},
          behavior: {}
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          attractor: {},
          behavior: {}
        })
        previewDefinition(false)
      })
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('behaviorInput_animation_duration').value = 15
  document.getElementById('attractorInput_attractor_timeout').value = 30

  // Content details
  document.getElementById('filePatternInput').value = ''
  document.getElementById('filenamePatternMatches').value = null

  // Reset text inputs
  // document.getElementById('headerInput').value = ''
  // document.getElementById('subheaderInput').value = ''
  // document.getElementById('footerInput').value = ''
  // document.getElementById('subfooterInput').value = ''
  // document.getElementById('success_messageInput').value = ''

  // Reset option edit fields
  // document.getElementById('optionRow').innerHTML = ''
  // document.getElementById('optionInput_label').value = ''
  // document.getElementById('optionInput_value').value = ''
  // document.getElementById('optionInput_icon').value = ''
  // setIconUserFile('')

  // Reset color options
  // const colorInputs = ['background-color', 'button-color', 'button-touched-color', 'success-message-color', 'header-color', 'subheader-color', 'footer-color', 'subfooter-color', 'button-text-color']
  // colorInputs.forEach((input) => {
  //   const el = $('#colorPicker_' + input)
  //   el.val(el.data('default'))
  //   document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  // })

  // Reset font face options
  // const fontInputs = ['header', 'subheader', 'footer', 'subfooter', 'button']
  // fontInputs.forEach((input) => {
  //   const el = $('#fontSelect_' + input)
  //   el.val(el.data('default'))
  // })

  // Reset text size options
  // document.getElementById('headerTextSizeSlider').value = 0
  // document.getElementById('subheaderTextSizeSlider').value = 0
  // document.getElementById('footerTextSizeSlider').value = 0
  // document.getElementById('subfooterTextSizeSlider').value = 0
  // document.getElementById('buttonTextSizeSlider').value = 0

  // Reset layout options
  // document.getElementById('headerToButtonsSlider').value = 20
  // document.getElementById('headerPaddingHeightSlider').value = 5
  // document.getElementById('buttonsToFooterSlider').value = 20
  // document.getElementById('footerPaddingHeightSlider').value = 5
  // document.getElementById('buttonPaddingHeightSlider').value = 10
  // document.getElementById('imageHeightSlider').value = 90
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
      constCommon.getAvailableDefinitions('timelapse_viewer')
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
  document.getElementById('filePatternInput').value = def.files
  retrieveMatchingFilesCount()

  // Set the appropriate values for the behavior fields
  Object.keys(def.behavior).forEach((key) => {
    document.getElementById('behaviorInput_' + key).value = def.behavior[key]
  })

  // Set the appropriate values for the attractor fields
  Object.keys(def.attractor).forEach((key) => {
    const el = document.getElementById('attractorInput_' + key)
    el.value = def.attractor[key]

    if (['attractor_background', 'text_color'].includes(key)) {
      // Send a special event to the color picker to trigger the change
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../timelapse_viewer.html?standalone=true&definition=' + def.uuid
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
    if (details.icon === 'user' && details.icon_user_file !== '') return details.icon_user_file
    return details.icon
  }
  return 'New Option'
}

function createSurveyOption (userDetails, populateEditor = false) {
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
    Object.keys(defaults).forEach((key) => {
      updateWorkingDefinition(['options', details.uuid, key], details[key])
    })
  }

  const col = document.createElement('div')
  col.setAttribute('id', 'Option_' + details.uuid)
  col.classList = 'col col-12 mt-2'

  const container = document.createElement('div')
  container.classList = 'mx-3'
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
  editCol.classList = 'col-12 col-sm-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(editCol)

  const editButton = document.createElement('button')
  editButton.classList = 'btn btn-sm rounded-0 text-light bg-info w-100 h-100 justify-content-center d-flex pl-1'
  editButton.style.cursor = 'pointer'
  editButton.innerHTML = 'Edit'
  editButton.addEventListener('click', () => {
    populateOptionEditor(details.uuid)
  })
  editCol.appendChild(editButton)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-12 col-sm-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-sm rounded-0 text-light bg-danger w-100 h-100 justify-content-center d-flex pl-1'
  deleteButton.style.cursor = 'pointer'
  deleteButton.innerHTML = 'Delete'
  deleteButton.setAttribute('data-bs-toggle', 'popover')
  deleteButton.setAttribute('title', 'Are you sure?')
  deleteButton.setAttribute('data-bs-content', `<a id="DeleteOptionPopover_${details.uuid}" class="btn btn-danger w-100">Confirm</a>`)
  deleteButton.setAttribute('data-bs-trigger', 'focus')
  deleteButton.setAttribute('data-bs-html', 'true')
  $(document).on('click', '#DeleteOptionPopover_' + details.uuid, function () {
    deleteOption(details.uuid)
  })
  deleteButton.addEventListener('click', function () { deleteButton.focus() })
  deleteCol.appendChild(deleteButton)

  const leftArrowCol = document.createElement('div')
  leftArrowCol.classList = 'col-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(leftArrowCol)

  const leftArrowButton = document.createElement('button')
  leftArrowButton.classList = 'btn btn-sm rounded-0 text-light bg-primary w-100 h-100 justify-content-center d-flex'
  leftArrowButton.style.cursor = 'pointer'
  leftArrowButton.innerHTML = '◀'
  leftArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, -1)
  })
  leftArrowCol.appendChild(leftArrowButton)

  const RightArrowCol = document.createElement('div')
  RightArrowCol.classList = 'col-6 col-lg-3 mx-0 px-0'
  bottomRow.appendChild(RightArrowCol)

  const rightArrowButton = document.createElement('button')
  rightArrowButton.classList = 'btn btn-sm rounded-0 text-light bg-primary w-100 h-100 justify-content-center d-flex'
  rightArrowButton.style.cursor = 'pointer'
  rightArrowButton.innerHTML = '▶'
  rightArrowButton.addEventListener('click', () => {
    changeOptionOrder(details.uuid, 1)
  })
  RightArrowCol.appendChild(rightArrowButton)

  document.getElementById('optionRow').appendChild(col)

  if (populateEditor === true) {
    populateOptionEditor(details.uuid)
  }

  // Activate the popover
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
  popoverTriggerList.map(function (popoverTriggerEl) {
    return new bootstrap.Popover(popoverTriggerEl)
  })
}

function deleteOption (uuid) {
  // Delete an option and rebuild the GUI

  const def = $('#definitionSaveButton').data('workingDefinition')

  // Delete from the options dictionary
  delete def.options[uuid]

  // Delete from option order array
  const searchFunc = (el) => el === uuid
  const index = def.option_order.findIndex(searchFunc)
  if (index > -1) { // only splice array when item is found
    def.option_order.splice(index, 1)
  }

  // Rebuild the optionList GUI
  document.getElementById('optionRow').innerHTML = ''
  def.option_order.forEach((optionUUID) => {
    const option = def.options[optionUUID]
    createSurveyOption(option)
  })
  previewDefinition(true)
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

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const details = workingDefinition.options[id]
  document.getElementById('optionEditor').setAttribute('data-option-id', id)

  // Fill in the input fields
  document.getElementById('optionInput_label').value = details.label
  document.getElementById('optionInput_value').value = details.value
  document.getElementById('optionInput_icon').value = details.icon
  setIconUserFile(details.icon_user_file)
}

function setIconUserFile (file = '') {
  // Set the icon_user_file style option and format the GUI to match.
  if (file !== '') {
    document.getElementById('optionInput_icon_user_file').innerHTML = file
    document.getElementById('optionInput_icon_user_file_DeleteButtonCol').style.display = 'block'
    document.getElementById('optionInput_icon_user_file_Col').classList.add('col-lg-9')
  } else {
    document.getElementById('optionInput_icon_user_file').innerHTML = 'Select file'
    document.getElementById('optionInput_icon_user_file_DeleteButtonCol').style.display = 'none'
    document.getElementById('optionInput_icon_user_file_Col').classList.remove('col-lg-9')
  }
}

function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  constCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
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
  def.uuid = '__previewTimelapse'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../timelapse_viewer.html?standalone=true&definition=__previewTimelapse'
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'timelapse_viewer'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('timelapse_viewer')
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
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

function guessFilenamePattern () {
  // Use two given filenames to guess a wildcard (*) pattern to select the range

  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) return

  const firstSplit = first.split('.')
  const firstExt = firstSplit.pop()
  const firstNoExt = firstSplit.join('.')

  const lastSplit = last.split('.')
  const lastExt = lastSplit.pop()
  const lastNoExt = lastSplit.join('.')

  // Find common prefix
  let prefix = ''
  for (let i = 0; i < firstNoExt.length; i++) {
    if (firstNoExt[i] === lastNoExt[i]) {
      prefix += firstNoExt[i]
    } else break
  }
  const pattern = prefix + '*.' + firstExt
  updateWorkingDefinition(['files'], pattern)
  document.getElementById('filePatternInput').value = pattern

  retrieveMatchingFilesCount()
}

function retrieveMatchingFilesCount () {
  // Check the number of files in content that match the given filename wildcard pattern.

  const pattern = document.getElementById('filePatternInput').value
  const split = pattern.split('*.')

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  }).then((result) => {
    const content = result.all_exhibits
    const matchedFiles = content.filter((item) => {
      return item.startsWith(split[0]) && item.endsWith(split[1])
    })
    document.getElementById('filenamePatternMatches').value = matchedFiles.length
  })
}

function rotatePreview () {
  // Toggle the preview between landscape and portrait orientations.

  document.getElementById('previewFrame').classList.toggle('preview-landscape')
  document.getElementById('previewFrame').classList.toggle('preview-portrait')
  previewDefinition(false)
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

// Set helperAddress for calls to constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

constCommon.getAvailableDefinitions('timelapse_viewer')
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

// Behavior fields
Array.from(document.querySelectorAll('.behavior-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-property')
    updateWorkingDefinition(['behavior', key], event.target.value)
    previewDefinition(true)
  })
})

// Video conversion
const videoConversionModal = new bootstrap.Modal('#videoConversionModal')
document.getElementById('showConvertVideoModal').addEventListener('click', (event) => {
  const convertButton = document.getElementById('videoConversionModalSubmitButton')
  document.getElementById('selectConversionVideoButton').innerHTML = 'Select video'
  document.getElementById('selectConversionVideoButton').setAttribute('data-filename', null)
  document.getElementById('fileConversionVideoPreview').src = null
  document.getElementById('outputFileCountField').value = null

  convertButton.innerHTML = 'Convert'
  convertButton.classList.remove('btn-info')
  convertButton.classList.add('btn-primary')

  videoConversionModal.show()
})
document.getElementById('selectConversionVideoButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['video'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
        document.getElementById('fileConversionVideoPreview').src = constCommon.config.helperAddress + '/thumbnails/' + result[0].replace(/\.[^/.]+$/, '') + '.mp4'

        constCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/files/getVideoDetails',
          params: {
            filename: result[0]
          }
        })
          .then((response) => {
            if ('success' in response && response.success === true) {
              const frames = Math.round(response.details.duration * response.details.fps)
              document.getElementById('outputFileCountField').value = frames
            }
          })
      }
    })
})

document.getElementById('videoConversionModalSubmitButton').addEventListener('click', (event) => {
  const filename = document.getElementById('selectConversionVideoButton').getAttribute('data-filename')
  if (filename == null || filename.trim() === '') {
    return
  }
  const button = document.getElementById('videoConversionModalSubmitButton')
  button.innerHTML = 'Working...'
  button.classList.add('btn-info')
  button.classList.remove('btn-primary')

  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/convertVideoToFrames',
    params: {
      filename,
      file_type: 'jpg'
    },
    timeout: 3.6e6 // 1 hr
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        videoConversionModal.hide()
      }
    })
})

// Pattern generation
document.getElementById('filePatternInput').addEventListener('change', (event) => {
  updateWorkingDefinition(['files'], event.target.value)
  retrieveMatchingFilesCount()
  previewDefinition(true)
})
document.getElementById('selectFirstImageButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
document.getElementById('selectLastImageButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
const PatternGeneratorModal = new bootstrap.Modal('#patternGeneratorModal')
document.getElementById('showPatternGeneratorModal').addEventListener('click', (event) => {
  document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'none'
  document.getElementById('selectFirstImageButton').innerHTML = 'Select file'
  document.getElementById('selectFirstImageButton').setAttribute('data-filename', null)
  document.getElementById('selectLastImageButton').innerHTML = 'Select file'
  document.getElementById('selectLastImageButton').setAttribute('data-filename', null)
  PatternGeneratorModal.show()
})
document.getElementById('patternGeneratorModalSubmitButton').addEventListener('click', (event) => {
  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) {
    document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'block'
  } else {
    guessFilenamePattern()
    PatternGeneratorModal.hide()
    previewDefinition(true)
  }
})

// Attractor
Array.from(document.getElementsByClassName('attractor-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    updateWorkingDefinition(['attractor', property], event.target.value)
    previewDefinition(true)
  })
})

// Definition fields
// Array.from(document.querySelectorAll('.definition-text-input')).forEach((el) => {
//   el.addEventListener('change', (event) => {
//     const key = event.target.getAttribute('data-def-key')
//     updateWorkingDefinition(['text', key], event.target.value)
//     previewDefinition(true)
//   })
// })

// Option fields
// document.getElementById('addOptionButton').addEventListener('click', () => {
//   createSurveyOption(null, true)
// })
// document.getElementById('optionInput_icon_user_file_DeleteButton').addEventListener('click', () => {
//   const id = document.getElementById('optionEditor').getAttribute('data-option-id')
//   updateWorkingDefinition(['options', id, 'icon_user_file'], '')
//   setIconUserFile('')
//   document.getElementById('optionInput_icon').value = ''
//   updateWorkingDefinition(['options', id, 'icon'], '')
//   previewDefinition(true)
// })
// Array.from(document.getElementsByClassName('option-input')).forEach((el) => {
//   el.addEventListener('change', (event) => {
//     const id = document.getElementById('optionEditor').getAttribute('data-option-id')
//     const field = event.target.getAttribute('data-field')
//     if (id == null) return
//     updateWorkingDefinition(['options', id, field], event.target.value)
//     document.getElementById('OptionHeaderText_' + id).innerHTML = formatOptionHeader($('#definitionSaveButton').data('workingDefinition').options[id])
//     previewDefinition(true)
//   })
// })

// Style fields
// $('.coloris').change(function () {
//   const value = $(this).val().trim()
//   updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
//   previewDefinition(true)
// })
// $('#uploadFontInput').change(onFontUploadChange)

// $('.font-select').change(function () {
//   const value = $(this).val().trim()
//   updateWorkingDefinition(['style', 'font', $(this).data('property')], value)
//   previewDefinition(true)
// })

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    updateWorkingDefinition(['attractor', property], event.target.value)
    previewDefinition(true)
  })
})

// // Text size fields

// Layout fields
// Array.from(document.querySelectorAll('.height-slider')).forEach((el) => {
//   el.addEventListener('input', () => {
//     const headerHeight = parseInt(document.getElementById('headerToButtonsSlider').value)
//     const footerHeight = parseInt(document.getElementById('buttonsToFooterSlider').value)
//     const buttonHeight = 100 - headerHeight - footerHeight
//     updateWorkingDefinition(['style', 'layout', 'top_height'], headerHeight)
//     updateWorkingDefinition(['style', 'layout', 'button_height'], buttonHeight)
//     updateWorkingDefinition(['style', 'layout', 'bottom_height'], footerHeight)
//     console.log(headerHeight, buttonHeight, footerHeight)
//     previewDefinition(true)
//   })
// })
// Array.from(document.querySelectorAll('.padding-slider')).forEach((el) => {
//   el.addEventListener('input', (event) => {
//     const property = event.target.getAttribute('data-property')
//     updateWorkingDefinition(['style', 'layout', property], parseInt(event.target.value))
//     previewDefinition(true)
//   })
// })

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
