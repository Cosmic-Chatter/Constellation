/* global showdown */

import * as constCommon from './constellation_app_common.js'

function submitAddDefaultModal () {
  if (!$('#settingValueInputField').val().includes('=')) {
    addDefaultFromModal()
    $('#addSettingModal').modal('hide')
  } else {
    $('#modalEqualSignWarning').show()
  }
}

function showAddDefaultModal () {
  $('#settingKeyInputField').val('')
  $('#settingValueInputField').val('')
  $('#modalEqualSignWarning').hide()

  // Update the select with any unused/available keys
  $('#availableKeys').empty()
  const blank = document.createElement('option')
  blank.value = ''
  blank.innerHTML = ''
  $('#availableKeys').append(blank)
  const currentKeys = getExistingKeys()
  knownKeys.forEach(function (key, identifies) {
    if (!currentKeys.includes(key.key)) {
      const option = document.createElement('option')
      option.value = key.key
      option.innerHTML = key.key
      $('#availableKeys').append(option)
    }
  })

  $('#addSettingModal').modal('show')
}

function addDefaultFromModal () {
  // Gather the input from the modal and create a defaultCard

  const key = $('#settingKeyInputField').val().toLowerCase()
  const value = $('#settingValueInputField').val().toLowerCase()
  createDefaultCard(key, value)

  // Clear the data so we don't double-add the default
  $('#settingKeyInputField').val('')
  $('#settingValueInputField').val('')
}

function createDefaultCard (key, value) {
  // Create the HTML element corresponding to the given default and add it to
  // the cardRowCurrent

  // Look up and see if we know this key
  const keyInfo = lookupKnownKey(key)

  let resetFunction = null // The function to reset the date to what was passed.

  const col = document.createElement('div')
  col.classList.add('defaultsCol', 'col-12', 'col-sm-6', 'col-md-4', 'col-lg-3', 'col-xl-2', 'my-2', 'py-3', 'px-1')
  col.setAttribute('data-key', key)

  const title = document.createElement('div')
  title.classList.add('bg-secondary', 'w-100', 'px-1', 'py-1')
  // Add a "required" badge, if appropriate
  const name = document.createElement('span')
  name.classList.add('h4', 'pr-2', 'align-middle')
  name.innerHTML = key
  title.append(name)
  col.append(title)

  const card = document.createElement('div')
  card.classList.add('defaultCard', 'px-2', 'py-2', 'border', 'rounded-bottom', 'border-secondary', 'h-100', 'd-flex', 'flex-column')
  col.append(card)

  const description = document.createElement('div')
  description.classList.add('mt-1')
  description.innerHTML = keyInfo.description
  card.append(description)

  if (['text', 'number'].includes(keyInfo.type)) {
    const input = document.createElement('input')
    input.setAttribute('type', keyInfo.type)
    input.setAttribute('value', value)
    resetFunction = function () { $(input).val(value) }
    input.classList.add('defaultsValue', 'w-100', 'mt-3')
    card.append(input)
  } else if (keyInfo.type === 'bool') {
    const select = document.createElement('select')
    select.classList.add('defaultsValue', 'w-100', 'mt-3')
    const optionTrue = document.createElement('option')
    optionTrue.value = 'true'
    optionTrue.text = 'True'
    select.appendChild(optionTrue)
    const optionFalse = document.createElement('option')
    optionFalse.value = 'false'
    optionFalse.text = 'False'
    select.appendChild(optionFalse)
    select.value = value.toLowerCase()
    resetFunction = function () { $(select).val(value.toLowerCase()) }
    card.append(select)
  }

  const buttonRow = document.createElement('div')
  buttonRow.classList.add('row', 'mt-auto')
  card.append(buttonRow)

  const buttonCol1 = document.createElement('div')
  buttonCol1.classList.add('col-6')
  buttonRow.append(buttonCol1)

  const resetButton = document.createElement('button')
  resetButton.classList.add('btn', 'btn-warning', 'w-100')
  resetButton.innerHTML = 'Reset'
  resetButton.addEventListener('click', resetFunction)
  buttonCol1.append(resetButton)

  const buttonCol2 = document.createElement('div')
  buttonCol2.classList.add('col-6')
  buttonRow.append(buttonCol2)

  const deleteButton = document.createElement('button')
  deleteButton.classList.add('btn', 'btn-danger', 'w-100')
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', function () { $(this).closest('.defaultsCol').remove() })
  buttonCol2.append(deleteButton)

  if (keyInfo.required) {
    deleteButton.innerHTML = 'Required'
    deleteButton.disabled = true
  }

  $('#cardRowCurrent').append(col)
}

