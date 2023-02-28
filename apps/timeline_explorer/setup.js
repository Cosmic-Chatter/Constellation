/* global Coloris */

import * as constCommon from '../js/constellation_app_common.js'

function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  $('#availableDefinitionSelect').empty()
  availableDefinitions = definitions
  const keys = Object.keys(definitions).sort()

  keys.forEach((name) => {
    if ((name.slice(0, 9) === '__preview') || name.trim() === '') return
    const option = document.createElement('option')
    option.value = name
    option.innerHTML = name

    $('#availableDefinitionSelect').append(option)
  })
}

function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition
  console.log('clearDefinitionInput')

  if (full == true) {
  // Get a new temporary uuid
    constCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/uuid/new'
    })
      .then((response) => {
        $('#definitionSaveButton').data('initialDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            color: {},
            font: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            color: {},
            font: {}
          }
        })
      })
  }

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

  // Definition details
  $('#definitionNameInput').val('')
  $('#languageNav').empty()
  $('#languageNavContent').empty()

  // Reset style options
  const colorInputs = ['backgroundColor', 'textColor', 'headerColor', 'footerColor', 'itemColor', 'lineColor']
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

function editDefinition (name = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  console.log($('#definitionSaveButton').data('workingDefinition').uuid)
  const def = getDefinitionByName(name)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  console.log($('#definitionSaveButton').data('workingDefinition').uuid)

  $('#definitionNameInput').val(def.name)
  $('#spreadsheetSelect').val(def.spreadsheet)

  // Set the appropriate values for the color pickers
  Object.keys(def.style.color).forEach((key) => {
    $('#colorPicker_' + key).val(def.style.color[key])
    document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Set the appropriate values for the font selects
  Object.keys(def.style.font).forEach((key) => {
    $('#fontSelect_' + key).val(def.style.font[key])
  })

  // Build out the key input interface
  let first = null
  Object.keys(def.languages).forEach((lang) => {
    if (first == null) first = lang
    const langDef = def.languages[lang]
    createLanguageTab(lang, langDef.display_name)
    $('#languagePane_' + lang).removeClass('active').removeClass('show')

    $('#headerText' + '_' + lang).val(langDef.header_text)
  })
  $('#languageTab_' + first).click()

  // Load the spreadsheet to populate the existing keys
  onSpreadsheetSelectChange()

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../timeline_explorer.html?preview=true&definition=' + def.uuid
}

function addLanguage () {
  // Collect details from the language fields and add a new supported language to the definition.

  const displayName = $('#languageNameInput').val().trim()
  const code = $('#languageCodeInput').val().trim()
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Check if fields are full
  if (displayName === '' || code === '') {
    $('#languageAddEmptyFieldsWarning').show()
    return
  } else {
    $('#languageAddEmptyFieldsWarning').hide()
  }

  // Check if name or code already exist
  let error = false
  Object.keys(workingDefinition.languages).forEach((key) => {
    if (key === code || workingDefinition.languages[key].display_name === displayName) {
      $('#languageAddExistsWarning').show()
      error = true
    } else {
      $('#languageAddExistsWarning').hide()
    }
  })
  if (error) return

  workingDefinition.languages[code] = { display_name: displayName, code }
  createLanguageTab(code, displayName)

  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  $('#languageNameInput').val('')
  $('#languageCodeInput').val('')
}

function createLanguageTab (code, displayName) {
  // Create a new language tab for the given details.

  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link'
  tabButton.setAttribute('id', 'languageTab_' + code)
  tabButton.setAttribute('data-bs-toggle', 'tab')
  tabButton.setAttribute('data-bs-target', '#languagePane_' + code)
  tabButton.setAttribute('type', 'button')
  tabButton.setAttribute('role', 'tab')
  tabButton.innerHTML = displayName
  $('#languageNav').append(tabButton)

  // Create corresponding pane
  const tabPane = document.createElement('div')
  tabPane.classList = 'tab-pane fade'
  tabPane.setAttribute('id', 'languagePane_' + code)
  tabPane.setAttribute('role', 'tabpanel')
  tabPane.setAttribute('aria-labelledby', 'languageTab_' + code)
  $('#languageNavContent').append(tabPane)

  const row = document.createElement('div')
  row.classList = 'row gy-2 mt-2 mb-3'
  tabPane.appendChild(row)

  // Create the flag input
  const flagImgCol = document.createElement('div')
  flagImgCol.classList = 'col-2 d-flex'
  row.append(flagImgCol)

  const flagImg = document.createElement('img')
  flagImg.setAttribute('id', 'flagImg_' + code)
  const customFlag = $('#definitionSaveButton').data('workingDefinition').languages[code].custom_flag
  if (customFlag != null) {
    flagImg.src = '../content/' + customFlag
  } else {
    flagImg.src = '../_static/flags/' + code + '.svg'
  }
  flagImg.classList = 'align-self-center'
  flagImg.style.width = '100%'
  flagImg.addEventListener('error', function () {
    this.src = '../_static/icons/translation-icon_black.svg'
  })
  flagImgCol.appendChild(flagImg)

  const clearFlagCol = document.createElement('div')
  clearFlagCol.classList = 'col-1 d-flex mx-0 px-0 text-center4'
  row.appendChild(clearFlagCol)

  const clearFlagButton = document.createElement('button')
  clearFlagButton.classList = 'btn btn-danger h-50 align-self-center'
  clearFlagButton.innerHTML = '✕'
  clearFlagButton.addEventListener('click', function () {
    deleteLanguageFlag(code)
  })
  clearFlagCol.append(clearFlagButton)

  const uploadFlagCol = document.createElement('div')
  uploadFlagCol.classList = 'col-3 d-flex'
  row.append(uploadFlagCol)

  const uploadFlagBox = document.createElement('label')
  uploadFlagBox.classList = 'btn btn-outline-primary w-100 h-50 align-self-center'
  uploadFlagCol.appendChild(uploadFlagBox)

  const uploadFlagFileName = document.createElement('span')
  uploadFlagFileName.setAttribute('id', 'uploadFlagFilename_' + code)
  uploadFlagFileName.classList = 'w-100'
  uploadFlagFileName.innerHTML = 'Upload'
  uploadFlagBox.appendChild(uploadFlagFileName)

  const uploadFlagInput = document.createElement('input')
  uploadFlagInput.setAttribute('id', 'uploadFlagInput_' + code)
  uploadFlagInput.classList = 'form-control-file w-100 align-self-center'
  uploadFlagInput.setAttribute('type', 'file')
  uploadFlagInput.setAttribute('hidden', true)
  uploadFlagInput.setAttribute('accept', 'image/*')
  uploadFlagInput.addEventListener('change', function () {
    onFlagUploadChange(code)
  })
  uploadFlagBox.appendChild(uploadFlagInput)

  // Create the various inputs
  Object.keys(inputFields).forEach((key) => {
    const langKey = key + '_' + code
    const col = document.createElement('div')
    col.classList = 'col-6'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label'
    label.setAttribute('for', langKey)
    label.innerHTML = inputFields[key].name
    col.appendChild(label)

    let input

    if (inputFields[key].kind === 'select') {
      input = document.createElement('select')
      input.classList = 'form-select'
    } else if (inputFields[key].kind === 'input') {
      input = document.createElement('input')
      input.setAttribute('type', inputFields[key].type)
      input.classList = 'form-control'
    }
    input.setAttribute('id', langKey)
    input.addEventListener('change', function () {
      const value = $(this).val().trim()
      updateWorkingDefinition(['languages', code, inputFields[key].property], value)
      previewDefinition(true)
    })
    col.appendChild(input)
  })

  // If we have already loaded a spreadhseet, populate the key options
  const keyList = $('#spreadsheetSelect').data('availableKeys')
  if (keyList != null) {
    populateKeySelects(keyList)
  }

  // Switch to this new tab
  $(tabButton).click()
}

function deleteLanguageFlag (lang) {
  // Ask the server to delete the language flag and remove it from the working definition.

  const flag = $('#definitionSaveButton').data('workingDefinition').languages[lang].custom_flag

  if (flag == null) {
    // No custom flag
    return
  }

  // Delete filename from working definition
  delete $('#definitionSaveButton').data('workingDefinition').languages[lang].custom_flag

  // Remove the icon
  $('#flagImg_' + lang).attr('src', '../_static/flags/' + lang + '.svg')

  // Delete from server
  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/deleteFile',
    params: {
      file: flag
    }
  })
}

