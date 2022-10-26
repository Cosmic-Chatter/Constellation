/* global platform */

export const config = {
  allowedActionsDict: { refresh: 'true' },
  AnyDeskID: '',
  constellationAppID: '',
  contentPath: 'content',
  currentExhibit: 'default',
  currentInteraction: false,
  errorDict: {},
  helperAddress: 'http://localhost:8000',
  id: 'TEMP',
  platformDetails: {},
  serverAddress: '',
  softwareUpdateLocation: '', // URL to the version.txt file for this app
  softwareVersion: 1.0,
  type: 'TEMP',
  updateParser: null // Function used by readUpdate() to parse app-specific updates
}

config.platformDetails = {
  operating_system: String(platform.os),
  browser: platform.name + ' ' + platform.version
}

export function sendPing () {
  // Contact the control server and ask for any updates

  if (config.serverAddress !== '') {
    const requestDict = {
      id: config.id,
      type: config.type,
      helperPort: config.helperAddress.split(':')[2], // Depreciated
      helperAddress: config.helperAddress,
      allowed_actions: config.allowedActionsDict,
      constellation_app_id: config.constellationAppID,
      platform_details: config.platformDetails,
      AnyDeskID: config.AnyDeskID,
      currentInteraction: config.currentInteraction
    }

    // See if there is an error to report
    const errorString = JSON.stringify(config.errorDict)
    if (errorString !== '') {
      requestDict.error = errorString
    }
    const requestString = JSON.stringify(requestDict)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', config.serverAddress + '/system/ping', true)
    xhr.timeout = 2000
    xhr.setRequestHeader('Content-Type', 'application/json')

    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return

      if (this.status === 200) {
        if (this.responseText !== '') {
          readUpdate(JSON.parse(this.responseText))
        }
      }
    }
    xhr.send(requestString)
  }
}

export function wakeDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  // const requestString = JSON.stringify({ action: 'wakeDisplay' })

  const xhr = new XMLHttpRequest()
  xhr.open('GET', config.helperAddress + '/wakeDisplay', true)
  xhr.timeout = 2000
  xhr.setRequestHeader('Content-Type', 'application/json')
  // xhr.onreadystatechange = function () {
  //   if (this.readyState !== 4) return

  //   if (this.status === 200) {
  //   }
  // }
  xhr.send()
}

function sleepDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  // const requestString = JSON.stringify({ action: 'sleepDisplay' })

  const xhr = new XMLHttpRequest()
  xhr.open('GET', config.helperAddress + '/sleepDisplay', true)
  xhr.timeout = 2000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send()
}

export function askForRestart () {
  // Send a message to the local helper and ask for it to restart the PC

  // const requestString = JSON.stringify({ action: 'restart' })

  const xhr = new XMLHttpRequest()
  xhr.open('GET', config.helperAddress + '/restart', true)
  xhr.timeout = 2000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send()
}

export function askForShutdown () {
  // Send a message to the local helper and ask for it to shutdown the PC

  // const requestString = JSON.stringify({ action: 'shutdown' })

  const xhr = new XMLHttpRequest()
  xhr.open('GET', config.helperAddress + 'shutdown', true)
  xhr.timeout = 2000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send()
}

function readUpdate (update) {
  // Function to read a message from the server and take action based
  // on the contents
  // 'update' should be an object

  let sendUpdate = false

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]

      if (cmd === 'restart') {
        askForRestart()
      } else if (cmd === 'shutdown' || cmd === 'power_off') {
        askForShutdown()
      } else if (cmd === 'sleepDisplay') {
        sleepDisplay()
      } else if (cmd === 'wakeDisplay' || cmd === 'power_on') {
        wakeDisplay()
      } else if (cmd === 'refresh_page') {
        if ('refresh' in config.allowedActionsDict && config.allowedActionsDict.refresh === 'true') {
          location.reload()
        }
      } else if (cmd === 'reloadDefaults') {
        askForDefaults()
      } else {
        console.log(`Command not recognized: ${cmd}`)
      }
    }
  }
  if ('id' in update) {
    config.id = update.id
  }
  if ('type' in update) {
    config.type = update.type
  }
  if (('server_ip_address' in update) && ('server_port' in update)) {
    config.serverAddress = 'http://' + update.server_ip_address + ':' + update.server_port
  }
  if ('helperAddress' in update) {
    config.helperAddress = update.helperAddress
  }
  if ('contentPath' in update) {
    config.contentPath = update.contentPath
  }
  if ('current_exhibit' in update) {
    if (update.currentExhibit !== config.currentExhibit) {
      sendUpdate = true
      config.currentExhibit = update.current_exhibit
    }
  }
  if ('missingContentWarnings' in update) {
    config.errorDict.missingContentWarnings = update.missingContentWarnings
  }

  if ('allow_sleep' in update) {
    config.allowedActionsDict.sleep = update.allow_sleep
  }
  if ('allow_restart' in update) {
    config.allowedActionsDict.restart = update.allow_restart
  }
  if ('allow_shutdown' in update) {
    config.allowedActionsDict.shutdown = update.allow_shutdown
  }
  if ('helperSoftwareUpdateAvailable' in update) {
    if (update.helperSoftwareUpdateAvailable === 'true') { config.errorDict.helperSoftwareUpdateAvailable = 'true' }
  }
  if ('anydesk_id' in update) {
    config.AnyDeskID = update.anydesk_id
  }

  if (sendUpdate) {
    sendConfigUpdate(update)
  }

  // Call the updateParser, if provided, to parse actions for the specific app
  if (typeof config.updateParser === 'function') {
    config.updateParser(update)
  }
}

