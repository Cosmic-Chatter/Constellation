/* global showdown */

import * as constCommon from '../js/constellation_app_common.js'

function updateContent (definition) {
  // Parse the current content file and build the interface correspondingly.

  if (!('SETTINGS' in definition)) {
    console.log('Error: The INI file must include a [SETTINGS]section!')
    return
  }

  // Clear the existing content
  fontSizeReset()
  $('#nav-tabContent').empty()
  $('#buttonRow').empty()
  textTabs = []
  imageTabs = []
  videoTabs = []

  // Set up the available languages
  const langDef = { default: '' }
  const headerDict = {}
  if ('languages' in definition.SETTINGS) {
    const langs = definition.SETTINGS.languages.split(',')
    langs.forEach((val, i) => {
      const lang = val.trim()
      langDef[lang] = definition.SETTINGS['language_' + lang]
      headerDict[lang] = definition.SETTINGS['title_' + lang]
      if (i === 0) {
        langDef.default = val
      }
    })
  }
  setLanguages(langDef)
  setMasthead(headerDict)

  // Configure the attractor
  if ('attractor' in definition.SETTINGS) {
    const fileType = getFileType(definition.SETTINGS.attractor)
    if (['image', 'video'].includes(fileType)) {
      setAttractor(definition.SETTINGS.attractor, fileType)
    }
  }
  if ('timeout' in definition.SETTINGS) {
    timeoutDuration = parseFloat(definition.SETTINGS.timeout) * 1000
  }

  // Extract tab order
  const tabsToCreate = definition.SETTINGS.order.split(',')
  tabsToCreate.forEach((val, i, theArray) => {
    theArray[i] = val.trim()
  })

  // Create the tabs
  tabsToCreate.forEach((val, i) => {
    if (!(val in definition)) {
      console.log('Error, no deinintion found for', val)
      return
    }
    let tabId
    const tabType = definition[val].type
    if (tabType === 'text') {
      tabId = createTextTab(definition[val])
    } else if (tabType === 'image') {
      tabId = createImageTab(definition[val])
    } else if (tabType === 'video') {
      tabId = createVideoTab(definition[val])
    }
    if (i === 0) {
      firstTab = tabId
    }
  })
  gotoTab(firstTab)
}

function getFileType (filename) {
  // Return one of ['image', 'video', 'other'] for a given filename based on its extension

  const ext = filename.split('.').slice(-1)[0].toLowerCase()

  if (['mp4', 'mov', 'm4v', 'avi', 'webm', 'mpeg', 'mpg'].includes(ext)) {
    return 'video'
  }
  if (['jpeg', 'jpg', 'png', 'bmp', 'tiff', 'tif', 'webp'].includes(ext)) {
    return 'image'
  }
  return 'other'
}

function parseINIString (data) {
  // Take an INI file and return an object with the settings
  // From https://stackoverflow.com/questions/3870019/javascript-parser-for-a-string-which-contains-ini-data

  const regex = {
    section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
    param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
    comment: /^\s*;.*$/
  }
  const value = {}
  const lines = data.split(/[\r\n]+/)
  let section = null
  lines.forEach(function (line) {
    if (regex.comment.test(line)) {
      return
    } else if (regex.param.test(line)) {
      const match = line.match(regex.param)
      if (section) {
        value[section][match[1]] = match[2]
      } else {
        value[match[1]] = match[2]
      }
    } else if (regex.section.test(line)) {
      const match = line.match(regex.section)
      value[match[1]] = {}
      section = match[1]
    } else if (line.length === 0 && section) {
      section = null
    };
  })
  return value
}

