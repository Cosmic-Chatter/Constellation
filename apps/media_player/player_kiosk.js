/* global helperAddress, showdown */

import * as exCommon from '../js/exhibitera_app_common.js'

function startSeekBack () {
  // Begin a timer that sends messages to the helper to ask the video player
  // to seek backwards

  seekDirection = 'back'
  stopSeek()
  seekTimer = setInterval(askToSeek, 50)
  askToSeek()
}

function startSeekForward () {
  // Begin a timer that sends messages to the helper to ask the video player
  // to seek backwards

  seekDirection = 'forward'
  stopSeek()
  seekTimer = setInterval(askToSeek, 50)
  askToSeek()
}

function stopSeek (resetAttractor = true) {
  if (resetAttractor) {
    resetAttractorTimer()
  }
  clearInterval(seekTimer)
  // var temp = function() {setPlayPause("play");}
  // setTimeout(temp, 2000);
  setPlayPause('play')
}

function askToSeek () {
  // Send a message to the helper, asking it to tell the video player to seek
  // the video.

  setPlayPause('pause')

  const requestDict = {
    action: 'seekVideo',
    direction: seekDirection,
    fraction: 0.01
  }

  const xhr = new XMLHttpRequest()
  xhr.open('POST', helperAddress, true)
  xhr.timeout = 50 // ms
  xhr.ontimeout = function () { console.log('timeout') }
  xhr.setRequestHeader('Content-Type', 'application/json')
  // xhr.onreadystatechange = function () {
  //   if (this.readyState !== 4) return

  //   if (this.status === 200) {
  //   }
  // }
  xhr.send(JSON.stringify(requestDict))
}

function setPlayPause (state) {
  // Ask the helper to tell the player to play or pause the video

  const requestDict = {}

  if (state === 'play') {
    requestDict.action = 'playVideo'
  } else if (state === 'pause') {
    requestDict.action = 'pauseVideo'
  }

  const xhr = new XMLHttpRequest()
  xhr.open('POST', helperAddress, true)
  xhr.timeout = 1000 // ms
  xhr.ontimeout = function () { console.log('timeout') }
  xhr.setRequestHeader('Content-Type', 'application/json')
  // xhr.onreadystatechange = function () {
  //   if (this.readyState !== 4) return

  //   if (this.status === 200) {
  //   }
  // }
  xhr.send(JSON.stringify(requestDict))
}

function getCurrentExhibit () {
  // Ask the helper to send the current exhibit name and update as necessary

  const requestDict = { action: 'getCurrentExhibit' }
  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        currentConfig.current_exhibit = this.responseText
        localize()
      }
    }
  }
  xhr.send(requestString)
}

function askForDefaults () {
  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  exCommon.askForDefaults()
  setTimeout(rebuildInterface(), 500)
}

function switchLang () {
  // Switch to the other language and start changing the content.

  if (currentLang === 'en') {
    currentLang = 'es'
  } else {
    currentLang = 'en'
  }
  setLang(currentLang)
}

function setLang (lang) {
  currentLang = lang
  if (currentLang === 'es') {
    $('#langSwitchButton').html('English')
  } else {
    $('#langSwitchButton').html('Español')
  }
  localize()
}

function updateTextSize () {
  // Read the current text size variables and update the appropriate elements

  $('p').css('font-size', currentLabelTextSize)
  $('H1').css('font-size', currentHeaderTextSize)
  $('H3').css('font-size', currentButtonTextSize)

  const attractorTextSize = Math.min(window.innerWidth / 10, 100)
  const attractorSubTextSize = Math.min(window.innerWidth / 20, 50)
  $('#attractorDatasetName').css('font-size', attractorTextSize)
  $('#TouchToExploreLabel').css('font-size', attractorSubTextSize)
}

function resetTextSize () {
  currentButtonTextSize = defaultButtonTextSize
  currentHeaderTextSize = defaultHeaderTextSize
  currentLabelTextSize = defaultLabelTextSize

  updateTextSize()
}