function onFlagUploadChange (lang) {
  // Called when the user selects a flag image file to upload

  const fileInput = $('#uploadFlagInput_' + lang)[0]

  const file = fileInput.files[0]
  if (file == null) return

  $('#uploadFlagFilename_' + lang).html('Uploading')

  const ext = file.name.split('.').pop()
  const newName = $('#definitionSaveButton').data('workingDefinition').uuid + '_flag_' + lang + '.' + ext
  console.log(newName)
  const formData = new FormData()

  formData.append('files', fileInput.files[0], newName)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/uploadContent', true)

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      const response = JSON.parse(this.responseText)
      console.log(response)
      if ('success' in response) {
        $('#uploadFlagFilename_' + lang).html('Upload')
        $('#flagImg_' + lang).attr('src', '../content/' + newName)
        updateWorkingDefinition(['languages', lang, 'custom_flag'], newName)
      }
    } else if (this.status === 422) {
      console.log(JSON.parse(this.responseText))
    }
  }
  xhr.send(formData)
}

function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  constCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
  console.log($('#definitionSaveButton').data('workingDefinition'))
}

function getDefinitionByName (name = '') {
  // Return the definition with this name

  if (name === '') {
    name = $('#availableDefinitionSelect').val()
  }
  let matchedDef = null
  Object.keys(availableDefinitions).forEach((key) => {
    const def = availableDefinitions[key]
    if (def.name === name) {
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
  def.uuid = '__previewTimeline'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../timeline_explorer.html?preview=true&definition=__previewTimeline'
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'timeline_explorer'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('timeline_explorer')
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

function populateSpreadsheetSelect () {
  // Get a list of all the content and add the available csv files to the select.

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      $('#spreadsheetSelect').empty()
      result.all_exhibits.forEach((item) => {
        if (item.split('.').pop().toLowerCase() === 'csv') {
          const option = document.createElement('option')
          option.value = item
          option.innerHTML = item
          $('#spreadsheetSelect').append(option)
        }
      })
      $('#spreadsheetSelect').val(null)
    })
}

function onSpreadsheetSelectChange () {
  // Called when a new spreadsheet is selected. Get the csv file and populate the options.

  const file = $('#spreadsheetSelect').val()
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  if (file == null) {
    return
  } else {
    workingDefinition.spreadsheet = file
    $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))
  }

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + file,
    rawResponse: true
  })
    .then((result) => {
      const spreadsheet = constCommon.csvToJSON(result)
      const keys = Object.keys(spreadsheet[0])
      $('#spreadsheetSelect').data('availableKeys', keys)
      populateKeySelects(keys)
    })
}

