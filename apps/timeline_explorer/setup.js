/* global Coloris */

import * as constCommon from '../js/constellation_app_common.js'

function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  $('#availableDefinitionSelect').empty()
  availableDefinitions = definitions
  const keys = Object.keys(definitions).sort()

  keys.forEach((name) => {
    if (name.slice(0, 9) === '__preview') return
    const option = document.createElement('option')
    option.value = name
    option.innerHTML = name

    $('#availableDefinitionSelect').append(option)
  })
}

function clearDefinitionInput () {
  // Clear all input related to a defnition

  $('#definitionSaveButton').data('initialDefinition', { uuid: '', languages: {} })
  $('#definitionSaveButton').data('workingDefinition', { uuid: '', languages: {} })

  // Language add
  $('#languageAddEmptyFieldsWarning').hide()
  $('#languageAddExistsWarning').hide()

  // Definition details
  $('#definitionNameInput').val('')
  $('#languageNav').empty()
  $('#languageNavContent').empty()
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function editDefinition (name = '') {
  // Populate the given definition for editing.

  clearDefinitionInput()

  const def = getDefinitionByName(name)

  $('#definitionSaveButton').data('initialDefinition', def)
  $('#definitionSaveButton').data('workingDefinition', def)

  $('#definitionNameInput').val(def.name)
  $('#spreadsheetSelect').val(def.spreadsheet)

  // Build out the key input interface
  Object.keys(def.languages).forEach((lang) => {
    const langDef = def.languages[lang]
    createLanguageTab(lang, langDef.display_name)

    $('#headerText' + '_' + lang).val(langDef.header_text)
  })

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

  $('#definitionSaveButton').data('workingDefinition', workingDefinition)
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

  // Create the various inputs
  const row = document.createElement('div')
  row.classList = 'row'
  tabPane.appendChild(row)

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
      updateWorkingDefinition(code, langKey, inputFields[key].property)
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

function updateWorkingDefinition (langCode, elementID, property) {
  // Update a field in the working defintion.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const value = $('#' + elementID).val().trim()

  workingDefinition.languages[langCode][property] = value

  $('#definitionSaveButton').data('workingDefinition', workingDefinition)
  console.log(workingDefinition)
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

function previewDefinition () {
  // Save the definition to a temporary file and load it into the preview frame.

  const def = $('#definitionSaveButton').data('workingDefinition')
  // Set the uuid to a temp one
  def.uuid = '__previewTimeline'

  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../timeline_explorer.html?preview=true&definition=__previewTimeline'
      }
      document.getElementById('previewFrame').contentWindow.location.reload()
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  definition.app = 'timeline_explorer'
  definition.name = $('#definitionNameInput').val()

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', definition)
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
    $('#definitionSaveButton').data('workingDefinition', workingDefinition)
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

// Set up the save button in case the user starts editing immediately
$('#definitionSaveButton').data('initialDefinition', { uuid: '', languages: {} })
$('#definitionSaveButton').data('workingDefinition', { uuid: '', languages: {} })

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

// Preview frame
window.addEventListener('load', resizePreview)
window.addEventListener('resize', resizePreview)

populateSpreadsheetSelect()
clearDefinitionInput()
