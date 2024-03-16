import * as constCommon from '../js/constellation_app_common.js'
import * as constSetup from '../js/constellation_setup_common.js'

function initializeDefinition () {
  // Create a blank definition at save it to workingDefinition.

  return new Promise(function (resolve, reject) {
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
        constSetup.previewDefinition()
        resolve()
      })
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await initializeDefinition()
  }

  // Definition details
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('keyList').innerHTML = ''
  document.getElementById('pathInput').value = ''
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
  constSetup.previewDefinition()
}

function saveDefinition () {
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

// Settings
document.getElementById('pathInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['path'], event.target.value)
  constSetup.previewDefinition()
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
  clearDefinition: clearDefinitionInput,
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
})

constCommon.askForDefaults(false)
  .then(() => {
    if (constCommon.config.standalone === false) {
      // We are using Control Server, so attempt to log in
      constSetup.authenticateUser()
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
    }
  })
