import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Function to parse timelapse-specific updates

  if ('content' in update) {
    if (!constCommon.arraysEqual(update.content, currentContent)) {
      currentContent = update.content

      // Get the file from the helper and build the interface
      const definition = currentContent[0] // Only one INI file at a time

      const xhr = new XMLHttpRequest()
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          loadContentFromINI(constCommon.parseINIString(xhr.responseText))
        }
      }
      xhr.open('GET', constCommon.config.helperAddress + '/content/' + definition, true)
      xhr.send(null)
    }
  }
}

function loadContentFromINI (definition) {
  // Receive a definition in the form of an object and set up the viewer appropriately.

  if (!('SETTINGS' in definition)) {
    console.log('Error: The INI file must include a [SETTINGS] section!')
    return
  }
  if ('files' in definition.SETTINGS) {
    updateSourceList(definition.SETTINGS.files)
  }
  if ('animation_length' in definition.SETTINGS) {
    console.log(definition.SETTINGS.animation_length)
    animationCustomDuration = parseFloat(definition.SETTINGS.animation_length)
  } else {
    animationCustomDuration = null
  }
  if ('attractor_timeout' in definition.SETTINGS) {
    attractorTimeout = parseFloat(definition.SETTINGS.attractor_timeout * 1000)
  }
}

function updateSourceList (matchString) {
  // Given a string containing a wildcard expression (*), retreive all the available content
  // and set the source to only the matching files.

  const requestString = JSON.stringify({ action: 'getAvailableContent' })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', constCommon.config.helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const content = JSON.parse(this.responseText)
      sourceList = content.all_exhibits.filter(
        item => new RegExp('^' + matchString.replace(/\*/g, '.*') + '$').test(item)
      ).sort(function (a, b) {
        return a.localeCompare(b)
      })
      sourceListLength = sourceList.length
      if (sourceListLength == 0) {
        continueAnimating = false
        return
      }
      activeSourceIndex = 0
      displayImage(sourceList[0])
      if (continueAnimating) {
        animateTimelapse()
      }
    }
  }
  xhr.send(requestString)
}

function handleTouchStart (event, touch = true) {
  hideAttractor()
  constCommon.config.currentInteraction = true

  if (touch) {
    touchStartX = event.touches[0].clientX
  } else {
    // Mouse input
    touchStartX = event.clientX
    currentClick = true
  }
}

function handleTouchEnd (event) {
  lastTouchX = null
  currentClick = false
}

function handleTouchMove (event, touch = true) {
  constCommon.config.currentInteraction = true
  if (touch === true && event.touches.length > 1) {
    event.preventDefault()
    return
  }

  let pos
  let dx
  let dist
  if (touch) {
    pos = event.touches[0].clientX
  } else {
    // Mouse input
    if (currentClick) {
      pos = event.clientX
    } else {
      return
    }
  }

  if (lastTouchX != null) {
    dx = pos - lastTouchX
    dist = Math.abs(pos - touchStartX)

    if (dist > window.innerWidth / 25) {
      // Advance the image and reset the starting point.
      touchStartX = pos

      const touchVelocity = Math.abs(1000 * dx / window.innerWidth)

      let sourceIncrement
      if (touchVelocity < 10) {
        // Slow touch
        if (sourceListLength < 100) {
          sourceIncrement = 1
        } else if (sourceListLength < 1000) {
          sourceIncrement = 2
        } else if (sourceListLength < 3000) {
          sourceIncrement = 3
        } else {
          sourceIncrement = 4
        }
      } else if (touchVelocity < 30) {
        if (sourceListLength < 600) {
          sourceIncrement = 3
        } else {
          sourceIncrement = Math.round(sourceListLength / 300)
        }
      } else {
        if (sourceListLength < 1000) {
          sourceIncrement = 10
        } else {
          sourceIncrement = Math.round(sourceListLength / 100)
        }
      }
      if (stopInput === false) {
        if (dx > 0) {
          changeSource(sourceIncrement)
        } else {
          changeSource(-1 * sourceIncrement)
        }
      }
    }
  }
  lastTouchX = pos
}

function handleScroll (event) {
  // Cycle the images when a user scrolls the mouse scroll wheel.

  hideAttractor()
  constCommon.config.currentInteraction = true

  const dy = event.originalEvent.deltaY
  const velocity = Math.abs(dy)
  let sourceIncrement
  if (velocity < 500) {
    // Slow scroll
    if (sourceListLength < 100) {
      sourceIncrement = 1
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3
    } else {
      sourceIncrement = 4
    }
  } else {
    if (sourceListLength < 1000) {
      sourceIncrement = 10
    } else {
      sourceIncrement = Math.round(sourceListLength / 100)
    }
  }
  if (stopInput === false) {
    if (dy < 0) {
      changeSource(sourceIncrement)
    } else {
      changeSource(-1 * sourceIncrement)
    }
  }
}