function increaseTextSize () {
  resetAttractorTimer()
  currentButtonTextSize += 2
  currentHeaderTextSize += 5
  currentLabelTextSize += 2
  updateTextSize()
}

function decreaseTextSize () {
  resetAttractorTimer()
  currentButtonTextSize -= 2
  currentHeaderTextSize -= 5
  currentLabelTextSize -= 2
  if (currentButtonTextSize < defaultButtonTextSize) {
    currentButtonTextSize = defaultButtonTextSize
  }
  if (currentLabelTextSize < defaultLabelTextSize) {
    currentLabelTextSize = defaultLabelTextSize
  }
  if (currentHeaderTextSize < defaultHeaderTextSize) {
    currentHeaderTextSize = defaultHeaderTextSize
  }
  updateTextSize()
}

function sleepDisplay () {
  // Overlay a black div to blank the screen.

  document.getElementById('displayBlackout').style.display = 'block'
}

function wakeDisplay () {
  // Hide the blanking div

  document.getElementById('displayBlackout').style.display = 'none'
}

function updateParser (update) {
  // Function to read a message from the server and take action based
  // on the contents

  // current_config = update;
  if ('kiosk_id' in update) {
    exCommon.config.id = update.kiosk_id
  }
  if ('kiosk_type' in update) {
    exCommon.config.type = update.kiosk_type
  }
  if ('dictionary' in update) {
    exCommon.config.dictionary = update.dictionary
  }
  if ('kiosk_anydesk_id' in update) {
    exCommon.config.AnyDeskID = update.kiosk_anydesk_id
  }

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = update.commands[i]

      if (cmd === 'refresh_page') {
        location.reload()
      } else if (cmd === 'sleepDisplay') {
        sleepDisplay()
      } else if (cmd === 'wakeDisplay' || cmd === 'power_on') {
        wakeDisplay()
      }
    }
  }
}

// function sendPing () {
//   // Contact the control server and ask for any updates

//   if (serverAddress !== '') {
//     const allowedActionsDict = {
//       refresh: 'true',
//       sleep: 'true'
//     }

//     const requestDict = {
//       class: 'exhibitComponent',
//       id,
//       type,
//       currentInteraction: String(exCommon.config.currentInteraction),
//       allowed_actions: allowedActionsDict,
//       constellation_app_id: 'media_player',
//       AnyDeskID
//     }

//     const requestString = JSON.stringify(requestDict)

//     const xhr = new XMLHttpRequest()
//     xhr.timeout = 1000
//     xhr.open('POST', serverAddress, true)
//     xhr.setRequestHeader('Content-Type', 'application/json')
//     xhr.onerror = function () {
//     }
//     xhr.onreadystatechange = function () {
//       if (this.readyState !== 4) return

//       if (this.status === 200) {
//         if (this.responseText !== '') {
//           readUpdate(this.responseText)
//         }
//       }
//     }
//     xhr.send(requestString)
//   }
// }

function highlightClip (number) {
  // Configure the interface to show the specified clip

  $('.card-footer').hide()
  $('.border.rounded.no-gutters').removeClass('bg-primary') // Selects all the cards
  $('#cardName' + number).addClass('bg-primary')
  getLabelText($('#cardName' + number).data('name'), currentLang)
  document.getElementById('labelTextArea').scrollTop = 0
}

function selectClip (number) {
  // Called when a user taps on one of the cards.

  if (blockTouches === false && activeClip !== number) {
    resetAttractorTimer()
    activeClip = number
    blockTouches = true
    setTimeout(function () { blockTouches = false }, 500)

    // Ask the helper to switch the clip
    gotoClip(number)
    highlightClip(number)
  }
}

function gotoClip (number) {
  // Function to ask the helper to ask the player to change the media to the
  // specified clip

  const requestString = JSON.stringify({
    action: 'gotoClip',
    clipNumber: number
  })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 500
  xhr.open('POST', helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
    console.log('timeout on gotoClip')
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      console.log('response received:', this.responseText)
    }
  }
  xhr.send(requestString)
}

