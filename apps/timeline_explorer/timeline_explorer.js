/* global showdown */

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
      currentContent = update.content[0]
      loadDefinition(currentContent)
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

  // Load the CSV file containing the timeline data and use it to build the timeline entries.
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/Apollo_timeline.csv',
    rawResponse: true
  })
    .then((response) => {
      // $('#timelineContainer').empty()
      constCommon.csvToJSON(response).forEach((entry) => {
        createTimelineEntry(entry)
      })
    })
}

function createTimelineEntry (entry) {
  // Take the provided object and turn it into a set of HTML elements representing the entry.

  // Initialize the Markdown converter
  const converter = new showdown.Converter({ parseImgDimensions: true })

  const li = document.createElement('li')

  const container = document.createElement('div')
  container.classList = 'timeline-element'
  li.appendChild(container)

  const timeEl = document.createElement('time')
  timeEl.innerHTML = converter.makeHtml(entry.Time)
  container.appendChild(timeEl)

  const title = document.createElement('div')
  if (parseInt(entry.Level) < 1) {
    title.classList = 'size1'
  } else if (parseInt(entry.Level) > 4) {
    title.classList = 'size4'
  } else {
    title.classList = 'size' + parseInt(entry.Level)
  }
  title.innerHTML = converter.makeHtml(entry.Title)
  container.appendChild(title)

  const bodyDiv = document.createElement('div')
  bodyDiv.innerHTML = converter.makeHtml(entry.Body)
  container.appendChild(bodyDiv)

  $('#timelineContainer').append(li)
  configureVisibleElements()
}

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

function configureVisibleElements () {
  // Iterate the timeline elements and make them visible if they are in view (trigger the animation).

  const items = document.querySelectorAll('.timeline li')

  for (let i = 0; i < items.length; i++) {
    if (isElementInViewport(items[i])) {
      items[i].classList.add('in-view')
    } else {
      items[i].classList.remove('in-view')
    }
  }
}

// Add event listeners
window.addEventListener('load', configureVisibleElements)
window.addEventListener('resize', configureVisibleElements)
document.getElementById('timeline-pane').addEventListener('scroll', configureVisibleElements)

// Constellation stuff
let currentContent = ''
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