function handleKeyDown (event) {
  // Listen for arrow keys and switch images accordingly

  hideAttractor()
  constCommon.config.currentInteraction = true

  const key = event.key
  const repeated = event.repeat
  let sourceIncrement

  if (repeated === false) {
    // Single press
    if (sourceListLength < 100) {
      sourceIncrement = 1
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3
    } else {
      sourceIncrement = 4
    }
  } else {
    if (sourceListLength < 1600) {
      sourceIncrement = 8
    } else {
      sourceIncrement = Math.round(sourceListLength / 200)
    }
  }
  if (stopInput === false) {
    if (['ArrowRight', 'ArrowUp'].includes(key)) {
      changeSource(sourceIncrement)
    } else if (['ArrowLeft', 'ArrowDown'].includes(key)) {
      changeSource(-1 * sourceIncrement)
    }
  }
}

function loadImage (url) {
  // Use a promise to load the given image

  stopInput = true

  return new Promise(resolve => {
    const image = new Image()

    image.addEventListener('load', () => {
      resolve(image)
    })
    image.src = url
  })
}

function displayImage (file) {
  // Handle switching the src on the appropriate image tag to `file`.

  if (activeViewerIndex === 0) {
    activeViewerIndex = 1
    loadImage('content/' + file).then(newImage => {
      viewerList[1].src = newImage.src
      viewerList[1].style.display = 'block'
      viewerList[0].style.display = 'none'
      stopInput = false
    })
  } else {
    activeViewerIndex = 0
    loadImage('content/' + file).then(newImage => {
      viewerList[0].src = newImage.src
      viewerList[0].style.display = 'block'
      viewerList[1].style.display = 'none'
      stopInput = false
    })
  }
}

function changeSource (dist) {
  // Advance through the sourceList by the number `dist` and

  activeSourceIndex += dist
  if (activeSourceIndex > sourceListLength - 1) {
    activeSourceIndex = sourceListLength - 1
  } else if (activeSourceIndex < 0) {
    activeSourceIndex = 0
  }
  displayImage(sourceList[activeSourceIndex])
}

function animateNextFrame () {
  // Show the next frame in the timelapse and set a timeout to recursively call
  // this function.

  if (continueAnimating) {
    changeSource(animationStepSize)
    if (activeSourceIndex === sourceListLength - 1) {
      activeSourceIndex = -1
    }
    animationTimer = setTimeout(animateNextFrame, 1000 / animationFramerate)
  }
}

function animateTimelapse () {
  // Start the process of animating the timelapse

  if (animationCustomDuration != null) {
    // The user has set a custom animation length in the defintion
    animationFramerate = sourceListLength / animationCustomDuration
    console.log(animationFramerate, sourceListLength, animationCustomDuration)
    if (animationFramerate > 30) {
      animationStepSize = Math.round(animationFramerate / 30)
      animationFramerate = animationFramerate / animationStepSize
    }
  } else {
    // Compute a sensible animation speed based on the number of files
    animationStepSize = 1
    if (sourceListLength < 50) {
      animationFramerate = 5
    } else if (sourceListLength < 200) {
      animationFramerate = 10
    } else if (sourceListLength < 500) {
      animationFramerate = 20
    } else if (sourceListLength < 2000) {
      animationFramerate = 30
    } else {
      animationFramerate = 30
      animationStepSize = 2
    }
  }

  continueAnimating = true
  clearTimeout(animationTimer)
  animateNextFrame()
}

function showAttractor () {
  // Start animating the timelapse and show a moving hand icon to guide users

  animateTimelapse()
  document.getElementById('handContainer').style.display = 'block'

  // Report analytics, if necessary
  if (enableAnalytics) {
    constCommon.sendAnalytics({ action: 'showAttractor' })
  }
}

function hideAttractor () {
  // Stop any animation
  continueAnimating = false

  // Hide the moving hand icon
  document.getElementById('handContainer').style.display = 'none'

  // Report analytics, if necessary
  if (enableAnalytics && !constCommon.config.currentInteraction) {
    constCommon.sendAnalytics({ action: 'hideAttractor' })
  }

  // Set the attractor to start again in 30 s
  clearTimeout(attractorTimer)
  attractorTimer = setTimeout(showAttractor, attractorTimeout)
}

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.softwareVersion = 2.0
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/timelapse_viewer/version.txt'
constCommon.config.constellationAppID = 'timelapse_viewer'

let touchStartX = null
let lastTouchX = null // X cordinate of the last touchmove event
let currentClick = false
let stopInput = false

let continueAnimating = true // true when we are animating for the attractor
let animationFramerate = 30
let animationStepSize = 1
let animationTimer = null // Will be replaced with index of setTimeout
let animationCustomDuration = null

let attractorTimer = null // Will be replaced with index of setTimeout
let attractorTimeout = 30000 // ms

let currentContent = []
let sourceList = []
let sourceListLength = 0
let activeSourceIndex = 0 // Index of the file from the source list currently showing
const viewerList = [document.getElementById('img1'), document.getElementById('img2')]
let activeViewerIndex = 0 // Index of the <img> instance that is currently being used
const enableAnalytics = false

constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()
setInterval(constCommon.sendPing, 5000)

document.body.style.cursor = 'none' // Hide the cursor

// Create event listeners
$('body')
  .on('touchstart', handleTouchStart)
  .on('touchmove', handleTouchMove)
  .on('touchend', handleTouchEnd)
  .on('wheel', handleScroll)
  .on('keydown', handleKeyDown)
  .on('mousedown', function (event) { handleTouchStart(event, false) })
  .on('mousemove', function (event) { handleTouchMove(event, false) })
  .on('mouseup', handleTouchEnd)