function populateFontSelects () {
  // Get a list of all the content and add the available font files to the appropriate selects.

  const types = ['Header', 'Time', 'Title', 'Body']
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

function populateKeySelects (keyList) {
  // Take a list of keys and use it to populate all the selects used to match keys to parameters.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  if (('languages' in workingDefinition) === false) return

  Object.keys(workingDefinition.languages).forEach((lang) => {
    const langDict = workingDefinition.languages[lang]
    Object.keys(inputFields).forEach((input) => {
      const inputDict = inputFields[input]
      if (inputDict.kind === 'select') {
        $('#' + input + '_' + lang).empty()

        keyList.forEach((key) => {
          const option = document.createElement('option')
          option.value = key
          option.innerHTML = key
          $('#' + input + '_' + lang).append(option)
        })

        // If we already have a value for this select, set it
        if (inputDict.property in langDict) {
          $('#' + input + '_' + lang).val(langDict[inputDict.property])
        } else {
          $('#' + input + '_' + lang).val(null)
        }
      }
    })
  })
}

// All the available definitions
let availableDefinitions = {}

// The input fields to specifiy content for each langauge
const inputFields = {
  headerText: {
    name: 'Header',
    kind: 'input',
    type: 'text',
    property: 'header_text'
  },
  keyTimeSelect: {
    name: 'Time key',
    kind: 'select',
    property: 'time_key'
  },
  keyTitleSelect: {
    name: 'Title key',
    kind: 'select',
    property: 'title_key'
  },
  keyLevelSelect: {
    name: 'Level key',
    kind: 'select',
    property: 'level_key'
  },
  keyShortSelect: {
    name: 'Short text key',
    kind: 'select',
    property: 'short_text_key'
  },
  keyImageSelect: {
    name: 'Image key',
    kind: 'select',
    property: 'image_key'
  },
  keyThumbnailSelect: {
    name: 'Thumbnail key',
    kind: 'select',
    property: 'thumbnail_key'
  }
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
// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

constCommon.getAvailableDefinitions('timeline_explorer')
  .then((response) => {
    if ('success' in response && response.success === true) {
      populateAvailableDefinitions(response.definitions)
    }
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
$('#languageAddButton').click(addLanguage)

// Definition fields
$('#spreadsheetSelect').change(onSpreadsheetSelectChange)

// Style fields
$('.coloris').change(function () {
  const value = $(this).val().trim()
  updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
  previewDefinition(true)
})
$('.font-select').change(function () {
  const value = $(this).val().trim()
  updateWorkingDefinition(['style', 'font', $(this).data('property')], value)
  previewDefinition(true)
})

// Preview frame
window.addEventListener('load', resizePreview)
window.addEventListener('resize', resizePreview)

populateSpreadsheetSelect()
populateFontSelects()
clearDefinitionInput()
