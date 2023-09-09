/* global Coloris, bootstrap */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'
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
          languages: {},
          style: {
            color: {},
            font: {},
            layout: {},
            text_size: {}
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          languages: {},
          style: {
            color: {},
            font: {},
            layout: {},
            text_size: {}
          }
        })
      })
  }

  // Spreadsheet
  const spreadsheetSelect = document.getElementById('spreadsheetSelect')
  spreadsheetSelect.innerHTML = 'Select file'
  spreadsheetSelect.setAttribute('data-filename', '')
  $(spreadsheetSelect).data('availableKeys', [])

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

  // Attractor
  document.getElementById('inactivityTimeoutField').value = 30
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')

  // Definition details
  $('#definitionNameInput').val('')
  $('#languageNav').empty()
  $('#languageNavContent').empty()
  document.getElementById('missingContentWarningField').innerHTML = ''

  // Reset layout options
  // document.getElementById('showSearchPaneCheckbox').checked = false
  document.getElementById('itemsPerPageInput').value = 12
  document.getElementById('numColsSelect').value = 6
  document.getElementById('imageHeightSlider').value = 80

  // Reset style options
  const colorInputs = ['backgroundColor', 'titleColor']
  colorInputs.forEach((input) => {
    const el = $('#colorPicker_' + input)
    el.val(el.data('default'))
    document.querySelector('#colorPicker_' + input).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Reset text size options
  document.getElementById('TitleTextSizeSlider').value = 0
  document.getElementById('Lightbox_titleTextSizeSlider').value = 0
  document.getElementById('Lightbox_captionTextSizeSlider').value = 0
  document.getElementById('Lightbox_creditTextSizeSlider').value = 0
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = constSetup.getDefinitionByUUID(uuid)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Spreadsheet
  $('#spreadsheetSelect').html(def.spreadsheet)
  document.getElementById('spreadsheetSelect').setAttribute('data-filename', def.spreadsheet)

  // Attractor
  if ('attractor' in def && def.attractor.trim() !== '') {
    $('#attractorSelect').html(def.attractor)
  } else {
    $('#attractorSelect').html('Select file')
  }
  document.getElementById('attractorSelect').setAttribute('data-filename', def.attractor)
  document.getElementById('inactivityTimeoutField').value = def.inactivity_timeout

  // Set the layout options
  // document.getElementById('showSearchPaneCheckbox').checked = def.style.layout.show_search_and_filter
  document.getElementById('itemsPerPageInput').value = def.style.layout.items_per_page
  document.getElementById('numColsSelect').value = def.style.layout.num_columns
  document.getElementById('imageHeightSlider').value = def.style.layout.image_height
  document.getElementById('lightboxTitleHeightSlider').value = def.style.layout.lightbox_title_height
  document.getElementById('lightboxCaptionHeightSlider').value = def.style.layout.lightbox_caption_height
  document.getElementById('lightboxCreditHeightSlider').value = def.style.layout.lightbox_credit_height

  // Set the appropriate values for the color pickers
  Object.keys(def.style.color).forEach((key) => {
    $('#colorPicker_' + key).val(def.style.color[key])
    document.querySelector('#colorPicker_' + key).dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Set the appropriate values for the font selects
  Object.keys(def.style.font).forEach((key) => {
    $('#fontSelect_' + key).val(def.style.font[key])
  })

  // Set the appropriate values for the text size selects
  Object.keys(def.style.text_size).forEach((key) => {
    document.getElementById(key + 'TextSizeSlider').value = def.style.text_size[key]
  })

  // Build out the key input interface
  let first = null
  Object.keys(def.languages).forEach((lang) => {
    const langDef = def.languages[lang]
    if (first == null) {
      createLanguageTab(lang, langDef.display_name)
      first = lang
    } else {
      createLanguageTab(lang, langDef.display_name)
    }
    $('#languagePane_' + lang).removeClass('active').removeClass('show')

    $('#headerText' + '_' + lang).val(langDef.header_text)
  })
  $('#languageTab_' + first).click()
  $('#languagePane_' + first).addClass('active')

  // Load the spreadsheet to populate the existing keys
  onSpreadsheetFileChange()

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_browser.html?standalone=true&definition=' + def.uuid
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
  // Set first=true when creating the first tab

  // Create the tab button
  const tabButton = document.createElement('button')
  tabButton.classList = 'nav-link language-tab'
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
  flagImgCol.classList = 'col-3 col-lg-2 d-flex'
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
  clearFlagCol.classList = 'col-2 col-lg-1 d-flex mx-0 px-0 text-center4'
  row.appendChild(clearFlagCol)

  const clearFlagButton = document.createElement('button')
  clearFlagButton.classList = 'btn btn-danger align-self-center'
  clearFlagButton.innerHTML = '✕'
  clearFlagButton.addEventListener('click', function () {
    deleteLanguageFlag(code)
  })
  clearFlagCol.append(clearFlagButton)

  const uploadFlagCol = document.createElement('div')
  uploadFlagCol.classList = 'col-7 col-lg-3 d-flex'
  row.append(uploadFlagCol)

  const uploadFlagBox = document.createElement('label')
  uploadFlagBox.classList = 'btn btn-outline-primary w-100 align-self-center d-flex'
  uploadFlagCol.appendChild(uploadFlagBox)

  const uploadFlagFileName = document.createElement('span')
  uploadFlagFileName.setAttribute('id', 'uploadFlagFilename_' + code)
  uploadFlagFileName.classList = 'w-100 align-self-center'
  uploadFlagFileName.innerHTML = 'Upload flag'
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

  // Create the delete button
  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col col-12 col-lg-6 col-xl-4 d-flex'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger w-100 align-self-center'
  deleteButton.innerHTML = 'Delete language'
  deleteButton.addEventListener('click', () => {
    deleteLanguageTab(code)
  })
  deleteCol.appendChild(deleteButton)

  // Create the various inputs
  Object.keys(inputFields).forEach((key) => {
    const langKey = key + '_' + code
    const col = document.createElement('div')
    col.classList = 'col-12 col-md-6'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label'
    label.setAttribute('for', langKey)
    label.innerHTML = inputFields[key].name

    if ('tooltip' in inputFields[key]) {
      const tooltip = '\n<span class="badge bg-info ml-1 align-middle" data-bs-toggle="tooltip" data-bs-placement="top" title="' + inputFields[key].tooltip + '" style="font-size: 0.55em;">?</span>'
      label.innerHTML += tooltip
    }
    col.appendChild(label)

    let input

    if (inputFields[key].kind === 'select') {
      input = document.createElement('select')
      input.classList = 'form-select'
      if ('multiple' in inputFields[key] && inputFields[key].multiple === true) {
        input.setAttribute('multiple', true)
      }
    } else if (inputFields[key].kind === 'input') {
      input = document.createElement('input')
      input.setAttribute('type', inputFields[key].type)
      input.classList = 'form-control'
    }
    input.setAttribute('id', langKey)
    input.addEventListener('change', function () {
      let value = $(this).val()
      if (typeof value === 'string') value = value.trim()
      constSetup.updateWorkingDefinition(['languages', code, inputFields[key].property], value)
      previewDefinition(true)
    })
    col.appendChild(input)
  })

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })

  // If we have already loaded a spreadhseet, populate the key options
  const keyList = $('#spreadsheetSelect').data('availableKeys')
  if (keyList != null) {
    populateKeySelects(keyList)
  }

  // Switch to this new tab
  $(tabButton).click()
}

function deleteLanguageTab (lang) {
  // Delete the given language tab.

  delete $('#definitionSaveButton').data('workingDefinition').languages[lang]
  $('#languageTab_' + lang).remove()
  $('#languagePane_' + lang).remove()
  $('.language-tab').click()
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
    endpoint: '/file/delete',
    params: {
      file: flag
    }
  })
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