function createButton (title, id) {
  // Create a button in the bottom bar that shows the pane with the given id

  const existingButton = $('#' + id + 'ButtonCol')
  let col
  if (existingButton.length === 0) {
    // Create a new button
    col = document.createElement('div')
    col.setAttribute('class', 'col-2 tabButtonCol')
    col.setAttribute('id', id + 'ButtonCol')
    $('#buttonRow').append(col)

    // Adjust the column size based on the number of buttons that have been added
    const nButtons = $('#buttonRow').children().length
    const allButtons = $('.tabButtonCol')
    if (nButtons === 1) {
      allButtons.removeClass('col-1 col-2 col-3 col-4 col-6').addClass('col-12')
    } else if (nButtons === 2) {
      allButtons.removeClass('col-1 col-2 col-3 col-4 col-12').addClass('col-6')
    } else if (nButtons === 3) {
      allButtons.removeClass('col-1 col-2 col-3 col-6 col-12').addClass('col-4')
    } else if (nButtons === 4) {
      allButtons.removeClass('col-1 col-2 col-4 col-6 col-12').addClass('col-3')
    } else if (nButtons > 4) {
      allButtons.removeClass('col-1 col-6 col-3 col-4 col-12').addClass('col-2')
    }
  } else {
    // Update button
    existingButton.empty()
    col = existingButton
    col.empty()
  }

  const button = document.createElement('button')
  button.setAttribute('class', 'btn btn-secondary tabButton w-100 h-100')
  $(button).click(function () {
    gotoTab(id)
  })
  button.setAttribute('id', id + 'Button')
  $(button).html(title)
  col.append(button)
}

function createCard (content) {
  // Create a single thumbnail card with the details provided in 'content'

  const card = document.createElement('div')
  card.setAttribute('class', 'card')
  $(card).data('details', content)

  const img = document.createElement('img')
  img.setAttribute('class', 'card-img-top')
  img.src = content.thumb
  $(card).append(img)

  const body = document.createElement('div')
  body.setAttribute('class', 'card-body')
  card.append(body)

  const title = document.createElement('div')
  title.setAttribute('class', 'card-title text-center')
  $(title).html(content.title)
  body.append(title)

  return card
}

function createImageTab (definition, update = '') {
  // Create a pane that displays a grid of images.
  // Set update="" when instantiating the video tab for the first time.
  // When localizing, set update to the id to be updated

  let tabId
  if (update === '') {
    // First, create the pane
    tabId = 'imageTab_' + String(Date.now())
    const pane = document.createElement('div')
    pane.setAttribute('id', tabId)
    pane.setAttribute('class', 'tab-pane fade show active')
    $(pane).data('user-definition', definition)
    $('#nav-tabContent').append(pane)
  } else {
    tabId = update
  }

  // Send a GET request for the content and then build the tab
  const xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      _createImageTabContent(tabId, xhr.responseText)
    }
  }
  xhr.open('GET', constCommon.config.helperAddress + '/' + definition['content_' + currentLang], true)
  xhr.send(null)

  // Create button for this tab
  createButton(definition['title_' + currentLang], tabId)

  if (update === '') {
    imageTabs.push(tabId)
  }
  return tabId
}

function _createImageTabContent (tabId, contentStr) {
  // Helper function to actually populate the tab with content.

  const row = document.createElement('div')
  row.setAttribute('class', 'row mx-1 align-items-center')
  $('#' + tabId).append(row)
  const overlayId = tabId + '_overlay'

  const content = parseINIString(contentStr)
  const images = Object.keys(content)

  // Then, iterate through the content and build a card for each image
  images.forEach((item, i) => {
    const imageDef = content[item]

    const col = document.createElement('div')
    col.setAttribute('class', 'col-4 mt-3')
    row.append(col)

    const card = createCard(imageDef)
    $(card).click(function () {
      imageOverlayShow(tabId, this)
    })
    col.append(card)
  })

  // Then, create the overlay that will show the media
  const overlay = document.createElement('div')
  overlay.setAttribute('class', 'row overlay mx-0 align-items-center')
  overlay.setAttribute('id', overlayId)
  $(overlay).click(function () {
    imageOverlayHide(tabId)
  })
  $('#' + tabId).append(overlay)
  $(overlay).hide()

  const bigImgCol = document.createElement('div')
  bigImgCol.setAttribute('class', 'offset-1 col-10 text-center')
  overlay.append(bigImgCol)

  const bigImg = document.createElement('img')
  bigImg.setAttribute('class', 'bigImage')
  bigImg.setAttribute('id', tabId + '_image')
  bigImg.src = content[images[0]].image
  bigImgCol.append(bigImg)

  const title = document.createElement('p')
  title.setAttribute('class', 'overlayTitle text-center')
  title.setAttribute('id', tabId + '_title')
  $(title).html(content[images[0]].title)
  bigImgCol.append(title)

  const caption = document.createElement('p')
  caption.setAttribute('class', 'overlayCaption text-start')
  caption.setAttribute('id', tabId + '_caption')
  $(caption).html(content[images[0]].caption)
  bigImgCol.append(caption)

  const credit = document.createElement('p')
  credit.setAttribute('class', 'overlayCredit fst-italic text-start')
  credit.setAttribute('id', tabId + '_credit')
  $(credit).html(content[images[0]].credit)
  bigImgCol.append(credit)
}

