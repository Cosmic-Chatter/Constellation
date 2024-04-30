/* global showdown */

import constConfig from './config.js'

export function makeRequest (opt) {
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
        console.log('Submitted data: ', opt.params)
        console.log('Response: ', JSON.parse(xhr.response))
        reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with the above data`))
      }
    }
    xhr.onerror = function () {
      console.log('Submitted data: ', opt.params)
      reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with the above data`))
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

  opt.url = constConfig.serverAddress
  return makeRequest(opt)
}

export function extractIPAddress (address) {
  // Extract just the IP address from a web address

  if (address == null) {
    return null
  }
  // Remove the prefix
  address = address.replace('http://', '')
  address = address.replace('https://', '')
  // Find and remove the port
  const colon = address.indexOf(':')
  address = address.slice(0, colon)
  return address
}

export function formatDateTimeDifference (dt1, dt2) {
  // Convert the difference between two times into English
  // dt1 and dt2 should be datetimes or milliseconds

  const diff = (dt1 - dt2)

  const sec = Math.round(diff / 1000) // seconds
  if (sec < 0 && sec > -60) {
    return String(Math.abs(sec)) + ' seconds from now'
  }
  if (sec < 60 && sec >= 0) {
    return String(sec) + ' seconds ago'
  }
  const min = Math.round(diff / 1000 / 60) // minutes
  if (min < 0 && min > -60) {
    return String(Math.abs(min)) + ' minutes from now'
  }
  if (min < 60 && min >= 0) {
    return String(min) + ' minutes ago'
  }
  const hour = Math.round(diff / 1000 / 3600) // hours
  if (min < 0 && min > -24) {
    return String(Math.abs(hour)) + ' hours from now'
  }
  if (hour < 24 && hour >= 0) {
    return String(hour) + ' hours ago'
  }
  const day = Math.round(diff / 1000 / 3600 / 24) // days
  if (day < 0) {
    return String(Math.abs(day)) + ' days from now'
  }
  return String(day) + ' days ago'
}

export function guessMimetype (filename) {
  // Use filename's extension to guess the mimetype

  const ext = filename.split('.').slice(-1)[0].toLowerCase()

  if (['mp4', 'mpeg', 'webm', 'mov', 'm4v', 'avi', 'flv'].includes(ext)) {
    return 'video'
  } else if (['jpeg', 'jpg', 'tiff', 'tif', 'png', 'bmp', 'gif', 'webp', 'eps', 'ps', 'svg'].includes(ext)) {
    return 'image'
  }
}

export function openMediaInNewTab (filenames, fileTypes) {
  // Open the media files given by filename in a new browser tab

  console.log('Opening files in new tab:', filenames)

  let margin
  if (filenames.length > 1) {
    margin = '1vmax'
  } else {
    margin = 'auto'
  }
  let html = `
  <html>
    <head>
      <style>
        @media (orientation: landscape) {
          .zoomedOut{
            display: block;
            height: 100%;
            margin: ${margin};
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            cursor: zoom-in;
            -webkit-user-select: none;
          }
        }
        @media (orientation: portrait) {
          .zoomedOut{
            display: block;
            width: 100%;
            margin: ${margin};
            padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
            cursor: zoom-in;
            -webkit-user-select: none;
          }
        }

        .zoomedIn{
          display: block;
          margin: ${margin};
          padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
          cursor: zoom-out;
          -webkit-user-select: none;
        }
      </style>
      <title>Control Server Media Viewer</title>
    </head>
    <body style="margin: 0px">
  `

  for (let i = 0; i < filenames.length; i++) {
    let fileType
    if (fileTypes == null) {
      fileType = guessMimetype(filenames[i])
    } else {
      fileType = fileTypes[i]
    }

    if (fileType === 'image') {
      html += `<img id="image${String(i)}" class='zoomedOut' src="${filenames[i]}" onclick="toggleZoom(${String(i)})">`
    } else if (fileType === 'video') {
      html += `<video class='zoomedOut' controls loop>
      <source src="${filenames[i]}">
      This file is not playing.
    </video>`
    }
  }

  html += `
    </body>
      <script>

        function toggleZoom(val) {
          document.getElementById("image" + val).classList.toggle('zoomedIn');
          document.getElementById("image" + val).classList.toggle('zoomedOut');
        }
      </script>
    </html>
  `

  const imageWindow = window.open('', '_blank')
  imageWindow.document.write(html)
}