function setAutoplay (state) {
  // state should be "off", "on", or "toggle"

  const requestDict = {
    action: 'setAutoplay',
    state
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', exCommon.config.helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(requestString)
}

function getLabelText (name, lang) {
  // Ask the helper to retreive a label file for the specified object in
  // the specified language and send the text.

  if (name == null || lang == null) {
    setLabelText('')
    console.log('getLabelText: error: missing value for', name, lang)
    return
  }

  const labelKey = currentConfig.current_exhibit + '_' + lang + '_' + name
  if (labelKey in labelCache) {
    $('#labelTextArea').html(labelCache[labelKey])
    updateTextSize()
  } else {
    const labelName = name.split('.').slice(0, -1).join('.') + '.txt'
    const requestDict = {
      action: 'getLabelText',
      lang,
      name: labelName
    }

    const requestString = JSON.stringify(requestDict)

    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('POST', helperAddress, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return

      if (this.status === 200) {
        if (this.responseText !== '') {
          const formattedText = markdownConverter.makeHtml(this.responseText)
          // Add it to the cache.
          labelCache[labelKey] = formattedText
          setLabelText(formattedText)
        } else {
          setLabelText('')
        }
      }
    }
    xhr.send(requestString)
  }
}

function setLabelText (formattedText) {
  // Take an HTML string and set put it in the label text div

  $('#labelTextArea').html(formattedText)
  updateTextSize()
}

function createCard (name, number) {
  // Create a card that holds one dataset

  // Try to look up a public-facing name for the dataset
  let displayName = name
  if (dictionary != null) {
    const dict = getDictionary(currentLang)
    const dictKey = name
    if (dictKey in dict) {
      displayName = dict[dictKey]
    }
  }
  const icon = name.split('.').slice(0, -1).join('.') + '.png'

  const html = `
  <div class='col-12 m-1' onclick="selectClip(${number})">
    <div id="cardName${number}" data-name="${name}" data-number="${number}" class="button-card row no-gutters p-2 border border-primary rounded align-items-center">
      <div class="col-3">
        <img class='card-img-top' src="thumbnails/${icon}" onerror="this.src='thumbnails/default.svg'"></img>
      </div>
      <div class="col-9 pl-2">
        <div class="card-body">
          <h3 id="cardTitle${number}" class="card-title">${displayName}</h3>
        </div>
        </div>
      </div>
    </div>
  </div>
  `
  $('#cardRow').append(html)
  if (number === activeClip) {
    highlightClip(number)
  }
  updateTextSize()
}

function localize () {
  // Update elements to reflect the current language

  if (dictionary != null) {
    const dict = getDictionary(currentConfig.current_exhibit)

    // Update kiosk title
    const dictKey = 'kiosk_title_' + currentLang
    if (dictKey in dict) {
      const title = dict[dictKey]
      $('.mastheadText').html(title)
      if (currentLang === 'en') {
        $('#attractorDatasetName').html(title)
      }
    }

    // Update button display names
    const cards = $('.button-card')
    cards.each(
      function () {
        const name = $(this).data('name')
        const number = $(this).data('number')
        console.log(name, number)
        $('#cardTitle' + number).html(dict[name])
      }
    )
  }
  highlightClip(activeClip)
}

function rebuildInterface () {
  // Repopulate the clip buttons in response to a change in playlist
  if (dictionary != null) {
    const dict = getDictionary(currentConfig.current_exhibit)
    const dictKey = 'kiosk_title_' + currentLang
    if (dictKey in dict) {
      const title = dict[dictKey]
      $('.mastheadText').html(title)
      if (currentLang === 'en') {
        $('#attractorDatasetName').html(title)
      }
    }
  }

  // Remove the existing cards
  $('#cardRow').empty()

  // Create new ones
  for (let i = 0; i < clipList.length; i++) {
    const clip = clipList[i]
    createCard(clip, i)
  }

  $('#card' + activeClip).addClass('bg-primary')
}

function getDictionary (value) {
  // Return the correct dictionary for the current language

  if (dictionary != null) {
    let dict = dictionary
    if ('meta' in dictionary) {
      // We have a dictionary with a section for each language
      if (value.toUpperCase() in dictionary) {
        dict = dictionary[value.toUpperCase()]
      }
    }
    return (dict)
  } else {
    console.log('Dictionary is not available!')
    return (null)
  }
}

function getClipList () {
  // Ask the helper for a list of the currently playing clips. If this is
  // different than what we have, rebuild the interface to reflect that.

  // Retreive the new clip list
  const requestDict = { action: 'getClipList' }
  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', exCommon.config.helperAddress, true)
  xhr.timeout = 1000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const update = JSON.parse(this.responseText)
      console.log(update)
      if ('clipList' in update) {
        const oldList = clipList
        clipList = update.clipList
        activeClip = parseInt(update.activeClip)
        if (exCommon.arraysEqual(oldList, clipList) === false) {
          rebuildInterface()
          getCurrentExhibit() // A changing clipList probably means a different exhibit
        }
      }
    }
  }
  xhr.send(requestString)
}