function localizeImageTab (id) {
  // Use the user-supplied data to supply the content in the current langauge;

  const definition = $('#' + id).data('user-definition')

  // Clear the pane and rebuild
  document.getElementById(id).innerHTML = ''
  createImageTab(definition, id)
}

function createTextTab (definition, update = '') {
  // Create a pane that displays Markdown-formatted text and images
  // Set update="" when instantiating the text tab for the first time.
  // When localizing, set update to the id to be updated

  let tabId, col
  if (update === '') {
    // First, create the pane
    tabId = 'textTab_' + String(Date.now())
    const pane = document.createElement('div')
    pane.setAttribute('id', tabId)
    pane.setAttribute('class', 'tab-pane fade show active')
    $(pane).data('user-definition', definition)
    $('#nav-tabContent').append(pane)

    const row = document.createElement('div')
    row.setAttribute('class', 'row mx-1 align-items-center')
    $('#' + tabId).append(row)

    col = document.createElement('div')
    col.setAttribute('class', 'col-12 textCol mt-3')
    col.setAttribute('id', tabId + 'Content')
    row.append(col)
  } else {
    col = document.getElementById(update + 'Content')
    tabId = update
  }

  // Send a GET request for the content and then build the tab
  const xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      _createTextTabContent(tabId, xhr.responseText)
    }
  }
  xhr.open('GET', constCommon.config.helperAddress + '/' + definition['content_' + currentLang], true)
  xhr.send(null)

  // Create button for this tab
  createButton(definition['title_' + currentLang], tabId)

  if (update === '') {
    textTabs.push(tabId)
  }
  return tabId
}

function _createTextTabContent (tabId, content) {
  // Helper function that actually creates and formats the tab content.

  const col = document.getElementById(tabId + 'Content')

  const converter = new showdown.Converter({ parseImgDimensions: true })
  const html = converter.makeHtml(content)
  // Parse the HTML
  const el = $('<div></div>')
  el.html(html)

  // Find img tags and format them appropriately
  el.children().each(function (i, tag) {
    if (tag.tagName === 'P') {
      $(tag).children().each(function (j, child) {
        if (child.tagName === 'IMG') {
          child.classList += 'image'
          const parent = $(child).parent()
          const div = document.createElement('div')
          div.append(child)
          div.append(child.title)
          parent.empty()
          parent.append(div)

          // Parse the alt text for a user-indicated formatting preference.
          const format = child.alt.toLowerCase()
          if (format === 'left') {
            div.classList = 'float-left'
          } else if (format === 'right') {
            div.classList = 'float-right'
          } else if (format === 'full') {
            div.classList = 'full'
          } else {
            div.classList = 'full'
          }
        }
      })
    }
  })

  // Group the elements by H1 elements. We will enclose each set in a box
  const boxes = []
  let curBox = []
  el.children().each(function (i, tag) {
    if (tag.tagName === 'H1') {
      if (curBox.length > 0) {
        boxes.push(curBox)
      }
      curBox = []
      curBox.push(tag)
    } else {
      curBox.push(tag)
    }
  })
  if (curBox.length > 0) {
    boxes.push(curBox)
  }
  boxes.forEach(function (divList) {
    const box = document.createElement('div')
    box.setAttribute('class', 'box')
    divList.forEach(function (div) {
      box.append(div)
    })
    col.append(box)
  })
  tabsUpdated += 1
}

function localizeTextTab (id) {
  // Use the user-supplied data to supply the content in the current langauge;

  const definition = $('#' + id).data('user-definition')

  // Clear the pane and rebuild
  document.getElementById(id + 'Content').innerHTML = ''
  createTextTab(definition, id)
}

