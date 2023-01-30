import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Read updates for media player-specific actions and act on them

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]
    }
  }
  // This should be last to make sure the path has been updated
  if ('content' in update) {
    if (update.content[0] !== currentContent) {

    }
  }
}

function loadDefinition (defName) {
  // Use the given definition to set up the interface.
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + defName + '/load'
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        _loadDefinition(response.definition)
      }
    })
}

function _loadDefinition (def) {
  // Helper function to manage setting up the interface.

  $('#headerText').html(def.title || '')
}

// define variables
const items = document.querySelectorAll('.timeline li')

// check if an element is in viewport
// http://stackoverflow.com/questions/123999/how-to-tell-if-a-dom-element-is-visible-in-the-current-viewport
function isElementInViewport (el) {
  const rect = el.getBoundingClientRect()
  return (
    rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <=
        (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

function callbackFunc () {
  for (let i = 0; i < items.length; i++) {
    if (isElementInViewport(items[i])) {
      items[i].classList.add('in-view')
    } else {
      items[i].classList.remove('in-view')
    }
  }
}

// Add event listeners
window.addEventListener('load', callbackFunc)
window.addEventListener('resize', callbackFunc)
document.getElementById('timeline-pane').addEventListener('scroll', callbackFunc)

// Constellation stuff
const currentContent = ''
constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.constellationAppID = 'timeline_explorer'
constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

const searchParams = constCommon.parseQueryString()
if (searchParams.has('preview')) {
  // We are displaying this inside of a setup iframe
  if (searchParams.has('definition')) {
    loadDefinition(searchParams.get('definition'))
  }
} else {
  // We are displaying this for real
  constCommon.askForDefaults()
  constCommon.sendPing()

  setInterval(constCommon.sendPing, 5000)
}

// Hide the cursor
// document.body.style.cursor = 'none'
