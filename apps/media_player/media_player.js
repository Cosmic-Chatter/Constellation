import * as constCommon from '../js/constellation_app_common.js'

function updateParser (update) {
  // Read updates specific to the media browser

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    constCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (def) {
  // Take an object parsed from an INI string and use it to load a new set of contet
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

  const requestDict = {
    id: constCommon.config.id,
    type: constCommon.config.type,
    synchronizeWith: otherIDs.split(',')
  }

  constCommon.makeServerRequest(
    {
      method: 'POST',
      endpoint: '/system/beginSynchronization',
      params: requestDict
    })
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
  document.getElementById('audioPlayer').muted = false
}

function updateClipList (list) {
  // Function that takes a list of filenames and passes it to the helper
  // to hold for potentially sharing with a player_kiosk instance.

  const requestDict = {
    action: 'updateClipList',
    clipList: list
  }

  constCommon.makeHelperRequest(
    {
      method: 'POST',
      endpoint: '/updateClipList',
      params: requestDict
    })
}

function updateActiveClip (index) {
  // Function that takes a list of filenames and passes it to the helper
  // to hold for potentially sharing with a player_kiosk instance.

  constCommon.makeHelperRequest(
    {
      method: 'POST',
      endpoint: '/updateActiveClip',
      params: { index }
    })
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
    console.log('gotoNextSource: image duration:', imageDuration)
    console.log('Sources:', constCommon.config.sourceList)
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
  const audio = document.getElementById('audioPlayer')

  if (playOnly === false) { // We are going to load the media before we play it
    // Split off the extension
    const split = source.split('.')
    const ext = split[split.length - 1]

    if (['mp4', 'mpeg', 'm4v', 'webm', 'mov', 'ogv', 'mpg'].includes(ext.toLowerCase())) {
      // Video file
      clearTimeout(sourceAdvanceTimer) // Only used for pictures
      audio.pause()
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
      // Image file
      video.pause()
      audio.pause()
      videoContainer.style.opacity = 0
      image.src = source
      imageContainer.style.opacity = 1
      clearTimeout(sourceAdvanceTimer)
      sourceAdvanceTimer = setTimeout(gotoNextSource, imageDuration)
    } else if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'weba', 'wav'].includes(ext.toLowerCase())) {
      // Audio file
      video.pause()
      videoContainer.style.opacity = 0
      imageContainer.style.opacity = 0

      if (audio.src !== source) {
        audio.pause()
        audio.src = source
        audio.load()
        audio.play()
      }
      if (constCommon.config.sourceList.length > 1) { // Don't loop or onended will never fire
        audio.loop = false
        audio.onended = function () {
          if (constCommon.config.autoplayEnabled === true) {
            gotoNextSource()
          } else {
            audio.play()
          }
        }
      } else {
        audio.loop = true
      }
    }
  } else {
    video.play()
    videoContainer.style.opacity = 1
    imageContainer.style.opacity = 0
    clearTimeout(sourceAdvanceTimer)
  }
}
constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.constellationAppID = 'media_player'
let currentDefintion = ''

constCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
constCommon.config.sourceList = []
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
constCommon.config.waitingForSynchronization = false
constCommon.config.autoplayEnabled = true
const imageDuration = 30000 // milliseconds; the amount of time an image will be displayed before going to the next one
constCommon.config.allowAudio = false

constCommon.config.debug = true
document.addEventListener('click', unmute)

constCommon.config.helperAddress = window.location.origin

const searchParams = constCommon.parseQueryString()
if (searchParams.has('standalone')) {
  // We are displaying this inside of a setup iframe
  if (searchParams.has('definition')) {
    constCommon.loadDefinition(searchParams.get('definition'))
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
} else {
  // We are displaying this for real
  constCommon.askForDefaults()
    .then(() => {
      constCommon.sendPing()

      setInterval(constCommon.sendPing, 5000)
    })
}

// Hide the cursor
document.body.style.cursor = 'none'