function createVideoTab (definition, update = '') {
  // Create a pane that displays a grid of video.
  // Set update="" when instantiating the video tab for the first time.
  // When localizing, set update to the id to be updated

  let tabId
  if (update === '') {
    // First, create the pane
    tabId = 'videoTab_' + String(Date.now())
    const pane = document.createElement('div')
    pane.setAttribute('id', tabId)
    pane.setAttribute('class', 'tab-pane fade show active')
    $(pane).data('user-definition', definition)
    $('#nav-tabContent').append(pane)
  } else {
    tabId = update
  }

  // Send a GET request for the content and then build the tab
  const xhr = new XMLHttpRequest()
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      _createVideoTabContent(tabId, xhr.responseText)
    }
  }
  xhr.open('GET', constCommon.config.helperAddress + '/' + definition['content_' + currentLang], true)
  xhr.send(null)

  // Create button for this tab
  createButton(definition['title_' + currentLang], tabId)

  if (update === '') {
    videoTabs.push(tabId)
  }
  return tabId
}

function _createVideoTabContent (tabId, contentStr) {
  // Helper function to actually populate the tab with content.

  const row = document.createElement('div')
  row.setAttribute('class', 'row mx-1 align-items-center')
  $('#' + tabId).append(row)
  const overlayId = tabId + '_overlay'

  const content = parseINIString(contentStr)
  const videos = Object.keys(content)

  // Iterate through the content and build a card for each image
  videos.forEach((item, i) => {
    const videoDef = content[item]

    const col = document.createElement('div')
    col.setAttribute('class', 'col-4 mt-3')
    row.append(col)

    const card = createCard(videoDef)
    $(card).click(function () {
      videoOverlayShow(tabId, this)
    })
    col.append(card)
  })

  // Then, create the overlay that will show the media
  const overlay = document.createElement('div')
  overlay.setAttribute('class', 'row overlay mx-0 align-items-center')
  overlay.setAttribute('id', overlayId)
  $(overlay).click(function () {
    videoOverlayHide(tabId)
  })
  $('#' + tabId).append(overlay)
  $(overlay).hide()

  const bigVidCol = document.createElement('div')
  bigVidCol.setAttribute('class', 'offset-1 col-10 text-center')
  overlay.append(bigVidCol)

  const bigVid = document.createElement('video')
  bigVid.setAttribute('class', 'bigImage')
  bigVid.setAttribute('id', tabId + '_video')
  $(bigVid).on('ended', function () {
    videoOverlayHide(tabId)
  })
  bigVid.src = content[videos[0]].video
  bigVidCol.append(bigVid)

  const title = document.createElement('p')
  title.setAttribute('class', 'overlayTitle text-center')
  title.setAttribute('id', tabId + '_title')
  $(title).html(content[videos[0]].title)
  bigVidCol.append(title)

  const caption = document.createElement('p')
  caption.setAttribute('class', 'overlayCaption text-start')
  caption.setAttribute('id', tabId + '_caption')
  $(caption).html(content[videos[0]].caption)
  bigVidCol.append(caption)

  const credit = document.createElement('p')
  credit.setAttribute('class', 'overlayCredit fst-italic text-start')
  credit.setAttribute('id', tabId + '_credit')
  $(credit).html(content[videos[0]].credit)
  bigVidCol.append(credit)
}

function localizeVideoTab (id) {
  // Use the user-supplied data to supply the content in the current langauge;

  const definition = $('#' + id).data('user-definition')

  // Clear the pane and rebuild
  document.getElementById(id).innerHTML = ''
  createVideoTab(definition, id)
}

function fontSizeDecrease (animate = false) {
  // Take the given number of font ticks and convert it into the proper
  // font size for each kind of elements

  let duration = 0
  if (animate) {
    duration = 50
  }

  $('p, h1, h2, h3, h4, h5, h6, button, .card-title, li').animate({ fontSize: '-=3', queue: false }, duration)
}

function fontSizeDecreaseButtonPressed () {
  if (fontTicks > 0) {
    fontTicks -= 1
    fontSizeDecrease(true)
  }
}

