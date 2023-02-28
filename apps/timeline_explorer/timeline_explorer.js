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

  // Tag the document with the defintion for later reference
  $(document).data('timelineDefinition', def)

  // Modify the style
  if ('style' in def) {
    if ('color' in def.style) {
      Object.keys(def.style.color).forEach((key) => {
        document.documentElement.style.setProperty('--' + key, def.style.color[key])
      })
    }
    if ('font' in def.style) {
      Object.keys(def.style.font).forEach((key) => {
        const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
        document.fonts.add(font)
      })
    }
  }

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  createLanguageSwitcher(def)
  const defaultLang = langs[0]

  // Load the CSV file containing the timeline data and use it to build the timeline entries.
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true
  })
    .then((response) => {
      $('#timelineContainer').empty()
      const csvAsJSON = constCommon.csvToJSON(response)
      $(document).data('spreadsheet', csvAsJSON)
      localize(defaultLang)
    })
}

function adjustFontSize (increment) {
  // Adjust the font multiplier by the given amount

  const root = document.querySelector(':root')
  let fontModifierStr = root.style.getPropertyValue('--fontModifier')
  if (fontModifierStr === '') {
    fontModifierStr = '1'
  }
  let fontModifier = parseFloat(fontModifierStr)

  fontModifier += increment
  if (fontModifier < 1) {
    fontModifier = 1
  }
  root.style.setProperty('--fontModifier', fontModifier)
}

function createLanguageSwitcher (def) {
  // Take a definition file and use the language entries to make an appropriate language switcher.

  const langs = Object.keys(def.languages)

  if (langs.length === 1) {
    // No switcher necessary
    $('langSwitchDropdown').hide()
    return
  }

  // Cycle the languagse and build an entry for each
  $('#langSwitchOptions').empty()
  langs.forEach((code) => {
    const name = def.languages[code].display_name

    const li = document.createElement('li')

    const button = document.createElement('button')
    button.classList = 'dropdown-item'
    button.addEventListener('click', function () {
      localize(code)
    })
    li.appendChild(button)

    const flag = document.createElement('img')
    const customImg = def.languages[code].custom_flag
    if (customImg != null) {
      flag.src = '../content/' + customImg
    } else {
      flag.src = '../_static/flags/' + code + '.svg'
    }
    flag.style.width = '30%'
    flag.addEventListener('error', function () {
      this.src = '../_static/icons/translation-icon_black.svg'
    })
    button.appendChild(flag)

    const span = document.createElement('span')
    span.classList = 'ps-2'
    span.style.verticalAlign = 'middle'
    span.innerHTML = name
    button.appendChild(span)

    $('#langSwitchOptions').append(li)
  })
}

function localize (lang) {
  // Use the spreadhseet and defintion to set the content to the given language

  const spreadhseet = $(document).data('spreadsheet')
  const definition = $(document).data('timelineDefinition')

  $('#timelineContainer').empty()
  spreadhseet.forEach((entry) => {
    createTimelineEntry(entry, lang)
  })
  $('#headerText').html(definition.languages[lang].header_text || '')
}

function createTimelineEntry (entry, langCode) {
  // Take the provided object and turn it into a set of HTML elements representing the entry.

  const langDef = $(document).data('timelineDefinition').languages[langCode]

  // Initialize the Markdown converter
  const converter = new showdown.Converter({ parseImgDimensions: true })

  const li = document.createElement('li')

  const container = document.createElement('div')
  container.classList = 'timeline-element'
  li.appendChild(container)

  // Text
  const flex1 = document.createElement('div')
  flex1.style.flexBasis = '0'
  flex1.style.flexGrow = '1'
  container.appendChild(flex1)

  const timeEl = document.createElement('time')
  timeEl.innerHTML = converter.makeHtml(entry[langDef.time_key])
  flex1.appendChild(timeEl)

  const title = document.createElement('div')
  if (parseInt(entry.Level) < 1) {
    title.classList = 'size1'
  } else if (parseInt(entry.Level) > 4) {
    title.classList = 'size4'
  } else {
    title.classList = 'size' + parseInt(entry[langDef.level_key])
  }
  title.classList.add('timeline-item-header')
  title.innerHTML = converter.makeHtml(entry[langDef.title_key])
  flex1.appendChild(title)

  const bodyEl = document.createElement('p')
  bodyEl.classList = 'timeline-body'
  bodyEl.innerHTML = converter.makeHtml(entry[langDef.short_text_key])
  flex1.appendChild(bodyEl)

  // Image
  const imageName = entry[langDef.image_key]
  if (imageName.trim() !== '' && imageName != null) {
    // Make the timeline element wider to accomdate the image
    container.classList.add('with-image')

    const flex2 = document.createElement('div')
    flex2.style.flexBasis = '0'
    flex2.style.flexGrow = '1'
    flex2.style.alignSelf = 'center'
    container.appendChild(flex2)

    const image = document.createElement('img')
    image.style.width = '100%'
    image.src = 'content/' + imageName
    flex2.appendChild(image)
  }

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
$('#fontSizeDecreaseButton').click(function () {
  adjustFontSize(-0.1)
})
$('#fontSizeIncreaseButton').click(function () {
  adjustFontSize(0.1)
})

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
adjustFontSize(-100) // Make sure the font modifier is at 1 to start
// Hide the cursor
// document.body.style.cursor = 'none'