function onFlagUploadChange (lang) {
  // Called when the user selects a flag image file to upload

  const fileInput = $('#uploadFlagInput_' + lang)[0]

  const file = fileInput.files[0]
  if (file == null) return

  $('#uploadFlagFilename_' + lang).html('Uploading')

  const ext = file.name.split('.').pop()
  const newName = $('#definitionSaveButton').data('workingDefinition').uuid + '_flag_' + lang + '.' + ext

  const formData = new FormData()

  formData.append('files', fileInput.files[0], newName)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/uploadContent', true)

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return
    if (this.status === 200) {
      const response = JSON.parse(this.responseText)

      if ('success' in response) {
        $('#uploadFlagFilename_' + lang).html('Upload')
        $('#flagImg_' + lang).attr('src', '../content/' + newName)
        constSetup.updateWorkingDefinition(['languages', lang, 'custom_flag'], newName)
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
  def.uuid = '__previewMediaBrowser'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../media_browser.html?standalone=true&definition=__previewMediaBrowser'
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'media_browser'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('media_browser')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

function onAttractorFileChange () {
  // Called when a new image or video is selected.

  const file = document.getElementById('attractorSelect').getAttribute('data-filename')
  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  workingDefinition.attractor = file
  $('#definitionSaveButton').data('workingDefinition', structuredClone(workingDefinition))

  previewDefinition(true)
}

function onSpreadsheetFileChange () {
  // Called when a new spreadsheet is selected. Get the csv file and populate the options.

  const file = document.getElementById('spreadsheetSelect').getAttribute('data-filename')
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
      previewDefinition(true)
    })
}

function checkContentExists () {
  // Cross-check content from the spreadsheet with files in the content directory.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const imageKeys = []

  const checkContentButton = document.getElementById('checkContentButton')
  checkContentButton.setAttribute('disabled', true)
  checkContentButton.innerHTML = 'Checking...'

  // Loop through the defintion and collect any unique image keys
  Object.keys(workingDefinition.languages).forEach((lang) => {
    if (imageKeys.includes(workingDefinition.languages[lang].media_key) === false) {
      imageKeys.push(workingDefinition.languages[lang].media_key)
    }
  })

  // Get a list of available content
  let availableContent
  const missingContent = []
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      console.log(result)
      availableContent = result.all_exhibits
      // Retrieve the spreadsheet and check the content for each image key against the available content
      constCommon.makeHelperRequest({
        method: 'GET',
        endpoint: '/content/' + workingDefinition.spreadsheet,
        rawResponse: true
      })
        .then((raw) => {
          const spreadsheet = constCommon.csvToJSON(raw)
          spreadsheet.forEach((row) => {
            imageKeys.forEach((key) => {
              if (row[key].trim() === '') return
              if (availableContent.includes(row[key]) === false) missingContent.push(row[key])
            })
          })
          const missingContentField = document.getElementById('missingContentWarningField')
          if (missingContent.length === 0) {
            missingContentField.classList.add('text-success')
            missingContentField.classList.remove('text-danger')
            missingContentField.innerHTML = 'No missing content!'
          } else {
            missingContentField.classList.add('text-danger')
            missingContentField.classList.remove('text-success')
            let html = '<b>Missing content found:</b><ul>'
            missingContent.forEach((file) => {
              html += '<li>' + file + '</li>'
            })
            html += '</ul>'
            missingContentField.innerHTML = html
          }
          checkContentButton.removeAttribute('disabled')
          checkContentButton.innerHTML = 'Check content'
        })
    })
}