function fontSizeReset () {
  while (fontTicks > 0) {
    fontSizeDecrease()
    fontTicks -= 1
  }
}

function fontSizeIncrease (animate = false, amount = 3) {
  // Take the given number of font ticks and convert it into the proper
  // font size for each kind of elements

  let duration = 0
  if (animate) {
    duration = 50
  }
  $('p, h1, h2, h3, h4, h5, h6, button, .card-title, li').animate({ fontSize: '+=' + String(amount), queue: false }, duration)
}

function fontSizeIncreaseButtonPressed () {
  if (fontTicks < 10) {
    fontTicks += 1
    fontSizeIncrease(true)
  }
}

function gotoTab (id) {
  // Swap the active tab

  // Make sure the tab is scrolled to the top
  $('#nav-tabContent').scrollTop(0)
  $('.tab-pane.active').removeClass('active')
  $('#' + id).addClass('active')

  // Chance button color
  $('.tabButton').removeClass('btn-primary').addClass('btn-secondary')
  $('#' + id + 'Button').removeClass('btn-secondary').addClass('btn-primary')
}

function hideAttractor () {
  // Make the attractor layer invisible

  constCommon.config.currentInteraction = true

  $('#attractorOverlay').fadeOut(100, result => {
    if (document.getElementById('attractorVideo').style.display === 'block') {
      // The attractor is a video, so pause it
      document.getElementById('attractorVideo').pause()
    }
    resetActivityTimer()
  })
}

function imageOverlayHide (id) {
  $('#' + id + '_overlay').fadeOut(100)
}

function imageOverlayShow (id, card) {
  // Retreive the details from the card data
  const details = $(card).data('details')

  // Use the details to fill out the overlay
  $('#' + id + '_image').attr('src', details.image)
  if (details.title != null) {
    $('#' + id + '_title').html(details.title)
  } else {
    $('#' + id + '_title').html('')
  }
  if (details.caption != null) {
    $('#' + id + '_caption').html(details.caption)
  } else {
    $('#' + id + '_caption').html('')
  }
  if (details.credit != null) {
    $('#' + id + '_credit').html(details.credit)
  } else {
    $('#' + id + '_credit').html('')
  }

  $('#' + id + '_overlay').fadeIn(100)
}

function updateFunc (update) {
  // Function to read a message from the server and take action based
  // on the contents

  if ('content' in update) {
    if (!constCommon.arraysEqual(update.content, currentContent)) {
      currentContent = update.content

      // Get the file from the helper and build the interface
      const definition = currentContent[0] // Only one INI file at a time

      const xhr = new XMLHttpRequest()
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          updateContent(parseINIString(xhr.responseText))
        }
      }
      xhr.open('GET', constCommon.config.helperAddress + '/content/' + definition, true)
      xhr.send(null)
    }
  }
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  constCommon.config.currentInteraction = true
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, timeoutDuration)
}

function setLanguages (langDict) {
  languageDict = langDict
  currentLang = langDict.default
}

function setMasthead (dataDict) {
  // Helper function to set the masthead content (usually text)

  $('#masthead').data('user-data', dataDict)
  $('#masthead').html(dataDict[languageDict.default])
}

function localizeMasthead () {
  // Update the masthead with content matching the current language.

  const dataDict = $('#masthead').data('user-data')
  $('#masthead').html(dataDict[currentLang])
}

function setAttractor (filename, fileType) {
  attractorAvailable = true
  if (fileType === 'video') {
    document.getElementById('attractorVideo').src = filename
    document.getElementById('attractorImage').style.display = 'none'
    document.getElementById('attractorVideo').style.display = 'block'
  } else if (fileType === 'image') {
    document.getElementById('attractorImage').src = filename
    document.getElementById('attractorImage').style.display = 'block'
    document.getElementById('attractorVideo').style.display = 'none'
  } else {
    attractorAvailable = false
  }
}

