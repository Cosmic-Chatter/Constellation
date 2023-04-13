import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Function to parse timelapse-specific updates

  if ('definition' in update && update.definition !== currentDefintion) {
    currentDefintion = update.definition
    constCommon.loadDefinition(currentDefintion)
      .then((result) => {
        loadDefinition(result.definition)
      })
  }
}

function loadDefinition (definition) {
  // Receive a definition in the form of an object and set up the viewer appropriately.

  const root = document.querySelector(':root')

  if ('files' in definition) {
    updateSourceList(definition.files)
  }
  if ('animation_duration' in definition.behavior) {
    animationCustomDuration = parseFloat(definition.behavior.animation_duration)
  } else {
    animationCustomDuration = null
  }
  if ('attractor_timeout' in definition.attractor) {
    attractorTimeout = parseFloat(definition.attractor.attractor_timeout * 1000)
  }

  if ('attractor_background' in definition.attractor) {
    root.style.setProperty('--attractor-background', definition.attractor.attractor_background)
  } else {
    root.style.setProperty('--attractor-background', 'rgba(0, 0, 0, 0.2)')
  }
  if ('attractor_height' in definition.attractor) {
    root.style.setProperty('--attractor-height', parseFloat(definition.attractor.attractor_height))
  } else {
    root.style.setProperty('--attractor-height', 70)
  }
  if ('font_adjust' in definition.attractor) {
    root.style.setProperty('--attractor-font-adjust', parseFloat(definition.attractor.font_adjust))
  } else {
    root.style.setProperty('--attractor-font-adjust', 0)
  }
  if ('text' in definition.attractor) {
    document.getElementById('attractor').innerHTML = definition.attractor.text
  } else {
    document.getElementById('attractor').innerHTML = ''
  }
  if ('text_color' in definition.attractor) {
    root.style.setProperty('--attractor-text-color', definition.attractor.text_color)
  } else {
    root.style.setProperty('--attractor-text-color', 'white')
  }
}

function updateSourceList (matchString) {
  // Given a string containing a wildcard expression (*), retrieve all the available content
  // and set the source to only the matching files.

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((content) => {
      sourceList = content.all_exhibits.filter(
        item => new RegExp('^' + matchString.replace(/\*/g, '.*') + '$').test(item)
      ).sort(function (a, b) {
        return a.localeCompare(b)
      })
      sourceListLength = sourceList.length
      if (sourceListLength === 0) {
        continueAnimating = false
        return
      }
      activeSourceIndex = 0
      displayImage(sourceList[0])
      if (continueAnimating) {
        animateTimelapse()
      }
    })
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
    // activeSourceIndex = sourceListLength - 1
    activeSourceIndex -= sourceListLength
  } else if (activeSourceIndex < 0) {
    // activeSourceIndex = 0
    activeSourceIndex = sourceListLength - 1
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
constCommon.config.constellationAppID = 'timelapse_viewer'

let touchStartX = null
let lastTouchX = null // X cordinate of the last touchmove event
let currentClick = false
let stopInput = false

let currentDefintion = ''
let continueAnimating = true // true when we are animating for the attractor
let animationFramerate = 30
let animationStepSize = 1
let animationTimer = null // Will be replaced with index of setTimeout
let animationCustomDuration = null

let attractorTimer = null // Will be replaced with index of setTimeout
let attractorTimeout = 30000 // ms

const currentContent = []
let sourceList = []
let sourceListLength = 0
let activeSourceIndex = 0 // Index of the file from the source list currently showing
const viewerList = [document.getElementById('img1'), document.getElementById('img2')]
let activeViewerIndex = 0 // Index of the <img> instance that is currently being used
const enableAnalytics = false

constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin
let standalone = false

const searchParams = constCommon.parseQueryString()
if (searchParams.has('standalone')) {
  // We are displaying this inside of a setup iframe
  standalone = true
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
  // Hide the cursor
  document.body.style.cursor = 'none'
}

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