function populateFontSelects () {
  // Get a list of all the content and add the available font files to the appropriate selects.

  const types = ['Title', 'Lightbox_title', 'Lightbox_caption', 'Lightbox_credit']
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

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// The input fields to specifiy content for each langauge
const inputFields = {
  // headerText: {
  //   name: 'Header',
  //   kind: 'input',
  //   type: 'text',
  //   property: 'header_text'
  // },
  keyTitleSelect: {
    name: 'Title key',
    kind: 'select',
    property: 'title_key'
  },
  keyCaptionSelect: {
    name: 'Caption key',
    kind: 'select',
    property: 'caption_key'
  },
  keyCreditSelect: {
    name: 'Credit key',
    kind: 'select',
    property: 'credit_key'
  },
  keyMediaSelect: {
    name: 'Media key',
    kind: 'select',
    property: 'media_key'
  }
  // keyThumbnailSelect: {
  //   name: 'Thumbnail key',
  //   kind: 'select',
  //   property: 'thumbnail_key'
  // }
  // keySearchSelect: {
  //   name: 'Search keys',
  //   kind: 'select',
  //   property: 'search_keys',
  //   multiple: true,
  //   tooltip: 'If search is enabled, the text in the selected keys will be searchable.'
  // },
  // keyFilterSelect: {
  //   name: 'Filter keys',
  //   kind: 'select',
  //   property: 'filter_keys',
  //   multiple: true,
  //   tooltip: 'If filtering is enabled, the values in these keys will be converted to dropdowns. The selected keys should have a set of defined values rather than arbitrary text.'
  // }
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

// Add event listeners
// -------------------------------------------------------------

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})

