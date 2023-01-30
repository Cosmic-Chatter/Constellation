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

  $('#definitionSaveButton').data('initialDefinition', { uuid: '' })
  $('#definitionNameInput').val('')
  $('#definitionTitleInput').val('')
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function editDefinition (name = '') {
  // Populate the given definition for editing.

  const def = getDefinitionByName(name)

  $('#definitionSaveButton').data('initialDefinition', def)

  $('#definitionNameInput').val(def.name)
  $('#definitionTitleInput').val(def.title)

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../timeline_explorer.html?preview=true&definition=' + def.uuid
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

function buildDefinitionFromInput () {
  // Use the inputed form data to build a JSON object with the definition.

  const data = $('#definitionSaveButton').data('initialDefinition')
  const definition = {
    app: 'timeline_explorer',
    uuid: data.uuid,
    name: $('#definitionNameInput').val(),
    title: $('#definitionTitleInput').val()
  }
  return definition
}

function previewDefinition () {
  // Save the definition to a temporary file and load it into the preview frame.

  const def = buildDefinitionFromInput()
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

  const definition = buildDefinitionFromInput()

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Update the UUID in case we have created a new definition
        const initialDef = $('#definitionSaveButton').data('initialDefinition')
        initialDef.uuid = result.uuid
        console.log(result.uuid)
        $('#definitionSaveButton').data('initialDefinition', initialDef)
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

// All the available definitions
let availableDefinitions = {}
// Set up the save button in case the user starts editing immediately
$('#definitionSaveButton').data('initialDefinition', { uuid: '' })

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
// Preview frame
window.addEventListener('load', resizePreview)
window.addEventListener('resize', resizePreview)
