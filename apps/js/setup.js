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
  if ('permissions' in update) {
    if ('audio' in update.permissions) {
      document.getElementById('permissionsAudioInput').value = String(update.permissions.audio)
    }
    if ('refresh' in update.permissions) {
      document.getElementById('permissionsRefreshInput').value = String(update.permissions.refresh)
    }
    if ('restart' in update.permissions) {
      document.getElementById('permissionsRestartInput').value = String(update.permissions.restart)
    }
    if ('shutdown' in update.permissions) {
      document.getElementById('permissionsShutdownInput').value = String(update.permissions.shutdown)
    } else {
      document.getElementById('permissionsShutdownInput').value = 'false'
    }
    if ('sleep' in update.permissions) {
      document.getElementById('permissionsSleepInput').value = String(update.permissions.sleep)
    }
  }
  if ('smart_restart' in update) {
    if ('state' in update.smart_restart) {
      document.getElementById('smartRestartStateSelect').value = update.smart_restart.state
    }
    if ('interval' in update.smart_restart) {
      document.getElementById('smartRestartIntervalInput').value = update.smart_restart.interval
    }
    if ('threshold' in update.smart_restart) {
      document.getElementById('smartRestartThresholdInput').value = update.smart_restart.threshold
    }
  }
  if ('system' in update) {
    if ('active hours' in update.system) {
      document.getElementById('activeHoursStartInput').value = update.system.active_hours.start
      document.getElementById('activeHoursEndInput').value = update.system.active_hours.end
    }
    if ('port' in update.system) {
      document.getElementById('remoteDisplayPortInput').value = update.system.port
    }
    if ('remote_display' in update.system) {
      document.getElementById('useRemoteDisplayToggle').checked = update.system.remote_display
    }
    if ('standalone' in update.system) {
      document.getElementById('useControlServerToggle').checked = !update.system.standalone
    }
  }
  configureInterface()
}

function saveConfiguration () {
  // Construct an object from the user seetings and send it to the helper for saving.

  const defaults = {
    app: {},
    system: {
      remote_display: document.getElementById('useRemoteDisplayToggle').checked,
      standalone: !document.getElementById('useControlServerToggle').checked
    }
  }

  if (defaults.system.standalone === false) {
    // We are using Control Server, so update relevant defaults
    defaults.app.id = document.getElementById('IDInput').value.trim()
    defaults.app.group = document.getElementById('groupInput').value.trim()
    defaults.control_server = {
      ip_address: document.getElementById('controlServerIPInput').value.trim(),
      port: parseInt(document.getElementById('controlServerPortInput').value)
    }
    defaults.permissions = {
      audio: constCommon.stringToBool(document.getElementById('permissionsAudioInput').value),
      refresh: constCommon.stringToBool(document.getElementById('permissionsRefreshInput').value),
      restart: constCommon.stringToBool(document.getElementById('permissionsRestartInput').value),
      shutdown: constCommon.stringToBool(document.getElementById('permissionsShutdownInput').value),
      sleep: constCommon.stringToBool(document.getElementById('permissionsSleepInput').value)
    }
    defaults.smart_restart = {
      state: document.getElementById('smartRestartStateSelect').value,
      interval: parseInt(document.getElementById('smartRestartIntervalInput').value),
      threshold: parseInt(document.getElementById('smartRestartThresholdInput').value)
    }
    defaults.system.active_hours = {
      start: document.getElementById('activeHoursStartInput').value.trim(),
      end: document.getElementById('activeHoursEndInput').value.trim()
    }
  } else {
    // We are not using Control Server
    defaults.app.definition = document.getElementById('definitionSelect').value
  }

  if (defaults.system.remote_display === true) {
    defaults.system.port = parseInt(document.getElementById('remoteDisplayPortInput').value)
  }

  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/setDefaults',
    params: { defaults }
  })
    .then((result) => {
      const el = document.getElementById('saveDefaultsButton')
      el.classList.add('btn-success')
      el.classList.remove('btn-primary')
      el.innerHTML = 'Saved!'
      setTimeout(() => {
        console.log('here')
        el.classList.remove('btn-success')
        el.classList.add('btn-primary')
        el.innerHTML = 'Save changes'
      }, 2000)
    })
    .catch((result) => {
      const el = document.getElementById('saveDefaultsButton')
      el.classList.add('btn-danger')
      el.classList.remove('btn-primary')
      el.innerHTML = 'Error'
      setTimeout(() => {
        console.log('here')
        el.classList.remove('btn-danger')
        el.classList.add('btn-primary')
        el.innerHTML = 'Save changes'
      }, 2000)
    })
  console.log(defaults)
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
    document.getElementById('permissionsPane').style.display = 'block'
  } else {
    document.getElementById('IDInputGroup').style.display = 'none'
    document.getElementById('groupInputGroup').style.display = 'none'
    document.getElementById('definitionSelectGroup').style.display = 'block'
    document.getElementById('controlServerIPInputGroup').style.display = 'none'
    document.getElementById('controlServerPortInputGroup').style.display = 'none'
    document.getElementById('smartRestartPane').style.display = 'none'
    document.getElementById('permissionsPane').style.display = 'none'
  }
  if (document.getElementById('useRemoteDisplayToggle').checked === true) {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'block'
  } else {
    document.getElementById('remoteDisplayPortInputGroup').style.display = 'none'
  }
  if (document.getElementById('smartRestartStateSelect').value === 'off') {
    Array.from(document.querySelectorAll('.smart-restart-options-div')).forEach((el) => {
      el.style.display = 'none'
    })
  } else {
    Array.from(document.querySelectorAll('.smart-restart-options-div')).forEach((el) => {
      el.style.display = 'block'
    })
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

function populateAvailableData () {
  // Get a list of available data files and populate the voting kiosk download select

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/data/getAvailable'
  })
    .then((result) => {
      const select = document.getElementById('votingKioskCSVDownloadSelect')
      select.innerHTML = ''

      result.files.forEach((file) => {
        const split = file.split('.')
        const noExt = split.slice(0, -1).join('.')
        const option = new Option(noExt)
        select.appendChild(option)
      })
    })
}

function downloadDataAsCSV () {
  // Download the currently selected data file as a CSV file.

  const name = document.getElementById('votingKioskCSVDownloadSelect').value
  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/data/getCSV',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.csv], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(fileBlob)
        a.download = name + '.csv'
        a.click()
      }
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

constCommon.askForDefaults(false)
loadVersion()
populateHelpTab()
populateAvailableData()
populateAvailableDefinitions()

// Add event handlers
// Settings page
document.getElementById('saveDefaultsButton').addEventListener('click', (event) => {
  saveConfiguration()
})
document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelectModal.createFileSelectionModal({ manage: true })
})
Array.from(document.querySelectorAll('.gui-toggle')).forEach((el) => {
  el.addEventListener('change', configureInterface)
})
document.getElementById('smartRestartStateSelect').addEventListener('change', (event) => {
  configureInterface()
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
document.getElementById('votingKioskCSVDownloadButton').addEventListener('click', downloadDataAsCSV)
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
