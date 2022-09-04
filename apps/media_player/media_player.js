/* global helperAddress */

import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Read updates for media player-specific actions and act on them

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]

      if (cmd.startsWith('beginSynchronization')) {
        const timeToPlay = cmd.split('_')[1]
        synchronize(timeToPlay)
      } else if (cmd === 'sendClipList') {
        updateClipList(constCommon.config.sourceList)
      } else if (cmd.startsWith('gotoClip')) {
        const clipNumber = cmd.split('_')[1]
        gotoSource(clipNumber)
      } else if (cmd.startsWith('seekVideo')) {
        const seek = cmd.split('_')
        seekVideoByFraction(seek[1], parseFloat(seek[2]))
      } else if (cmd === 'playVideo') {
        document.getElementById('fullscreenVideo').play()
      } else if (cmd === 'pauseVideo') {
        document.getElementById('fullscreenVideo').pause()
      } else if (cmd === 'disableAutoplay') {
        constCommon.config.autoplayEnabled = false
      } else if (cmd === 'enableAutoplay') {
        constCommon.config.autoplayEnabled = true
      } else if (cmd === 'toggleAutoplay') {
        constCommon.config.autoplayEnabled = !constCommon.config.autoplayEnabled
      }
    }
  }
  if ('synchronize_with' in update) {
    askToSynchronize(update.synchronize_with)
    constCommon.config.waitingForSynchronization = true
  }
  if ('autoplay_audio' in update) {
    // If desired, unmute the video
    // Note that the file will need to be whitelisted by the browser; otherwise,
    // it will not autoplay

    if (update.autoplay_audio.toLowerCase() === 'true') {
      document.getElementById('fullscreenVideo').muted = false
    } else {
      document.getElementById('fullscreenVideo').muted = true
    }
  }
  if ('image_duration' in update) {
    if (isFinite(parseInt(update.image_duration))) {
      // Image duration is specified in seconds in defaults.ini
      // but needs to be converted to milliseconds
      imageDuration = update.image_duration * 1000
      console.log(`Setting image duration: ${update.image_duration * 1000} seconds`)
    }
  }

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    if (constCommon.arraysEqual(constCommon.config.sourceList, update.content) === false) {
      constCommon.sendConfigUpdate(update)
      updateClipList(update.content)
      constCommon.config.sourceList = update.content
      gotoSource(0)
    }
  }
}

function synchronize (timeToPlay) {
  // Function to set a timeout to begin playing the synchronized video

  console.log('Playing video at:', timeToPlay)
  setTimeout(function () { console.log('Actual time:', Date.now()); changeMedia('', false, true) }, parseInt(timeToPlay) - Date.now())
}