function showAttractor () {
  // Make the attractor layer visible

  // We don't want to show the attractor while a video is playing
  if (videoPlaying) {
    resetActivityTimer()
    return
  }

  constCommon.config.currentInteraction = false

  if (attractorAvailable) {
    if (document.getElementById('attractorVideo').style.display === 'block') {
      // The attractor is a video, so play the video
      document.getElementById('attractorVideo').play()
        .then(result => {
          $('#attractorOverlay').fadeIn(100)
        }).then(result => {
          fontSizeReset()
          setLang(languageDict.default)
          gotoTab(firstTab)
          $('#nav-tabContent').scrollTop(0)
        })
    } else {
      $('#attractorOverlay').fadeIn(100)
      fontSizeReset()
      setLang(languageDict.default)
      gotoTab(firstTab)
      $('#nav-tabContent').scrollTop(0)
    }
  } else {
    $('#attractorOverlay').fadeOut(100)
    fontSizeReset()
    setLang(languageDict.default)
    $('#nav-tabContent').scrollTop(0)
  }
}

function setLang (lang) {
  // Switch the currentLang and rebuild the interface.

  currentLang = lang

  // First, record the current text size and reset everything to the default.
  const sizeToSet = fontTicks
  fontSizeReset() // Clear size so all elements are equally affected

  localizeMasthead()

  if (currentLang === 'en') {
    $('#langToggleButton').html(languageDict.es)
  } else {
    $('#langToggleButton').html(languageDict.en)
  }
  tabsUpdated = 0
  textTabs.forEach((item, i) => {
    localizeTextTab(item)
  })
  videoTabs.forEach((item, i) => {
    localizeVideoTab(item)
  })
  imageTabs.forEach((item, i) => {
    localizeImageTab(item)
  })

  // Finally, update all elements to the previous text size.
  // Add a delay since the tabs are built using async requests
  const tabsToUpdate = textTabs.length + videoTabs.length + imageTabs.length

  const tempFunc = function () {
    if (tabsUpdated === tabsToUpdate) {
      fontSizeIncrease(false, 3 * sizeToSet)
      fontTicks = sizeToSet
    } else {
      setTimeout(tempFunc, 5)
    }
  }
  tempFunc()
}

function toggleLang (lang) {
  // Toggle to the opposite language
  if (currentLang === 'en') {
    setLang('es')
  } else {
    setLang('en')
  }
}

function videoOverlayHide (id) {
  videoPlaying = false
  $('#' + id + '_overlay').fadeOut(100)
  document.getElementById(id + '_video').pause()
  document.getElementById(id + '_video').currentTime = 0
}

function videoOverlayShow (id, card) {
  videoPlaying = true

  // Retreive the details from the card data
  const details = $(card).data('details')

  // Use the details to fill out the overlay
  $('#' + id + '_video').attr('src', details.video)
  if (details.title != null) {
    $('#' + id + '_title').html(details.title)
  } else {
    $('#' + id + '_title').html('')
  }
  if (details.caption != null) {
    $('#' + id + '_caption').html(details.caption)
  } else {
    $('#' + id + '_caption').html('')
  }
  if (details.credit != null) {
    $('#' + id + '_credit').html(details.credit)
  } else {
    $('#' + id + '_credit').html('')
  }

  $('#' + id + '_overlay').fadeIn(100)
  document.getElementById(id + '_video').play()
}

constCommon.config.helperAddress = window.location.origin
constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.softwareVersion = 2.0
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/apps/infostation/version.txt'
constCommon.config.constellationAppID = 'infostation'
constCommon.config.debug = true

let videoPlaying = false // Is a video currently playing?
let inactivityTimer = 0
let fontTicks = 0 // Number of times we have increased the font size
let languageDict = { default: 'en' }
let currentLang = 'en'
let attractorAvailable = false
let timeoutDuration = 30000 // ms of no activity before the attractor is shown.
let textTabs = [] // Holds ids of textTabs.
let videoTabs = []
let imageTabs = []
let firstTab = ''
let tabsUpdated = 0 // Async tab updates check in here during setLang()
let currentContent = []

$(document).bind('touchstart', resetActivityTimer)
$('#fontSizeDecreaseButton').click(fontSizeDecreaseButtonPressed)
$('#fontSizeIncreaseButton').click(fontSizeIncreaseButtonPressed)
$('#attractorOverlay').click(hideAttractor)
$('#langToggleButton').click(toggleLang)

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()
setInterval(constCommon.sendPing, 5000)

hideAttractor()
