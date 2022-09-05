import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Function to parse timelapse-specific updates

  if ('current_exhibit' in update) {
    if (currentExhibit !== update.current_exhibit) {
      currentExhibit = update.current_exhibit
      updateSourceList(true)
    }
  }
}

// function readUpdate (responseText) {
//   // Function to read a message from the server and take action based
//   // on the contents

//   const update = JSON.parse(responseText)
//   sendConfigUpdate(update) // Send to helper to update the default config

//   if ('commands' in update) {
//     for (let i = 0; i < update.commands.length; i++) {
//       const cmd = (update.commands)[i]

//       if (cmd === 'restart') {
//         askForRestart()
//       } else if (cmd === 'shutdown' || cmd === 'power_off') {
//         askForShutdown()
//       } else if (cmd === 'sleepDisplay') {
//         sleepDisplay()
//       } else if (cmd === 'wakeDisplay' || cmd === 'power_on') {
//         wakeDisplay()
//       } else if (cmd === 'refresh_page') {
//         if ('refresh' in allowedActionsDict && allowedActionsDict.refresh === 'true') {
//           location.reload()
//         }
//       } else if (cmd === 'reloadDefaults') {
//         askForDefaults()
//       } else if (cmd.startsWith('gotoClip')) {
//         const clipNumber = cmd.split('_')[1]
//         gotoSource(clipNumber)
//       } else {
//         console.log(`Command not recognized: ${cmd}`)
//       }
//     }
//   }
//   if ('id' in update) {
//     id = update.id
//   }
//   if ('type' in update) {
//     type = update.type
//   }
//   if ('operating_system' in update) {
//     operatingSystem = update.operating_system
//   }
//   if (('server_ip_address' in update) && ('server_port' in update)) {
//     serverAddress = 'http://' + update.server_ip_address + ':' + update.server_port
//   }
//   if ('helperAddress' in update) {
//     constCommon.config.helperAddress = update.helperAddress
//   }
//   if ('enable_analytics' in update) {
//     enableAnalytics = stringToBool(update.enable_analytics)
//   }
//   if ('contentPath' in update) {
//     contentPath = update.contentPath
//   }

//   if ('missingContentWarnings' in update) {
//     errorDict.missingContentWarnings = update.missingContentWarnings
//   }
//   if ('allow_sleep' in update) {
//     allowedActionsDict.sleep = update.allow_sleep
//   }
//   if ('allow_restart' in update) {
//     allowedActionsDict.restart = update.allow_restart
//   }
//   if ('allow_shutdown' in update) {
//     allowedActionsDict.shutdown = update.allow_shutdown
//   }
//   if ('helperSoftwareUpdateAvailable' in update) {
//     if (update.helperSoftwareUpdateAvailable === 'true') { errorDict.helperSoftwareUpdateAvailable = 'true' }
//   }
//   if ('anydesk_id' in update) {
//     AnyDeskID = update.anydesk_id
//   }
// }

function updateSourceList (first = false) {
  // Function to ask the helper for any new updates, like switching between
  // media clips

  const requestString = JSON.stringify({ action: 'getAvailableContent' })

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', constCommon.config.helperAddress, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const content = JSON.parse(this.responseText)
      sourceList = content.all_exhibits.filter(file => file.startsWith(currentExhibit))
        .sort(function (a, b) {
          return a.localeCompare(b)
        })
      sourceListLength = sourceList.length
      if (first) {
        activeSourceIndex = 0
        displayImage(sourceList[0])
        if (continueAnimating) {
          animateTimelapse()
        }
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

  const dx = event.originalEvent.deltaY
  const velocity = Math.abs(dx)
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
    if (dx < 0) {
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
  attractorTimer = setTimeout(showAttractor, 30000)
}

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.softwareVersion = 2.0
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/timelapse_viewer/version.txt'
constCommon.config.constellationAppID = 'timelapse_viewer'

let touchStartX = null
let lastTouchX = null // X cordinate of the last touchmove event
let currentClick = false
let stopInput = false

let continueAnimating = false // true when we are animating for the attractor
let animationFramerate = 30
let animationStepSize = 1
let animationTimer = null // Will be replaced with index of setTimeout

let attractorTimer = null // Will be replaced with index of setTimeout

let sourceList = []
let sourceListLength = 0
let activeSourceIndex = 0 // Index of the file from the source list currently showing
const viewerList = [document.getElementById('img1'), document.getElementById('img2')]
let activeViewerIndex = 0 // Index of the <img> instance that is currently being used
let currentExhibit = '' // This will double as the root of the source path
const enableAnalytics = false

constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()
setInterval(constCommon.sendPing, 5000)
updateSourceList(true)
setInterval(updateSourceList, 10000)

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