$('#languageAddButton').click(addLanguage)
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ manage: true })
})
document.getElementById('checkContentButton').addEventListener('click', checkContentExists)

// Definition fields
document.getElementById('spreadsheetSelect').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ filetypes: ['csv'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onSpreadsheetFileChange()
      }
    })
})

document.getElementById('attractorSelect').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ filetypes: ['image', 'video'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onAttractorFileChange()
      }
    })
})
document.getElementById('attractorSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('attractorSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')
  onAttractorFileChange()
})

document.getElementById('inactivityTimeoutField').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['inactivity_timeout'], event.target.value)
  previewDefinition(true)
})

// Layout fields
// document.getElementById('showSearchPaneCheckbox').addEventListener('change', (event) => {
//   updateWorkingDefinition(['style', 'layout', 'show_search_and_filter'], event.target.checked)
//   previewDefinition(true)
// })
document.getElementById('itemsPerPageInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['style', 'layout', 'items_per_page'], parseInt(event.target.value))
  previewDefinition(true)
})
document.getElementById('numColsSelect').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['style', 'layout', 'num_columns'], parseInt(event.target.value))
  previewDefinition(true)
})
document.getElementById('imageHeightSlider').addEventListener('input', (event) => {
  constSetup.updateWorkingDefinition(['style', 'layout', 'image_height'], parseInt(event.target.value))
  previewDefinition(true)
})
Array.from(document.querySelectorAll('.height-slider')).forEach((el) => {
  el.addEventListener('input', () => {
    const titleHeight = parseInt(document.getElementById('lightboxTitleHeightSlider').value)
    const captionHeight = parseInt(document.getElementById('lightboxCaptionHeightSlider').value)
    const creditHeight = parseInt(document.getElementById('lightboxCreditHeightSlider').value)
    const imageHeight = 100 - titleHeight - captionHeight - creditHeight
    constSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_title_height'], titleHeight)
    constSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_caption_height'], captionHeight)
    constSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_credit_height'], creditHeight)
    constSetup.updateWorkingDefinition(['style', 'layout', 'lightbox_image_height'], imageHeight)
    previewDefinition(true)
  })
})

// Style fields
$('.coloris').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['style', 'color', $(this).data('property')], value)
  previewDefinition(true)
})
$('#uploadFontInput').change(onFontUploadChange)

$('.font-select').change(function () {
  const value = $(this).val().trim()
  constSetup.updateWorkingDefinition(['style', 'font', $(this).data('property')], value)
  previewDefinition(true)
})

// Text size fields
Array.from(document.querySelectorAll('.text-size-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['style', 'text_size', property], parseFloat(event.target.value))
    previewDefinition(true)
  })
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

populateFontSelects()
clearDefinitionInput()

constSetup.configure({
  app: 'media_browser',
  loadDefinition: editDefinition
})
