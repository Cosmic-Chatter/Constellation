import * as constCommon from '../js/constellation_app_common.js'

function buildLayout (definition) {
  // Take a layout defition in the form of a dictionary of dictionaries and
  // create cards for each element

  // Clear the exisiting layout
  $('#cardRow').empty()

  const buttons = Object.keys(definition)
  let buttonClasses
  if (buttons.length - 1 < 6) {
    buttonClasses = 'col button-col mx-0 px-1'
  } else {
    buttonClasses = 'col-3 button-col mx-0 px-1'
  }

  // Iterate through the buttons and build their HTML
  let numText = 0 // Number of buttons that include text
  buttons.forEach((item) => {
    if (item === 'SETTINGS') {
      return
    }
    voteCounts[item] = 0
    const buttonDef = definition[item]

    const div = document.createElement('div')
    div.classList = buttonClasses
    div.addEventListener('click', function () { buttonTouched(div, item) })
    document.getElementById('cardRow').appendChild(div)

    const card = document.createElement('div')
    card.classList = 'card card-inactive mb-0'
    div.appendChild(card)

    if ('icon' in buttonDef) {
      const img = document.createElement('img')
      img.src = getIcon(buttonDef.icon)
      img.classList = 'card-img-top card-img-full'
      card.appendChild(img)
    }

    const text = document.createElement('div')
    text.classList = 'card-body card-body-full d-flex align-items-center justify-content-center'
    card.appendChild(text)

    const title = document.createElement('div')
    title.classList = 'card-title my-0 noselect'
    if ('title' in buttonDef) {
      numText += 1
      title.innerHTML = buttonDef.title
    }
    text.append(title)
  })

  if (numText === 0) {
    $('.card-body').remove()
  }

  // Make sure all the buttons are the same height
  const heights = $('.card-body').map(function () {
    return $(this).height()
  }).get()
  const maxHeight = Math.max.apply(null, heights)
  $('.card-body').each(function () {
    $(this).height(maxHeight)
  })
}

function getIcon (name) {
  // If the given name is a shortcut, return the full filepath.
  // Otherwise, assume the file is user-supplied and return the name as passed.

  if (['1-star_black', '2-star_black', '3-star_black', '4-star_black', '5-star_black', '1-star_white', '2-star_white', '3-star_white', '4-star_white', '5-star_white'].includes(name)) {
    return 'voting_kiosk/icons/' + name + '.png'
  } else if (['thumbs-down_black', 'thumbs-down_red', 'thumbs-down_white', 'thumbs-up_black', 'thumbs-up_green', 'thumbs-up_white'].includes(name)) {
    return 'voting_kiosk/icons/' + name + '.svg'
  } else {
    return name
  }
}

function buttonTouched (button, name) {
  // Respond to the touch of a button by changing color and logging the vote

  setActive()

  $(button).find('.card').removeClass('card-inactive').addClass('card-active')
  setTimeout(function () {
    $(button).find('.card').removeClass('card-active').addClass('card-inactive')
  }, 500)
  showSuccessMessage()
  logVote(name, 1)
}

function logVote (name, numVotes) {
  // Record one or more votes for the given option

  if (blockTouches === false) {
    voteCounts[name] += numVotes
  }
  clearTimeout(touchBlocker)
  blockTouches = true
  touchBlocker = setTimeout(function () { blockTouches = false }, touchCooldown * 1000)
}

function setActive () {
  constCommon.config.currentInteraction = true
  const reset = function () {
    constCommon.config.currentInteraction = false
  }
  setTimeout(reset, 10000)
}

function checkConnection () {
  // Send a message to the server checking that the connection is stable.

  constCommon.makeServerRequest(
    {
      method: 'GET',
      endpoint: '/system/checkConnection'
    })
    .then(() => {
      $('#connectionWarning').hide()
      badConnection = false
    })
    .catch(() => {
      if (constCommon.config.debug) {
        $('#connectionWarning').show()
      }
      badConnection = true
    })
}

function updateFunc (update) {
  // Read updates for voting kiosk-specific actions and act on them

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    if (!constCommon.arraysEqual(update.content, currentContent)) {
      currentContent = update.content

      // Get the file from the helper and build the interface
      const definition = currentContent[0] // Only one INI file at a time

      constCommon.makeHelperRequest(
        {
          method: 'GET',
          endpoint: '/content/' + definition,
          rawResponse: true
        })
        .then((response) => {
          updateContent(definition, constCommon.parseINIString(response))
        })
    }
  }
}