function lookupKnownKey (key) {
  // Search through the known keys and return a matching one, if it exists.

  let keyInfo = knownKeys.filter(function (knownKey) {
    return key === knownKey.key
  })[0]
  if (keyInfo == null) {
    keyInfo = { key, type: 'text', description: '' }
  }
  return keyInfo
}

function getExistingKeys () {
  // Return the keys for all the currently-created cards

  const currentKeys = []

  $('.defaultsCol').each(function (i) {
    if ($(this).find('.defaultsValue').val() === '') {
      $(this).find('.defaultsValue').val('null')
    }
    currentKeys.push($(this).data('key'))
  })
  return currentKeys
}

function updateParser (defaultsList) {
  // Take a list of defaults and build the interface for editing them.

  // Remove keys that don't go into defaults.ini
  const keysToIgnore = ['availableContent',
    'content',
    'contentPath',
    'dictionary',
    'helperAddress',
    'helperSoftwareUpdateAvailable']
  keysToIgnore.forEach((key) => {
    delete defaultsList[key]
  })

  const defaultsKeys = Object.keys(defaultsList)
  defaultsKeys.forEach((key, i) => {
    createDefaultCard(key, defaultsList[key])
  })
}

function updateDefaults () {
  // Iterate through the defaultCards and collect the new defaults.

  const newDefaults = {}

  $('.defaultsCol').each(function (i) {
    if ($(this).find('.defaultsValue').val() === '') {
      $(this).find('.defaultsValue').val('null')
    }
    newDefaults[$(this).data('key')] = $(this).find('.defaultsValue').val()
  })

  // Send the new defaults back to the helper for committing.
  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/rewriteDefaults',
    params: { defaults: newDefaults }
  })
}

function loadVersion () {
  // Load version.txt and update the GUI with the current version

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/_static/version.txt',
    rawResponse: true
  })
    .then((response) => {
      $('#versionSpan').html(response)
    })
}

function showAppHelpMOdal (app) {
  // Ask the helper to send the relavent README.md file and display it in the modal

  const endpointStems = {
    infostation: '/InfoStation/',
    media_browser: '/media_browser/',
    media_player: '/media_player/',
    timelapse_viewer: '/timelapse_viewer/',
    voting_kiosk: '/voting_kiosk/',
    word_cloud: '/word_cloud/'
  }

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: endpointStems[app] + 'README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)
      // Add the formatted text
      $('#helpTextDiv').html(formattedText)
      // Then, search the children for images and fix the links with the right endpoints
      $('#helpTextDiv').find('img').each((i, img) => {
        // Strip off the http://localhost:8000/ porition
        const src = img.src.split('/').slice(3).join('/')
        // Rebuild the correct path
        img.src = constCommon.config.helperAddress + endpointStems[app] + '/' + src
      })
      $('#helpTextDiv').parent().parent().scrollTop(0)
    })

  $('#appHelpModal').modal('show')
}

function populateHelpTab () {
  // Load the overall README.md and add its contents to the Help tab

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)
      // Add the formatted text
      $('#mainHelpTextDiv').html(formattedText)
    })
}

