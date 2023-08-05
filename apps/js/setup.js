/* global bootstrap, showdown */

import * as constCommon from './constellation_app_common.js'
import * as constFileSelectModal from './constellation_file_select_modal.js'

function updateParser (update) {
  // Take a list of defaults and build the interface for editing them.

  if ('app' in update) {
    if ('id' in update.app) {
      document.getElementById('IDInput').value = update.app.id
    }
    if ('group' in update.app) {
      document.getElementById('groupInput').value = update.app.group
    }
  }
  if ('control_server' in update) {
    if ('ip_address' in update.control_server) {
      document.getElementById('controlServerIPInput').value = update.control_server.ip_address
    }
    if ('port' in update.control_server) {
      document.getElementById('controlServerPortInput').value = update.control_server.port
    }
  }
  if ('system' in update) {
    if ('port' in update.system) {
      document.getElementById('remoteDisplayPortInput').value = update.system.port
    }
    if ('remote_display' in update.system) {
      document.getElementById('useRemoteDisplayToggle').checked = update.system.remote_display
    }
    if ('standalone' in update.system) {
      document.getElementById('useControlServerToggle').checked = ~update.system.standalone
    }
  }
  configureInterface()
}

function configureInterface () {
  // Check the state of various toggles and show/hide interface elements as appropriate.

  // Control Server
  if (document.getElementById('useControlServerToggle').checked === true) {
    document.getElementById('IDInputGroup').style.display = 'block'
    document.getElementById('groupInputGroup').style.display = 'block'
    document.getElementById('definitionSelectGroup').style.display = 'none'
    document.getElementById('controlServerIPInputGroup').style.display = 'block'
    document.getElementById('controlServerPortInputGroup').style.display = 'block'
    document.getElementById('smartRestartPane').style.display = 'block'
  } else {
    document.getElementById('IDInputGroup').style.display = 'none'
    document.getElementById('groupInputGroup').style.display = 'none'
    document.getElementById('definitionSelectGroup').style.display = 'block'
    document.getElementById('controlServerIPInputGroup').style.display = 'none'
    document.getElementById('controlServerPortInputGroup').style.display = 'none'
    document.getElementById('smartRestartPane').style.display = 'none'
  }
  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'block'
  } else {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'none'
  }
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
    dmx_control: '/dmx_control/',
    infostation: '/InfoStation/',
    media_browser: '/media_browser/',
    media_player: '/media_player/',
    timelapse_viewer: '/timelapse_viewer/',
    timeline_explorer: '/timeline_explorer/',
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
        img.style.maxWidth = '100%'
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

function populateAvailableDefinitions () {
  // Get a list of available definitions and format it for the select.

  const definitionSelect = document.getElementById('definitionSelect')
  definitionSelect.innerHTML = ''

  const optionsByApp = {}

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      // First, create option elements and sort them into catefories by app
      Object.keys(result.definitions).forEach((key) => {
        const def = result.definitions[key]
        if (def.uuid.slice(0, 9) === '__preview') return

        const option = new Option(def.name, def.uuid)
        if (def.app in optionsByApp) {
          optionsByApp[def.app].push(option)
        } else {
          optionsByApp[def.app] = [option]
        }
      })
      // Then, sort the categories and add them with header entries
      Object.keys(optionsByApp).sort().forEach((app) => {
        const header = new Option(constCommon.appNameToDisplayName(app))
        header.setAttribute('disabled', true)
        definitionSelect.appendChild(header)

        optionsByApp[app].sort().forEach((option) => definitionSelect.appendChild(option))
      })
    })
}

constCommon.config.helperAddress = window.location.origin
constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.constellationAppID = 'settings'

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')

constCommon.askForDefaults()
loadVersion()
populateHelpTab()
populateAvailableDefinitions()

// Add event handlers
// Settings page
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelectModal.createFileSelectionModal({ manage: true })
})
Array.from(document.querySelectorAll('.gui-toggle')).forEach((el) => {
  el.addEventListener('change', configureInterface)
})

// Apps page
$('#DMXControlHelpButton').click(function () {
  showAppHelpMOdal('dmx_control')
})
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
$('#timelineExplorerHelpButton').click(function () {
  showAppHelpMOdal('timeline_explorer')
})
$('#wordCloudHelpButton').click(function () {
  showAppHelpMOdal('word_cloud')
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}
