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
  console.log(def)
  def.content_order.forEach((uuid) => {
    constCommon.config.sourceList.push(def.content[uuid])
  })
  gotoSource(0)
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
    changeMedia(constCommon.config.sourceList[index])
  }
}

function gotoNextSource () {
  // Display the next file in sourceList, looping to the beginning if
  // necessary

  if (constCommon.config.activeIndex + 1 >= constCommon.config.sourceList.length) {
    constCommon.config.activeIndex = 0
  } else {
    constCommon.config.activeIndex += 1
  }

  gotoSource(constCommon.config.activeIndex)
}

function changeMedia (source) {
  // Load and play a media file given in source
  // delayPlay and playOnly are used when synchronizing multiple displays

  if (constCommon.config.debug) {
    console.log('changeMedia', source)
  }

  const video = document.getElementById('fullscreenVideo')
  const videoContainer = document.getElementById('videoOverlay')
  const image = document.getElementById('fullscreenImage')
  const imageContainer = document.getElementById('imageOverlay')
  const audio = document.getElementById('audioPlayer')
  const filename = constCommon.config.contentPath + '/' + source.filename

  // Split off the extension
  const split = source.filename.split('.')
  const ext = split[split.length - 1]

  if (['mp4', 'mpeg', 'm4v', 'webm', 'mov', 'ogv', 'mpg'].includes(ext.toLowerCase())) {
    // Video file
    clearTimeout(sourceAdvanceTimer) // Only used for pictures
    audio.pause()
    if (video.src !== filename) {
      video.pause()
      video.src = filename
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
  } else if (['png', 'jpg', 'jpeg', 'tiff', 'tif', 'bmp', 'heic', 'webp'].includes(ext.toLowerCase())) {
    // Image file
    video.pause()
    audio.pause()
    videoContainer.style.opacity = 0
    image.src = filename
    imageContainer.style.opacity = 1
    clearTimeout(sourceAdvanceTimer)
    sourceAdvanceTimer = setTimeout(gotoNextSource, source.duration * 1000)
  } else if (['aac', 'm4a', 'mp3', 'oga', 'ogg', 'weba', 'wav'].includes(ext.toLowerCase())) {
    // Audio file
    video.pause()
    videoContainer.style.opacity = 0
    imageContainer.style.opacity = 0

    if (audio.src !== filename) {
      audio.pause()
      audio.src = filename
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
}
constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.constellationAppID = 'media_player'
let currentDefintion = ''

constCommon.config.activeIndex = 0 // Index of the file from the source list currently showing
constCommon.config.sourceList = []
let sourceAdvanceTimer = null // Will hold reference to a setTimeout instance to move to the next media.
constCommon.config.waitingForSynchronization = false
constCommon.config.autoplayEnabled = true
constCommon.config.allowAudio = false

constCommon.config.debug = true
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