export function askForDefaults () {
  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  // const requestString = JSON.stringify({ action: 'getDefaults' })
  const checkAgain = function () {
    $('#helperConnectionWarningAddress').text(config.helperAddress)
    $('#helperConnectionWarning').show()
    console.log('Could not get defaults... checking again')
    setTimeout(askForDefaults, 500)
  }
  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.onerror = checkAgain
  xhr.ontimeout = checkAgain
  xhr.open('GET', config.helperAddress + '/getDefaults', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      $('#helperConnectionWarning').hide()
      readUpdate(JSON.parse(this.responseText))
    }
  }
  xhr.send()
}

export function checkForHelperUpdates () {
  // Function to ask the helper for any new updates

  // const requestString = JSON.stringify({ action: 'getUpdate' })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 50
  xhr.open('GET', config.helperAddress + '/getUpdate', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      readUpdate(JSON.parse(this.responseText))
    }
  }
  xhr.send()
}

export function sendConfigUpdate (update) {
  // Send a message to the helper with the latest configuration to set as
  // the default

  const defaults = { content: update.content, current_exhibit: update.current_exhibit }

  const requestDict = { action: 'updateDefaults', defaults }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 1000
  xhr.open('POST', config.helperAddress + '/setDefaults', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(JSON.stringify(requestDict))
}

export function checkForSoftwareUpdate () {
  if (config.softwareUpdateLocation === '') {
    return
  }
  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('GET', config.softwareUpdateLocation, true)
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (parseFloat(this.responseText) > config.softwareVersion) {
        config.errorDict.softwareUpdateAvailable = 'true'
      }
    }
  }
  xhr.send(null)
}

export function arraysEqual (arr1, arr2) {
  // Function to check if two arrays have the same elements in the same order

  if (arr1.length !== arr2.length) {
    return false
  } else {
    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false
      }
    }
    return true
  }
}

export function stringToBool (str) {
  // Parse a given string and return an appropriate bool

  if (['True', 'true', 'TRUE', '1', 'yes', 'Yes', 'YES'].includes(str)) {
    return true
  } else {
    return false
  }
}

export function sendAnalytics (data) {
  // Take the provided dicitonary of data and send it to the control server

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateString = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  data.datetime = dateString

  // Append the current exhibit
  data.exhibit = config.current_exhibit

  const requestDict = {
    data,
    name: config.id
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', config.serverAddress + '/tracker/submitAnalytics', true)
  xhr.timeout = 5000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  // xhr.onreadystatechange = function () {
  //   if (this.readyState !== 4) return
  //   if (this.status === 200) {
  //   }
  // }
  xhr.send(requestString)
}

export function parseINIString (data) {
  // Take an INI file and return an object with the settings
  // From https://stackoverflow.com/questions/3870019/javascript-parser-for-a-string-which-contains-ini-data

  const regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  }
  const value = {}
  const lines = data.split(/[\r\n]+/)
  let section = null
  lines.forEach(function (line) {
    if (regex.comment.test(line)) {
      return
    } else if (regex.param.test(line)) {
      const match = line.match(regex.param)
      if (section) {
        value[section][match[1]] = match[2]
      } else {
        value[match[1]] = match[2]
      }
    } else if (regex.section.test(line)) {
      const match = line.match(regex.section)
      value[match[1]] = {}
      section = match[1]
    } else if (line.length === 0 && section) {
      section = null
    };
  })
  return value
}