function updateContent (name, definition) {
  // Clean up the old survey, then create the new one.

  // If there are votes left for the old survey, make sure they are recorded
  sendData()

  // Update the configuration name
  if (name.toLowerCase().endsWith('.ini')) {
    configurationName = name.slice(0, -4)
  } else {
    configurationName = name
  }

  // Clear the vote categories
  voteCounts = {}

  if (!('SETTINGS' in definition)) {
    console.log('Error: The INI file must include a [SETTINGS] section!')
    return
  }

  // Parse the settings and make the appropriate changes
  if ('header' in definition.SETTINGS) {
    document.getElementById('header').innerHTML = definition.SETTINGS.header
    document.getElementById('headerCol').style.display = 'block'
  } else {
    document.getElementById('header').innerHTML = ''
    document.getElementById('headerCol').style.display = 'none'
  }
  if ('subheader' in definition.SETTINGS) {
    document.getElementById('subheader').innerHTML = definition.SETTINGS.subheader
    document.getElementById('subheaderCol').style.display = 'block'
  } else {
    document.getElementById('subheader').innerHTML = ''
    document.getElementById('subheaderCol').style.display = 'none'
  }
  if ('footer' in definition.SETTINGS) {
    document.getElementById('footer').innerHTML = definition.SETTINGS.footer
    document.getElementById('footerCol').style.display = 'block'
  } else {
    document.getElementById('footer').innerHTML = ''
    document.getElementById('footerCol').style.display = 'none'
  }
  if ('subfooter' in definition.SETTINGS) {
    document.getElementById('subfooter').innerHTML = definition.SETTINGS.subfooter
    document.getElementById('subfooterCol').style.display = 'block'
  } else {
    document.getElementById('subfooter').innerHTML = ''
    document.getElementById('subfooterCol').style.display = 'none'
  }
  if ('success' in definition.SETTINGS) {
    document.getElementById('successMessageBody').innerHTML = definition.SETTINGS.success
  }
  if ('top_height' in definition.SETTINGS) {
    document.getElementById('topRow').style.height = definition.SETTINGS.top_height + 'vh'
  } else {
    document.getElementById('topRow').style.height = null
  }
  if ('button_height' in definition.SETTINGS) {
    document.getElementById('cardRow').style.height = definition.SETTINGS.button_height + 'vh'
  } else {
    document.getElementById('cardRow').style.height = null
  }
  if ('bottom_height' in definition.SETTINGS) {
    document.getElementById('bottomRow').style.height = definition.SETTINGS.bottom_height + 'vh'
  } else {
    document.getElementById('bottomRow').style.height = null
  }
  if ('recording_interval' in definition.SETTINGS) {
    clearInterval(voteCounter)
    recordingInterval = parseFloat(definition.SETTINGS.recording_interval)
    voteCounter = setInterval(sendData, recordingInterval * 1000)
  } else {
    clearInterval(voteCounter)
    recordingInterval = 60
    voteCounter = setInterval(sendData, recordingInterval * 1000)
  }
  if ('touch_cooldown' in definition.SETTINGS) {
    touchCooldown = parseFloat(definition.SETTINGS.touch_cooldown)
  } else {
    touchCooldown = 2
  }

  buildLayout(definition)
}

function sendData () {
  // Collect the current value from each card, build a dictionary, and
  // send it to the control server for storage.

  if (constCommon.config.debug) {
    console.log('Sending data...')
  }
  if (badConnection) {
    if (constCommon.config.debug) {
      console.log('Error: bad connection. Will not attempt to send data.')
    }
    return
  }
  const resultDict = {}

  // Append the date and time of this recording
  const tzoffset = (new Date()).getTimezoneOffset() * 60000 // Time zone offset in milliseconds
  const dateStr = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1)
  resultDict.Date = dateStr

  let totalVotes = 0
  Object.keys(voteCounts).forEach((entry) => {
    resultDict[entry] = voteCounts[entry]
    totalVotes += voteCounts[entry]

    // Reset votes
    voteCounts[entry] = 0
  })

  // If there are no votes to record, bail out.
  if (totalVotes === 0) {
    return
  }

  const requestDict = {
    data: resultDict,
    name: configurationName
  }

  constCommon.makeServerRequest(
    {
      method: 'POST',
      endpoint: '/tracker/flexible-tracker/submitData',
      params: requestDict
    })
}

function showSuccessMessage () {
  // Animate the success message to briefly appear

  $('#successMessage').css({ display: 'flex' })
    .animate({ opacity: 1 }, 100)
    .delay(100)
    .animate({ opacity: 0 }, { duration: 1000, complete: function () { $('#successMessage').css({ display: 'none' }) } })
}

// Disable pinch-to-zoom for browsers the ignore the viewport setting
document.addEventListener('touchmove', e => {
  console.log('here')
  if (e.touches.length > 1) {
    e.preventDefault()
  }
}, { passive: false })

document.addEventListener('wheel', function (e) {
  if (e.ctrlKey) {
    e.preventDefault()
  }
}, { passive: false })

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.constellationAppID = 'voting_kiosk'
constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

let badConnection = true

let configurationName = 'default'
let currentContent = []
let voteCounts = {}
let recordingInterval = 60 // Send votes every this many minutes
let voteCounter = setInterval(sendData, recordingInterval * 1000)
let blockTouches = false
let touchBlocker = null // Will hold id for the setTimeout() that resets blockTouches
let touchCooldown = 2 // seconds before blockTouches is reset

constCommon.askForDefaults()
constCommon.sendPing()

setInterval(constCommon.sendPing, 5000)
setInterval(constCommon.checkForHelperUpdates, 1000)

setInterval(checkConnection, 500)

// Hide the cursor
document.body.style.cursor = 'none'
