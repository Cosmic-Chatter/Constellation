/* global platform */

export const config = {
  allowedActionsDict: { refresh: 'true' },
  AnyDeskID: '',
  autoplayAudio: false,
  constellationAppID: '',
  contentPath: 'content',
  currentExhibit: 'default',
  currentInteraction: false,
  errorDict: {},
  group: 'Default',
  helperAddress: 'http://localhost:8000',
  id: 'TEMP ' + String(new Date().getTime()),
  imageDuration: 10, // seconds
  platformDetails: {},
  serverAddress: '',
  softwareUpdateLocation: 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/apps/_static/version.txt',
  softwareVersion: 2.0,
  updateParser: null // Function used by readUpdate() to parse app-specific updates
}

config.platformDetails = {
  operating_system: String(platform.os),
  browser: platform.name + ' ' + platform.version
}

function makeRequest (opt) {
  // Function to make a request to a server and return a Promise with the result
  // 'opt' should be an object with all the necessry options

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest()
    xhr.open(opt.method, opt.url + opt.endpoint, true)
    xhr.timeout = opt.timeout ?? 2000 // ms
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        if ('rawResponse' in opt && opt.rawResponse === true) {
          resolve(xhr.responseText)
        } else {
          resolve(JSON.parse(xhr.responseText))
        }
      } else {
        console.log(xhr)
        reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with data`, opt.params))
      }
    }
    xhr.onerror = function () {
      console.log(xhr)
      reject(new Error(`Unable to complete $opt.{method} to ${opt.url + opt.endpoint} with data`, opt.params))
    }
    let paramText = null
    if (opt.params != null) {
      xhr.setRequestHeader('Content-Type', 'application/json')
      paramText = JSON.stringify(opt.params)
    }
    xhr.send(paramText)
  })
}

export function makeServerRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = config.serverAddress
  return makeRequest(opt)
}

export function makeHelperRequest (opt) {
  // Shortcut for making a server request and returning a Promise

  opt.url = config.helperAddress
  return makeRequest(opt)
}

export function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)
  const searchParams = new URLSearchParams(queryString)

  return searchParams
}

export function sendPing () {
  // Contact the control server and ask for any updates
  if (config.serverAddress === '') {
    console.log('Aborting ping... no config.serverAddress')
    return
  }

  const pingRequest = function () {
    // Parse the IP address of the helper to see if it will be the same as the client
    const helperIPSameAsClient = config.helperAddress.includes('localhost') || config.helperAddress.includes('127.0.0.1') || config.helperAddress.includes('0.0.0.0')

    const requestDict = {
      id: config.id,
      group: config.group,
      helperPort: config.helperAddress.split(':')[2], // Depreciated
      helperAddress: config.helperAddress,
      helperIPSameAsClient,
      allowed_actions: config.allowedActionsDict,
      constellation_app_id: config.constellationAppID,
      platform_details: config.platformDetails,
      AnyDeskID: config.AnyDeskID,
      currentInteraction: config.currentInteraction,
      imageDuration: config.imageDuration,
      autoplay_audio: config.autoplayAudio
    }
    // See if there is an error to report
    const errorString = JSON.stringify(config.errorDict)
    if (errorString !== '') {
      requestDict.error = errorString
    }

    makeServerRequest(
      {
        method: 'POST',
        endpoint: '/system/ping',
        params: requestDict
      })
      .then(readUpdate)
  }

  // First, check the helper for updates, then send the ping
  checkForHelperUpdates()
    .then(pingRequest)
    .catch(pingRequest)
}

export function wakeDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  makeHelperRequest({
    method: 'GET',
    endpoint: '/wakeDisplay'
  })
}

function sleepDisplay () {
  // Send a message to the local helper process and ask it to sleep the
  // displays

  makeHelperRequest({
    method: 'GET',
    endpoint: '/sleepDisplay'
  })
}

export function askForRestart () {
  // Send a message to the local helper and ask for it to restart the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/restart'
  })
}

export function askForShutdown () {
  // Send a message to the local helper and ask for it to shutdown the PC

  makeHelperRequest({
    method: 'GET',
    endpoint: '/shutdown'
  })
}

function readUpdate (update) {
  // Function to read a message from the server and take action based on the contents
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
        if ('refresh' in config.allowedActionsDict && stringToBool(config.allowedActionsDict.refresh) === true) {
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
  if ('group' in update) {
    config.group = update.group
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
  if ('allow_refresh' in update) {
    config.allowedActionsDict.refresh = update.allow_refresh
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
  if ('autoplay_audio' in update) {
    config.autoplayAudio = update.autoplay_audio
  }
  if (sendUpdate) {
    sendConfigUpdate(update)
  }

  // After we have saved any updates, see if we should change the app
  if (stringToBool(parseQueryString().get('showSettings')) === false) {
    if ('app_name' in update &&
        update.app_name !== config.constellationAppID &&
        update.app_name !== '') {
      gotoApp(update.app_name)
    }
  }

  // Call the updateParser, if provided, to parse actions for the specific app
  if (typeof config.updateParser === 'function') {
    config.updateParser(update)
  }
}

export function askForDefaults () {
  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  const checkAgain = function () {
    $('#helperConnectionWarningAddress').text(config.helperAddress)
    $('#helperConnectionWarning').show()
    console.log('Could not get defaults... checking again')
    setTimeout(askForDefaults, 500)
  }
  return makeHelperRequest({
    method: 'GET',
    endpoint: '/getDefaults'
  })
    .then(readUpdate, checkAgain)
}

export function checkForHelperUpdates () {
  // Function to ask the helper for any new updates

  return makeHelperRequest({
    method: 'GET',
    endpoint: '/getUpdate',
    timeout: 500
  })
    .then(readUpdate)
}

export function sendConfigUpdate (update) {
  // Send a message to the helper with the latest configuration to set as
  // the default

  const defaults = { content: update.content, current_exhibit: update.current_exhibit }

  const requestDict = { action: 'updateDefaults', defaults }

  makeHelperRequest(
    {
      method: 'POST',
      endpoint: '/setDefaults',
      params: requestDict
    })
}

export function checkForSoftwareUpdate () {
  if (config.softwareUpdateLocation === '') {
    return
  }

  return makeRequest({
    method: 'GET',
    url: config.softwareUpdateLocation,
    endpoint: '',
    timeout: 1000,
    rawResponse: true
  })
    .then((result) => {
      if (parseFloat(result) > config.softwareVersion) {
        config.errorDict.softwareUpdateAvailable = 'true'
      }
    })
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

  if (typeof str === 'boolean') {
    return str
  }

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

  makeServerRequest(
    {
      method: 'POST',
      endpoint: '/tracker/submitAnalytics',
      params: requestDict,
      timeout: 5000
    })
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
    }
  })
  return value
}

export function csvToJSON (csv) {
  // From https://stackoverflow.com/questions/59016562/parse-csv-records-in-to-an-array-of-objects-in-javascript

  const lines = csv.split('\n')
  const result = []
  const headers = lines[0].split(',')

  for (let i = 1; i < lines.length; i++) {
    const obj = {}

    if (lines[i] === undefined || lines[i].trim() === '') {
      continue
    }

    // regex to split on comma, but ignore inside of ""
    const words = splitCsv(lines[i])
    for (let j = 0; j < words.length; j++) {
      // Clean up "" used to escape commas in the CSV
      let word = words[j].trim()
      if (word.slice(0, 1) === '"' && word.slice(-1) === '"') {
        word = word.slice(1, -1)
      }

      word = word.replaceAll('""', '"')
      obj[headers[j].trim()] = word.trim()
    }

    result.push(obj)
  }
  return result
}

function splitCsv (str) {
  // From https://stackoverflow.com/a/31955570

  return str.split(',').reduce((accum, curr) => {
    if (accum.isConcatting) {
      accum.soFar[accum.soFar.length - 1] += ',' + curr
    } else {
      accum.soFar.push(curr)
    }
    if (curr.split('"').length % 2 === 0) {
      accum.isConcatting = !accum.isConcatting
    }
    return accum
  }, { soFar: [], isConcatting: false }).soFar
}

export function gotoApp (app) {
  // Change the browser location to point to the given app.

  const appLocations = {
    infostation: '/infostation.html',
    media_browser: '/media_browser.html',
    media_player: '/media_player.html',
    // media_player_kiosk: 'Media Player Kiosk',
    // sos_kiosk: 'SOS Kiosk',
    // sos_screen_player: 'SOS Screen Player',
    timelapse_viewer: '/timelapse_viewer.html',
    voting_kiosk: '/voting_kiosk.html',
    word_cloud_input: '/word_cloud_input.html',
    word_cloud_viewer: '/word_cloud_viewer.html'
  }

  window.location = config.helperAddress + appLocations[app]
}
