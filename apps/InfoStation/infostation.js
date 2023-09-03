/* global showdown */

import * as constCommon from '../js/constellation_app_common.js'

function loadDefinition (definition) {
  // Parse the current definition and build the interface correspondingly.

  console.log(definition)

  const root = document.querySelector(':root')

  $(document).data('definition', definition)
  // Clear the existing content
  fontSizeReset()
  $('#nav-tabContent').empty()
  $('#buttonRow').empty()
  textTabs = []
  imageTabs = []
  videoTabs = []

  // Set up the available languages
  constCommon.createLanguageSwitcher(definition, localize)

  // Configure the attractor
  if ('attractor' in definition) {
    const fileType = getFileType(definition.attractor)
    if (['image', 'video'].includes(fileType)) {
      setAttractor(definition.attractor, fileType)
    }
  } else {
    attractorAvailable = false
  }
  if ('inactivity_timeout' in definition) {
    timeoutDuration = parseFloat(definition.inactivity_timeout) * 1000
  } else {
    timeoutDuration = 30000
  }

  // Modify the style

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--background-color', '#719abf')
  root.style.setProperty('--header-color', '#706F8E')
  root.style.setProperty('--footer-color', '#706F8E')
  root.style.setProperty('--section-header-color', 'white')
  root.style.setProperty('--section-background-color', '#393A5A')
  root.style.setProperty('--section-border-color', '#E9E9E9')
  root.style.setProperty('--section-shadow-color', 'RGBA(34,34,46, .5)')
  root.style.setProperty('--text-color', 'white')
  root.style.setProperty('--toolbarButton-color', '#393A5A')

  // Then, apply the definition settings
  Object.keys(definition.style.color).forEach((key) => {
    document.documentElement.style.setProperty('--' + key + '-color', definition.style.color[key])
  })

  if (Object.keys(definition.languages).length > 0) {
    localize(Object.keys(definition.languages)[0])
  }
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

function localize (lang) {
  // Use the given language code to configure the GUI

  const fullDefinition = $(document).data('definition')
  const definition = fullDefinition.languages[lang]

  document.getElementById('buttonRow').innerHTML = ''

  if (definition.tab_order.length < 2) {
    document.getElementById('buttonRow').style.display = 'none'
  } else {
    document.getElementById('buttonRow').style.display = 'flex'
  }

  if (definition.header != null) {
    document.getElementById('masthead').innerHTML = definition.header
  } else {
    document.getElementById('masthead').innerHTML = ''
  }

  // Create the tabs
  definition.tab_order.forEach((uuid, i) => {
    const tabDef = definition.tabs[uuid]
    console.log(tabDef)
    let tabId
    const tabType = tabDef.type
    if (tabType === 'text') {
      tabId = createTextTab(tabDef)
    } else if (tabType === 'image') {
      tabId = createImageTab(tabDef)
    } else if (tabType === 'video') {
      tabId = createVideoTab(tabDef)
    }
    if (i === 0) {
      firstTab = tabId
    }
  })
  gotoTab(firstTab)
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
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/' + definition['content_' + currentLang],
    rawResponse: true
  })
    .then((response) => {
      _createImageTabContent(tabId, response)
    })

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

  const content = constCommon.parseINIString(contentStr)
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

function createTextTab (definition) {
  // Create a pane that displays Markdown-formatted text and images

  // First, create the pane
  const tabId = 'textTab_' + String(Date.now())
  const pane = document.createElement('div')
  pane.setAttribute('id', tabId)
  pane.setAttribute('class', 'tab-pane fade show active')
  $(pane).data('user-definition', definition)
  $('#nav-tabContent').append(pane)

  const row = document.createElement('div')
  row.setAttribute('class', 'row mx-1 align-items-center')
  $('#' + tabId).append(row)

  const col = document.createElement('div')
  col.setAttribute('class', 'col-12 textCol mt-3')
  col.setAttribute('id', tabId + 'Content')
  row.append(col)

  _createTextTabContent(tabId, definition.text)

  // Create button for this tab
  createButton(definition.button_text, tabId)

  textTabs.push(tabId)

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
}

// function localizeTextTab (id) {
//   // Use the user-supplied data to supply the content in the current langauge;

//   const definition = $('#' + id).data('user-definition')

//   // Clear the pane and rebuild
//   document.getElementById(id + 'Content').innerHTML = ''
//   createTextTab(definition, id)
// }

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
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/' + definition['content_' + currentLang],
    rawResponse: true
  })
    .then((response) => {
      _createVideoTabContent(tabId, response)
    })

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

  const content = constCommon.parseINIString(contentStr)
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

  if (id === '') return

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

}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  constCommon.config.currentInteraction = true
  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, timeoutDuration)
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

  const definition = $(document).data('definition')

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
          localize(Object.keys(definition.languages)[0])
          gotoTab(firstTab)
          $('#nav-tabContent').scrollTop(0)
        })
    } else {
      $('#attractorOverlay').fadeIn(100)
      fontSizeReset()
      localize(Object.keys(definition.languages)[0])
      gotoTab(firstTab)
      $('#nav-tabContent').scrollTop(0)
    }
  } else {
    $('#attractorOverlay').fadeOut(100)
    fontSizeReset()
    localize(Object.keys(definition.languages)[0])
    $('#nav-tabContent').scrollTop(0)
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

let videoPlaying = false // Is a video currently playing?
let inactivityTimer = 0
let fontTicks = 0 // Number of times we have increased the font size
const currentLang = 'en'
let attractorAvailable = false
let timeoutDuration = 30000 // ms of no activity before the attractor is shown.
let textTabs = [] // Holds ids of textTabs.
let videoTabs = []
let imageTabs = []
let firstTab = ''

$(document).bind('touchstart', resetActivityTimer)
$('#fontSizeDecreaseButton').click(fontSizeDecreaseButtonPressed)
$('#fontSizeIncreaseButton').click(fontSizeIncreaseButtonPressed)
$('#attractorOverlay').click(hideAttractor)

// Constellation stuff
constCommon.configureApp({
  name: 'infostation',
  debug: true,
  loadDefinition,
  parseUpdate: updateFunc
})

hideAttractor()
