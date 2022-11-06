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
        resolve(JSON.parse(xhr.responseText))
      } else {
        reject(new Error(`Unable to complete ${opt.method} to ${opt.url + opt.endpoint} with data`, opt.params))
      }
    }
    xhr.onerror = function () {
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

export function rebuildErrorList () {
  // Function to use the constConfig.errorDict to build a set of buttons indicating
  // that there is a problem with a component.

  // Clear the existing buttons
  $('#errorDisplayRow').empty()
  let html

  if (constConfig.serverSoftwareUpdateAvailable) {
    html = `
        <div class="col-auto mt-3">
          <button class='btn btn-info btn-block'>Server software update available</btn>
        </div>
      `
    $('#errorDisplayRow').append(html)
  }

  // Iterate through the items in the constConfig.errorDict. Each item should correspond
  // to one component with an error.
  Object.keys(constConfig.errorDict).forEach((item, i) => {
    // Then, iterate through the errors on that given item
    Object.keys(constConfig.errorDict[item]).forEach((itemError, j) => {
      const itemErrorMsg = (constConfig.errorDict[item])[itemError]
      if (itemErrorMsg.length > 0) {
        // By default, errors are bad
        let labelName = item + ': ' + itemError + ': ' + itemErrorMsg
        let labelClass = 'btn-danger'

        // But, if we are indicating an available update, make that less bad
        if (itemError === 'helperSoftwareUpdateAvailable') {
          labelName = item + ': System Helper software update available'
          labelClass = 'btn-info'
        } else if (itemError === 'softwareUpdateAvailable') {
          labelName = item + ': Software update available'
          labelClass = 'btn-info'
        }
        // Create and add the button
        html = `
            <div class="col-auto mt-3">
              <button class='btn ${labelClass} btn-block'>${labelName}</btn>
            </div>
          `
        $('#errorDisplayRow').append(html)
      }
    })
  })
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