function showAttractor () {
  // Make the attractor layer visible and start autorun

  stopSeek(false)
  $('#attractorOverlay').show()
  setLang('en')
  setAutoplay('on')
  resetTextSize()
  exCommon.config.currentInteraction = false

  const analyticsData = {
    action: 'showAttractor',
    target: 'attractor',
    idle: 'true'
  }
  exCommon.sendAnalytics(analyticsData)
}

function hideAttractor () {
  // Make the attractor layer invisible and stop the autorun

  $('#attractorOverlay').hide()
  setAutoplay('off')
  resetAttractorTimer()
  exCommon.config.currentInteraction = true

  const analyticsData = {
    action: 'hideAttractor',
    target: 'attractor',
    idle: 'false'
  }
  exCommon.sendAnalytics(analyticsData)
}

function resetAttractorTimer () {
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, 30000)
}

$('#attractorOverlay').click(hideAttractor)
$('#langSwitchButton').click(switchLang)
$('#textSizeDownButton').click(decreaseTextSize)
$('#textSizeUpButton').click(increaseTextSize)

// These will be replaced by the values specified in defaults.ini
const dictionary = null
const currentConfig = {} // Will hold the defaults sent from the helper
const markdownConverter = new showdown.Converter()
let blockTouches = false
let clipList = []
let activeClip = 0
const labelCache = {} // This will hold labels that we have received from the helper

const defaultButtonTextSize = 40
const defaultHeaderTextSize = 55
const defaultLabelTextSize = 25
let currentButtonTextSize = defaultButtonTextSize
let currentHeaderTextSize = defaultHeaderTextSize
let currentLabelTextSize = defaultLabelTextSize
let currentLang = 'en'

let seekTimer = null // Will hold setInterval reference for seeking the video
// var playPauseTimer = null; // Will hold setTimeout reference for resuming video play after seeking
let seekDirection = 'back'

exCommon.config.helperAddress = helperAddress
exCommon.config.updateParser = updateParser // To read kiosk-specific updates
askForDefaults()
setInterval(exCommon.sendPing, 5000)
setInterval(getClipList, 5000) // Poll the helper for changes to the playing clips
updateTextSize()
let inactivityTimer = setTimeout(showAttractor, 30000)

const seekBackButton = document.getElementById('videoSeekBackButton')
const seekForwardButton = document.getElementById('videoSeekForwardButton')
seekBackButton.addEventListener('touchstart', startSeekBack)
seekBackButton.addEventListener('touchend', stopSeek)
seekBackButton.addEventListener('mousedown', startSeekBack)
seekBackButton.addEventListener('mouseup', stopSeek)
seekForwardButton.addEventListener('touchstart', startSeekForward)
seekForwardButton.addEventListener('touchend', stopSeek)
seekForwardButton.addEventListener('mousedown', startSeekForward)
seekForwardButton.addEventListener('mouseup', stopSeek)