function askToSynchronize (otherIDs) {
  // Function to communicate with the control server and indicate that we
  // are ready to begin synchronization.

  console.log('Asking to synchronize with', otherIDs)

  const requestString = JSON.stringify({
    class: 'exhibitComponent',
    id: constCommon.config.id,
    type: constCommon.config.type,
    action: 'beginSynchronization',
    synchronizeWith: otherIDs.split(',')
  })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 1000
  xhr.open('POST', constCommon.config.serverAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(requestString)
}

function seekVideoByFraction (direction, fraction) {
  // Seek to a point in the video given by the options.

  const video = document.getElementById('fullscreenVideo')

  let timeToGoTo
  if (direction === 'back') {
    timeToGoTo = video.currentTime - fraction * video.duration
  } else if (direction === 'forward') {
    timeToGoTo = video.currentTime + fraction * video.duration
  }
  // Handle boundaries
  if (timeToGoTo < 0) {
    timeToGoTo += video.duration
  } else if (timeToGoTo > video.duration) {
    timeToGoTo -= video.duration
  }
  video.currentTime = timeToGoTo
}

function unmute () {
  document.getElementById('fullscreenVideo').muted = false
}

function updateClipList (list) {
  // Function that takes a list of filenames and passes it to the helper
  // to hold for potentially sharing with a player_kiosk instance.

  const requestString = JSON.stringify({
    action: 'updateClipList',
    clipList: list
  })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(requestString)
}

function updateActiveClip (index) {
  // Function that takes a list of filenames and passes it to the helper
  // to hold for potentially sharing with a player_kiosk instance.

  const requestString = JSON.stringify({
    // action: 'updateActiveClip',
    index
  })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', helperAddress + '/updateActiveClip', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(requestString)
}

function gotoSource (index) {
  // Load the media file from the sourceList with the given index

  // Make sure the index is an integer
  index = parseInt(index)

  if (constCommon.config.debug) {
    console.log('gotoSource', index)
  }

  if (index < constCommon.config.sourceList.length) {
    constCommon.config.activeIndex = index
    updateActiveClip(constCommon.config.activeIndex)
    changeMedia(constCommon.config.contentPath + '/' + constCommon.config.sourceList[index], constCommon.config.waitingForSynchronization, false)
  }
}

function gotoNextSource () {
  // Display the next file in sourceList, looping to the beginning if
  // necessary

  if (constCommon.config.debug) {
    console.log('gotoNextSource')
  }

  if (constCommon.config.activeIndex + 1 >= constCommon.config.sourceList.length) {
    constCommon.config.activeIndex = 0
  } else {
    constCommon.config.activeIndex += 1
  }

  gotoSource(constCommon.config.activeIndex)
}

function changeMedia (source, delayPlay, playOnly) {
  // Load and play a media file given in source
  // delayPlay and playOnly are used when synchronizing multiple displays

  if (constCommon.config.debug) {
    console.log('changeMedia', source, delayPlay, playOnly)
  }

  const video = document.getElementById('fullscreenVideo')
  const videoContainer = document.getElementById('videoOverlay')
  const image = document.getElementById('fullscreenImage')
  const imageContainer = document.getElementById('imageOverlay')

  if (playOnly === false) { // We are going to load the media before we play it
    // Split off the extension
    const split = source.split('.')
    const ext = split[split.length - 1]

    if (['mp4', 'mpeg', 'm4v', 'webm', 'mov', 'ogg', 'mpg'].includes(ext.toLowerCase())) {
      clearTimeout(sourceAdvanceTimer) // Only used for pictures
      if (video.src !== source) {
        video.pause()
        video.src = source
        video.load()
      }
      if (constCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
        video.loop = false
        video.onended = function () {
          if (constCommon.config.autoplayEnabled === true) {
            gotoNextSource()
          } else {
            video.play()
          }
        }
      } else {
        video.loop = true
      }
      if (delayPlay === false) {
        console.log('here')
        video.play()
        videoContainer.style.opacity = 1
        imageContainer.style.opacity = 0
      }
    } else if (['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'heic', 'webp'].includes(ext.toLowerCase())) {
      video.pause()
      videoContainer.style.opacity = 0
      image.src = source
      imageContainer.style.opacity = 1
      clearTimeout(sourceAdvanceTimer)
      sourceAdvanceTimer = setTimeout(gotoNextSource, imageDuration)
    }
  } else {
    video.play()
    videoContainer.style.opacity = 1
    imageContainer.style.opacity = 0
  }
}

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.softwareVersion = 2.0
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/FWMSH/Constellation/main/media_player/version.txt'
constCommon.config.constellationAppID = 'media_player'

constCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
constCommon.config.sourceList = []
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
constCommon.config.waitingForSynchronization = false
constCommon.config.autoplayEnabled = true
let imageDuration = 30000 // milliseconds; the amount of time an image will be displayed before going to the next one
constCommon.config.allowAudio = false

constCommon.config.debug = true
document.addEventListener('click', unmute)

constCommon.config.helperAddress = helperAddress

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()
setInterval(constCommon.sendPing, 5000)
setInterval(constCommon.checkForHelperUpdates, 1000)

// Hide the cursor
document.body.style.cursor = 'none'