function showUpdateInfoModal (id, kind, details) {
  // Populate the model with details about the update and show it.

  if (kind !== 'control_server' && kind !== 'apps') {
    console.log('Error showing update info modal. Unexpected update kind: ', kind)
    return
  }

  $('#updateInfoModalTitleID').html(id)
  $('#updateInfoModalCurrentVersion').html(details.current_version)
  $('#updateInfoModalLatestVersion').html(details.available_version)
  $('#updateInfoModalDownloadButton').attr('href', 'https://github.com/Cosmic-Chatter/Constellation/releases/tag/' + details.available_version)

  // Get the changelog
  makeRequest({
    method: 'GET',
    url: 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/control_server/changelog.md',
    endpoint: '',
    rawResponse: true
  })
    .then((response) => {
      const markdownConverter = new showdown.Converter({ headerLevelStart: 4.0 })
      markdownConverter.setFlavor('github')

      const formattedText = markdownConverter.makeHtml(response)
      $('#updateInfoModalChangelogContainer').html(formattedText)
    })

  if (kind === 'control_server') {
    $('#updateInfoModalAppsInstructions').hide()
    $('#updateInfoModalControlServerInstructions').show()
  } else {
    $('#updateInfoModalAppsInstructions').show()
    $('#updateInfoModalControlServerInstructions').hide()
  }

  $('#updateInfoModal').modal('show')
}

export function rebuildNotificationList () {
  // Function to use the constConfig.errorDict   to build a set of buttons indicating
  // that there is a notification from a component.

  // Clear the existing buttons
  $('#notificationDisplayRow').empty()

  // Iterate through the items in the constConfig.errorDict. Each item should correspond
  // to one component with an notification.
  Object.keys(constConfig.errorDict).forEach((item, i) => {
    // Then, iterate through the notifications on that given item
    Object.keys(constConfig.errorDict[item]).forEach((itemError, j) => {
      let notification
      if (itemError === 'software_update') {
        if (item === '__control_server') {
          const labelName = 'Control Server: Software update available'
          notification = createNotificationHTML(labelName, 'update')
          notification.addEventListener('click', notification.addEventListener('click', () => { showUpdateInfoModal('Control Server', 'control_server', constConfig.errorDict[item].software_update) }))
        } else {
          const labelName = item + ': Software update available'
          notification = createNotificationHTML(labelName, 'update')
          notification.addEventListener('click', notification.addEventListener('click', () => { showUpdateInfoModal(item, 'apps', constConfig.errorDict[item].software_update) }))
        }
      } else {
        const itemErrorMsg = (constConfig.errorDict[item])[itemError]
        if (itemErrorMsg.length > 0) {
          const labelName = item + ': ' + itemError + ': ' + itemErrorMsg
          // Create and add the button
          notification = createNotificationHTML(labelName, 'error')
        }
      }
      $('#notificationDisplayRow').append(notification)
    })
  })
}