constCommon.config.helperAddress = window.location.origin
constCommon.config.updateParser = updateParser // Function to read app-specific updatess

// For known keys, define their options
const knownKeys = [
  { key: 'active_hours_end', type: 'text', required: false, description: "Some actions, such as Smart Restart, will be blocked before this time (e.g., '9 pm')." },
  { key: 'active_hours_start', type: 'text', required: false, description: "Some actions, such as Smart Restart, will be blocked after this time (e.g., '6 am')." },
  { key: 'allow_restart', type: 'bool', required: false, description: 'Allow the component to restart the PC.' },
  { key: 'allow_shutdown', type: 'bool', required: false, description: 'Allow the component to shutdown the PC. This should only be enabled in Wake on LAN is set up.' },
  { key: 'allow_sleep', type: 'bool', required: false, description: 'Allow the component to sleep the screen. This may not work on all devices.' },
  { key: 'anydesk_id', type: 'text', required: false, description: 'If AnyDesk is configured for this device, you can add its ID, which enables a button in the web console.' },
  { key: 'autoplay_audio', type: 'bool', required: false, description: 'Allow audio to play automatically. If this is set to true, you must have set up your web browser to allow automatic audio.' },
  { key: 'current_exhibit', type: 'text', required: true, description: 'This will be managed automatically by Constellation.' },
  { key: 'display_type', type: 'text', required: false, description: "Set to 'screen' or 'projector'. This usually has no effect." },
  { key: 'helper_port', type: 'text', required: true, description: 'The port on which this helper is operating.' },
  { key: 'id', type: 'text', required: true, description: 'A unique name that identifies this component.' },
  { key: 'image_duration', type: 'number', required: false, description: 'The number of seconds that each image will be shown.' },
  { key: 'kiosk_id', type: 'text', required: false, description: 'A unique name that identifies the kiosk. Must be unique from the main component.' },
  { key: 'kiosk_type', type: 'text', required: false, description: 'A user-defined grouping for this component.' },
  { key: 'server_ip_address', type: 'text', required: true, description: 'The IP address of the Constellation Control Server that this component should connect to.' },
  { key: 'server_port', type: 'number', required: true, description: 'The port of the Constellation Control Server that this component should connect to.' },
  { key: 'smart_restart', type: 'text', required: false, description: 'Smart Restart mode (off | patient | aggressive).' },
  { key: 'smart_restart_interval', type: 'number', required: false, description: 'Time in seconds to poll Control Server.' },
  { key: 'smart_restart_threshold', type: 'number', required: false, description: 'Time in seconds since last connection before reboot should be triggered.' },
  { key: 'sos_ip_address', type: 'text', required: false, description: 'The IP address of the Science ona Sphere control computer.' },
  { key: 'type', type: 'text', required: true, description: 'A user-defined grouping for this component.' }
]

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')

constCommon.askForDefaults()
loadVersion()
populateHelpTab()

// Add event handlers
// Settings page
$('#submitAddDefaultFromModal').click(submitAddDefaultModal)
$('#saveDefaultButton').click(updateDefaults)
$('#addDefaultButton').click(showAddDefaultModal)
$('#availableKeys').change(function () {
  $('#settingKeyInputField').val($('#availableKeys').val())
})

// Apps page
$('#InfoStationHelpButton').click(function () {
  showAppHelpMOdal('infostation')
})
$('#mediaBrowserHelpButton').click(function () {
  showAppHelpMOdal('media_browser')
})
$('#mediaPlayerHelpButton').click(function () {
  showAppHelpMOdal('media_player')
})
$('#timelapseViewerHelpButton').click(function () {
  showAppHelpMOdal('timelapse_viewer')
})
$('#votingKioskHelpButton').click(function () {
  showAppHelpMOdal('voting_kiosk')
})
$('#wordCloudHelpButton').click(function () {
  showAppHelpMOdal('word_cloud')
})
