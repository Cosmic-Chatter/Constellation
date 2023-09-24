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
          path: '',
          properties: {}
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          path: '',
          properties: {}
        })
        previewDefinition(false)
      })
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('keyList').innerHTML = ''
  document.getElementById('pathInput').value = ''
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

  document.getElementById('pathInput').value = def.path
  Object.keys(def.properties).forEach((key) => {
    createKeyValueHTML(key, def.properties[key])
  })

  // Configure the preview frame
  if (def.path !== '') {
    document.getElementById('previewFrame').src = '../' + def.path + '?standalone=true&definition=' + def.uuid
    document.getElementById('previewFrame').style.display = 'block'
  } else {
    document.getElementById('previewFrame').style.display = 'none'
  }
  previewDefinition()
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
  def.uuid = '__previewOther'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        if (def.path !== '') {
          document.getElementById('previewFrame').src = '../' + def.path + '?standalone=true&definition=__previewOther'
          document.getElementById('previewFrame').style.display = 'block'
        } else {
          document.getElementById('previewFrame').style.display = 'none'
        }
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'other'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('other')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
}

function createKeyValueHTML (key = '', value = '') {
  // Create a new HTML represetnation of a key-value pair

  const keyList = document.getElementById('keyList')

  const uuid = String(new Date().getTime() * Math.random() * 1e6)

  const html = `
  <div id="keyValue_${uuid}" data-uuid="${uuid}" class="keyValuePair col-12">
    <div class="row align-items-center">
      <div class="col-12 col-md-5">
        <div class="form-floating mb-3">
          <input id="key_${uuid}" type="text" class="form-control keyValueInput" placeholder="" value="${key}">
          <label for="key_${uuid}">Key</label>
        </div>
      </div>
      <div class="col-12 col-md-5">
        <div class="form-floating mb-3">
          <input id="value_${uuid}" type="text" class="form-control keyValueInput" placeholder="" value="${value}">
          <label for="value_${uuid}">Value</label>
        </div>
      </div>
      <div class="col-12 col-md-2 col-xxl-1">
        <button id="deleteButton_${uuid}" data-uuid="${uuid}"  class="btn btn-danger w-100 mb-3 keyValue-delete">X</button>
      </div>
    </div>
  </div>
  `
  keyList.innerHTML += html
  document.getElementById('key_' + uuid).addEventListener('change', rebuildPropertyDict)
  document.getElementById('value_' + uuid).addEventListener('change', rebuildPropertyDict)
}

function rebuildPropertyDict () {
  // Build a dictionary of all the keyValue pairs and add it to the definition.

  const dict = {}
  Array.from(document.querySelectorAll('.keyValuePair')).forEach((keyValue) => {
    const uuid = keyValue.getAttribute('data-uuid')
    const key = document.getElementById('key_' + uuid).value
    if (key.trim() === '') return
    dict[key] = document.getElementById('value_' + uuid).value
  })
  constSetup.updateWorkingDefinition(['properties'], dict)
}

// Set helperAddress for calls to constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// Add event listeners
// -------------------------------------------------------------

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})

// Settings
document.getElementById('pathInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['path'], event.target.value)
  previewDefinition()
})
document.getElementById('addKeyButton').addEventListener('click', (event) => {
  createKeyValueHTML()
})

document.addEventListener('click', (event) => {
  if (event.target.classList.contains('keyValue-delete') === false) return
  const uuid = event.target.getAttribute('data-uuid')
  document.getElementById('keyValue_' + uuid).remove()
  rebuildPropertyDict()
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

clearDefinitionInput()

constSetup.configure({
  app: 'other',
  loadDefinition: editDefinition
})