function createNotificationHTML (name, kind) {
  // Create and return a DOM element representing a notification.

  let colorClass
  if (kind === 'error') {
    colorClass = 'btn-danger'
  } else if (kind === 'update') {
    colorClass = 'btn-info'
  }

  const col = document.createElement('div')
  col.classList = 'col-auto mt-3'

  const button = document.createElement('button')
  button.classList = 'btn btn-block ' + colorClass
  button.innerHTML = name
  col.appendChild(button)

  return col
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

export function arraysEqual (a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function sortComponentsByGroup () {
  // Return an object where the keys are group names and values are the list
  // of components matching that group

  const result = {}

  constConfig.exhibitComponents.forEach((component) => {
    if (component.group in result) {
      result[component.group].push(component)
    } else {
      result[component.group] = [component]
    }
  })

  return result
}

export function sortDefinitionsByApp (defDict, dropPreview = true) {
  // Take a dictionary of app definitions with their UUIDs as keys and return a
  // dictionary sorted by app name.
  // set dropPreview == false to include the __previewXXX definitions used by the
  // app config wizards.

  const result = {}

  Object.keys(defDict).forEach((uuid) => {
    const def = defDict[uuid]
    try {
      if ((def.uuid.slice(0, 9) === '__preview') && (dropPreview === true)) return
    } catch {
      // If we don't have a name, this definition is faulty.
      return
    }

    if (def.app in result) {
      result[def.app].push(def)
    } else {
      result[def.app] = [def]
    }
  })

  // Sort the arrays
  Object.keys(result).forEach((key) => {
    result[key] = result[key].sort((a, b) => {
      return a.name.toLowerCase() - b.name.toLowerCase()
    })
  })

  return result
}

export function checkPermission (action, neededLevel, group = null) {
  // Check that the user has permission for the requested action

  if (Object.keys(constConfig.user).length === 0) return false

  if (action !== 'components') {
    if (neededLevel === 'none') return true
    if (action in constConfig.user.permissions === false) return false

    const allowedLevel = constConfig.user.permissions[action]
    if (neededLevel === 'edit') {
      if (allowedLevel === 'edit') return true
      return false
    }
    if (neededLevel === 'view') {
      if (allowedLevel === 'edit' || allowedLevel === 'view') return true
      return false
    }
  } else {
    // Components
    if (neededLevel === 'edit') {
      if (constConfig.user.permissions.components.edit.includes('__all')) return true
      if ((group != null) && constConfig.user.permissions.components.edit.includes(group)) return true
      return false
    }
    if (neededLevel === 'view') {
      if (constConfig.user.permissions.components.edit.includes('__all')) return true
      if (constConfig.user.permissions.components.view.includes('__all')) return true
      if ((group != null) && (constConfig.user.permissions.components.edit.includes(group) || (constConfig.user.permissions.components.view.includes(group)))) return true
      return false
    }
  }
  return false
}

export function getUserDisplayName (uuid) {
  // Return the display name for a user or the uuid if the name cannot be resolved.

  return new Promise(function (resolve, reject) {
  // First, check the cache
    if (constConfig.usersDisplayNameCache[uuid] !== undefined) {
      resolve(constConfig.usersDisplayNameCache[uuid])
    }
    makeServerRequest({
      method: 'GET',
      endpoint: `/user/${uuid}/getDisplayName`
    })
      .then((response) => {
        if (response.success === true) {
          constConfig.usersDisplayNameCache[uuid] = response.display_name
          resolve(response.display_name)
        } else {
          resolve(uuid)
        }
      })
  })
}

export function uuid () {
  // Generate a new UUID v4 without using the crypto library (we may not be in HTTPS).
  // Format: 8-4-4-4-12

  const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z']
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  result += '-'
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * 36)]
  }
  return result
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
  const detectBad = detectBadCSV(result)

  if (detectBad.error === true) {
    return {
      json: result,
      error: true,
      error_index: detectBad.error_index
    }
  }

  return { json: result, error: false }
}

function detectBadCSV (jsonArray) {
  // Take the JSON array from csvToJSON and check if it seems properly formed.

  const lengthCounts = {}
  const lengthList = []
  jsonArray.forEach((el) => {
    // Count the number of fields (which should be the same for each row)
    const length = Object.keys(el).length
    if (length in lengthCounts) {
      lengthCounts[length] += 1
    } else {
      lengthCounts[length] = 1
    }
    lengthList.push(length)
  })

  // Assume that the length that occurs most often is the correct one
  const mostCommon = parseInt(Object.keys(lengthCounts).reduce((a, b) => lengthCounts[a] > lengthCounts[b] ? a : b))
  const badIndices = []
  lengthList.forEach((el, i) => {
    if (el !== mostCommon) badIndices.push(i)
  })
  if (badIndices.length > 0) {
    return { error: true, error_index: badIndices[0] }
  }
  return { error: false }
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
