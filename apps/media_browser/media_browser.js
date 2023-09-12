import * as constCommon from '../js/constellation_app_common.js'

function changePage (val) {
  switch (val) {
    case 0:
      currentPage = 0
      break
    case 1:
      currentPage += 1
      if (currentPage * cardsPerPage > spreadsheet.length) {
        currentPage -= 1
      }
      break
    case -1:
      currentPage -= 1
      if (currentPage < 0) {
        currentPage = 0
      }
      break
    default:
  }
  populateResultsRow()
}

function clear () {
  currentPage = 0
  // $('#searchInput').val('')
  // keyboard.input.default = ''
  // keyboard.input.searchInput = ''
  // $('.filterSelect').val(null)
  populateResultsRow()
}

function createCard (obj) {
  // Take a JSON object and turn it into a card in the resultsRow

  const def = $(document).data('browserDefinition')
  let thumb

  if (thumbnailKey != null && thumbnailKey !== '') {
    thumb = 'thumbnails/' + String(obj[thumbnailKey])
  } else {
    // Change the file extension to .jpg, since that is the default for Constellation
    let thumbName = String(obj[mediaKey])
    const dotIndex = thumbName.lastIndexOf('.')
    thumbName = thumbName.substring(0, dotIndex < 0 ? thumbName.length : dotIndex) + '.jpg'
    thumb = 'thumbnails/' + thumbName
  }

  let title = ''
  if (titleKey != null && titleKey !== '') {
    title = obj[titleKey]
  }

  const id = String(Math.round(Date.now() * Math.random()))

  obj.uniqueMediaBrowserID = id

  const col = document.createElement('div')
  col.classList = 'cardCol col align-items-center justify-content-center d-flex'
  // Calculate the height of the card based on the number of rows

  if ('show_search_and_filter' in def.style.layout && def.style.layout.show_search_and_filter === true) {
    col.style.height = String(Math.round(60 / numRows)) + 'vh'
  } else {
    col.style.height = String(Math.round(95 / numRows)) + 'vh'
  }

  const card = document.createElement('div')
  card.classList = 'resultCard row w-100'
  card.addEventListener('click', function () {
    displayMedia(id)
  })
  col.appendChild(card)

  const imgCol = document.createElement('div')
  imgCol.classList = 'col col-12'

  if ('image_height' in def.style.layout) {
    imgCol.style.height = String(def.style.layout.image_height) + '%'
  } else {
    imgCol.style.height = '70%'
  }
  card.appendChild(imgCol)

  const img = document.createElement('img')
  img.classList = 'resultImg'
  img.src = thumb
  img.setAttribute('id', 'Entry_' + id)

  imgCol.appendChild(img)

  if (('imageHeight' in def.style.layout && def.style.layout.image_height < 100) || !('imageHeight' in def.style.layout)) {
    const titleCol = document.createElement('div')
    titleCol.classList = 'col col-12 text-center'
    card.appendChild(titleCol)

    const titleSpan = document.createElement('span')
    titleSpan.classList = 'cardTitle'
    titleSpan.innerHTML = title
    titleCol.appendChild(titleSpan)
  }

  $('#resultsRow').append(col)
}

function hideImageLightBox () {
  // Fade out the lightbox, and then hide it so it doesn't steal touches

  const temp = function () { $('#imageLightbox').css('display', 'none') }
  $('#imageLightbox').animate({ opacity: 0, queue: false }, { complete: temp, duration: 100 })
}

function onFilterOptionChange () {
  currentPage = 0
  populateResultsRow()
}

function populateFilterOptions (titles) {
  // Read the filterKeys and create a dropdown for each

  if (filterKeys == null) {
    return
  }
  $('#filterOptionsRow').empty()

  filterKeys.forEach((key, i) => {
    const newCol = document.createElement('div')
    newCol.className = 'col-3 col-xl-6'
    $('#filterOptionsRow').append(newCol)

    if (titles != null) {
      const title = document.createElement('H3')
      title.innerHTML = titles[i]
      newCol.append(title)
    }
    const newSelect = document.createElement('select')
    newSelect.className = 'form-select filterSelect'
    newSelect.multiple = true
    newSelect.setAttribute('data-filterKey', key)

    const uniqueValues = [...new Set(spreadsheet.map(entry => entry[key]))].sort()
    let newOption
    uniqueValues.forEach((value, j) => {
      newOption = document.createElement('option')
      newOption.value = value
      newOption.innerHTML = value
      newSelect.appendChild(newOption)
    })
    newCol.appendChild(newSelect)
    newSelect.addEventListener('change', onFilterOptionChange)
  })
}

function _populateResultsRow (currentKey) {
  // Empty and repopulate the results row based on the given filters
  // currentKey accounts for the key being pressed right now, which is not
  // yet part of the input value

  $('#resultsRow').empty()

  // const input = $('#searchInput').val()
  // // Filter on search terms
  // const searchTerms = (input).split(' ')
  // const searchedData = []
  // spreadsheet.forEach((item, i) => {
  //   let matchCount = 0
  //   searchTerms.forEach((term, i) => {
  //     if (term !== '' || (term === '' && searchTerms.length === 1)) {
  //       // Strip out non-letters, since the keyboard doesn't allow them
  //       if (item.searchData.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z\s]/ig, '').toLowerCase().includes(term.replace(/[^A-Za-z]/ig, '').toLowerCase())) {
  //         matchCount += 1
  //       }
  //     }
  //   })
  //   if (matchCount > 0) {
  //     item.matchCount = matchCount
  //     searchedData.push(item)
  //   }
  // })

  // // Filter on filter options
  // const filters = $.makeArray($('.filterSelect'))
  // const filteredData = []
  // let thisKey, selectedValues, filterMathces
  // // Iterate through the remaining data and make sure it matches at least
  // // one filtered value.
  // searchedData.forEach((item, i) => {
  //   filterMathces = {}
  //   filters.forEach((filter, j) => {
  //     thisKey = filter.getAttribute('data-filterKey')
  //     selectedValues = $(filter).val()
  //     if (selectedValues.length > 0) {
  //       if (selectedValues.includes(item[thisKey])) {
  //         filterMathces[thisKey] = 1
  //         item.matchCount += 1
  //       } else {
  //         filterMathces[thisKey] = 0
  //       }
  //     } else {
  //       // If no values are selected for this filter, pass all matches through
  //       filterMathces[thisKey] = 1
  //     }
  //   })
  //   // Iterate through the matches to make sure we've matched on every filter
  //   let totalMathces = 0
  //   for (const [matchKey, matchValue] of Object.entries(filterMathces)) {
  //     if (matchValue === 1) {
  //       totalMathces += 1
  //     }
  //   }
  //   if (totalMathces === filters.length) {
  //     filteredData.push(item)
  //   }
  // })

  // // Sort by the number of matches, so better results rise to the top.
  // filteredData.sort((a, b) => b.matchCount - a.matchCount)

  // Make sure we have no more than 12 results to display
  const displayedResults = spreadsheet.slice(cardsPerPage * currentPage, cardsPerPage * (currentPage + 1))
  // Create a card for each item and add it to the display
  displayedResults.forEach((item, i) => {
    createCard(item)
  })
  $('#resultsRow').fadeIn(200)
}

function populateResultsRow (currentKey = '') {
  // Stub function to do the fade, then call the helper function

  $('#resultsRow').fadeOut(200, function () { _populateResultsRow(currentKey) })
}

function displayMedia (id) {
  // Take the given id and display the media in the overlay.

  const obj = spreadsheet.filter(function (item) {
    return item.uniqueMediaBrowserID === id
  })[0]

  let title = ''
  if (titleKey !== undefined && titleKey !== '') {
    title = obj[titleKey]
  }

  let caption = ''
  if (captionKey != null && captionKey !== '') {
    caption = obj[captionKey]
  }
  let credit = ''
  if (creditKey != null && creditKey !== '') {
    credit = obj[creditKey]
  }
  showImageInLightBox(String(obj[mediaKey]), title, caption, credit)
}

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

  // Tag the document with the defintion for later reference
  $(document).data('browserDefinition', def)

  const root = document.querySelector(':root')

  const langs = Object.keys(def.languages)
  if (langs.length === 0) return

  constCommon.createLanguageSwitcher(def, localize)

  // Configure the attractor
  if ('inactivity_timeout' in def) {
    inactivityTimeout = def.inactivity_timeout * 1000
  }
  if ('attractor' in def && def.attractor.trim() !== '') {
    if (constCommon.guessMimetype(def.attractor) === 'video') {
      attractorType = 'video'

      document.getElementById('attractorVideo').src = 'content/' + def.attractor
      document.getElementById('attractorVideo').style.display = 'block'
      document.getElementById('attractorImage').style.display = 'none'
      document.getElementById('attractorVideo').play()
    } else {
      attractorType = 'image'
      try {
        document.getElementById('attractorVideo').stop()
      } catch {
        // Ignore the error that arises if we're pausing a video that doesn't exist.
      }

      document.getElementById('attractorImage').src = 'content/' + def.attractor
      document.getElementById('attractorImage').style.display = 'block'
      document.getElementById('attractorVideo').style.display = 'none'
    }

    attractorAvailable = true
  } else {
    hideAttractor()
    attractorAvailable = false
  }

  // Configure layout
  // if ('show_search_and_filter' in def.style.layout && def.style.layout.show_search_and_filter === true) {
  //   document.getElementById('seerchFilterPane').style.display = 'flex'
  //   document.getElementById('displayPane').classList.remove('display-full')
  //   document.getElementById('displayPane').classList.add('display-share')
  // } else {
  //   document.getElementById('seerchFilterPane').style.display = 'none'
  //   document.getElementById('displayPane').classList.add('display-full')
  //   document.getElementById('displayPane').classList.remove('display-share')
  // }
  if ('num_columns' in def.style.layout) {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-' + String(def.style.layout.num_columns)
    numCols = def.style.layout.num_columns
  } else {
    document.getElementById('resultsRow').classList = 'h-100 row row-cols-6'
    numCols = 6
  }
  if ('items_per_page' in def.style.layout) {
    cardsPerPage = parseInt(def.style.layout.items_per_page)
  } else {
    cardsPerPage = 12
  }
  numRows = Math.ceil(cardsPerPage / numCols)

  if ('lightbox_title_height' in def.style.layout) {
    document.getElementById('imageLightboxTitle').style.height = String(def.style.layout.lightbox_title_height) + '%'
  } else {
    document.getElementById('imageLightboxTitle').style.height = '9%'
  }
  if ('lightbox_caption_height' in def.style.layout) {
    document.getElementById('imageLightboxCaption').style.height = String(def.style.layout.lightbox_caption_height) + '%'
  } else {
    document.getElementById('imageLightboxCaption').style.height = '15%'
  }
  if ('lightbox_credit_height' in def.style.layout) {
    document.getElementById('imageLightboxCredit').style.height = String(def.style.layout.lightbox_credit_height) + '%'
  } else {
    document.getElementById('imageLightboxCredit').style.height = '6%'
  }
  if ('lightbox_image_height' in def.style.layout) {
    document.getElementById('imageLightboxImage').style.height = String(def.style.layout.lightbox_image_height) + '%'
  } else {
    document.getElementById('imageLightboxImage').style.height = '70%'
  }

  // Modify the style

  // Color

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--backgroundColor', 'white')
  root.style.setProperty('--titleColor', 'black')

  // Then, apply the definition settings
  Object.keys(def.style.color).forEach((key) => {
    document.documentElement.style.setProperty('--' + key, def.style.color[key])
  })

  // Set icon colors based on the background color.
  const backgroundColor = constCommon.getColorAsRGBA(document.body, 'background-color')
  const backgroundClassification = constCommon.classifyColor(backgroundColor)
  if (backgroundClassification === 'light') {
    document.getElementById('langSwitchDropdownIcon').src = '_static/icons/translation-icon_black.svg'
  } else {
    document.getElementById('langSwitchDropdownIcon').src = '_static/icons/translation-icon_white.svg'
  }

  // Font

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--Header-font', 'Header-default')
  root.style.setProperty('--Title-font', 'Title-default')
  root.style.setProperty('--Lightbox_title-font', 'Lightbox_title-default')
  root.style.setProperty('--Lightbox_caption-font', 'Lightbox_caption-default')
  root.style.setProperty('--Lightbox_credit-font', 'Lightbox_credit-default')

  // Then, apply the definition settings
  Object.keys(def.style.font).forEach((key) => {
    const font = new FontFace(key, 'url(' + encodeURI(def.style.font[key]) + ')')
    document.fonts.add(font)
    root.style.setProperty('--' + key + '-font', key)
  })

  // Text size settings

  // First, reset to defaults (in case a style option doesn't exist in the definition)
  root.style.setProperty('--Header-font-adjust', 0)
  root.style.setProperty('--Title-font-adjust', 0)
  root.style.setProperty('--Lightbox_title-font-adjust', 0)
  root.style.setProperty('--Lightbox_caption-font-adjust', 0)
  root.style.setProperty('--Lightbox_credit-font-adjust', 0)

  // Then, apply the definition settings
  Object.keys(def.style.text_size).forEach((key) => {
    const value = def.style.text_size[key]
    root.style.setProperty('--' + key + '-font-adjust', value)
  })

  // Find the default language
  Object.keys(def.languages).forEach((lang) => {
    if (def.languages[lang].default === true) defaultLang = lang
  })

  // Load the CSV file containing the items ad build the results row
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true
  })
    .then((response) => {
      const csvAsJSON = constCommon.csvToJSON(response)
      spreadsheet = csvAsJSON.json // Global property
      localize(defaultLang)

      // Send a thumbnail to the helper
      setTimeout(() => constCommon.saveScreenshotAsThumbnail(def.uuid + '.png'), 100)
    })
}

function localize (lang) {
  // Use the spreadsheet and defintion to set the content to the given language

  const definition = $(document).data('browserDefinition')

  if ('media_key' in definition.languages[lang]) {
    mediaKey = definition.languages[lang].media_key
  } else {
    mediaKey = null
  }
  if ('thumbnail_key' in definition.languages[lang]) {
    thumbnailKey = definition.languages[lang].thumbnail_key
  } else {
    thumbnailKey = null
  }
  if ('title_key' in definition.languages[lang]) {
    titleKey = definition.languages[lang].title_key
  } else {
    titleKey = null
  }
  if ('caption_key' in definition.languages[lang]) {
    captionKey = definition.languages[lang].caption_key
  } else {
    captionKey = null
  }
  if ('credit_key' in definition.languages[lang]) {
    creditKey = definition.languages[lang].credit_key
  } else {
    creditKey = null
  }
  if ('search_keys' in definition.languages[lang]) {
    searchKeys = definition.languages[lang].search_keys
  } else {
    searchKeys = []
  }

  if ('filter_keys' in definition.languages[lang] && definition.languages[lang].filter_keys.length > 0) {
    // Split and trim the entries in a list
    filterKeys = definition.languages[lang].filter_keys.map(function (item) {
      return item.trim()
    })
    $('#filterRegion').show()
  } else {
    filterKeys = []
    $('#filterRegion').hide()
  }
  let filterTitles = null
  if ('filter_titles' in definition.languages[lang]) {
    // Split and trim the entries in a list
    filterTitles = definition.languages[lang].map(function (item) {
      return item.trim()
    })
  }

  populateFilterOptions(filterTitles)

  // Create a new property, searchData, for each data element that includes
  // everything we can search against as a string.
  spreadsheet.forEach((item, i) => {
    item.searchData = ''
    searchKeys.forEach((key, j) => {
      item.searchData += String(item[key]) + ' '
    })
  })

  populateResultsRow()
}

function showAttractor () {
  // Make the attractor layer visible

  constCommon.config.currentInteraction = false
  if (attractorAvailable) {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').play()
        .then(result => {
          $('#attractorOverlay').fadeIn()
          hideImageLightBox()
          clear()
        })
    } else {
      $('#attractorOverlay').fadeIn()
      hideImageLightBox()
      clear()
    }
  } else {
    hideImageLightBox()
    clear()
  }
}

function hideAttractor () {
  // Make the attractor layer invisible

  $('#attractorOverlay').fadeOut(result => {
    if (attractorType === 'video') {
      document.getElementById('attractorVideo').pause()
    }
    constCommon.config.currentInteraction = true
    resetActivityTimer()
  })
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, inactivityTimeout)
}

function showImageInLightBox (image, title = '', caption = '', credit = '') {
  // Set the img source to the provided image, set the caption, and reveal
  // the light box. The desired image must be located in the media directory

  // Hide elements until image is loaded
  $('#imageLightboxImage, #imageLightboxTitle, #imageLightboxCaption, #imageLightboxCredit').hide()

  document.getElementById('imageLightboxTitle').innerHTML = title
  document.getElementById('imageLightboxCaption').innerHTML = caption

  if (credit !== '' && credit != null) {
    document.getElementById('imageLightboxCredit').innerHTML = 'Credit: ' + credit
  } else {
    document.getElementById('imageLightboxCredit').innerHTML = ''
  }

  // Load the image with a callback to fade it in when it is loaded
  $('#imageLightboxImage').one('load', function () {
    $('#imageLightboxImage, #imageLightboxTitle, #imageLightboxCredit, #imageLightboxCaption').fadeIn()
    // if (caption === '') {
    //   $('#imageLightboxImage').addClass('imageLightboxImageTall').removeClass('imageLightboxImageShort')
    //   $('#imageLightboxCaption').hide()
    // } else {
    //   $('#imageLightboxImage').removeClass('imageLightboxImageTall').addClass('imageLightboxImageShort')
    //   $('#imageLightboxCaption').fadeIn()
    // }
  }).attr('src', 'content/' + image)

  $('#imageLightbox').css('display', 'flex').animate({ opacity: 1, queue: false }, 100)
}

// const Keyboard = window.SimpleKeyboard.default

// // Add a listener to each input so we direct keyboard input to the right one
// document.querySelectorAll('.input').forEach(input => {
//   input.addEventListener('focus', onInputFocus)
// })
// function onInputFocus (event) {
//   keyboard.setOptions({
//     inputName: event.target.id
//   })
// }
// function onInputChange (event) {
//   keyboard.setInput(event.target.value, event.target.id)
// }
// function onKeyPress (button) {
//   if (button === '{lock}' || button === '{shift}') handleShiftButton()
//   currentPage = 0
//   populateResultsRow(button)
// }
// document.querySelector('.input').addEventListener('input', event => {
//   keyboard.setInput(event.target.value)
// })
// function onChange (input) {
//   document.querySelector('#searchInput').value = input
// }

// const keyboard = new Keyboard({
//   onChange: input => onChange(input),
//   onKeyPress: button => onKeyPress(button),
//   layout: {
//     default: [
//       'Q W E R T Y U I O P',
//       'A S D F G H J K L',
//       'Z X C V B N M {bksp}',
//       '{space}'
//     ]
//   }
// })

let spreadsheet, mediaKey, thumbnailKey, searchKeys, titleKey, captionKey, creditKey, filterKeys
const currentContent = []
let currentPage = 0
let cardsPerPage, numCols, numRows
let defaultLang = ''

constCommon.configureApp({
  name: 'media_browser',
  debug: true,
  loadDefinition,
  parseUpdate: updateParser
})

let currentDefintion = ''

let inactivityTimer = null
let inactivityTimeout = 30000
let attractorAvailable = false
let attractorType = 'image'

// Attach event listeners
$('#previousPageButton').click(function () {
  changePage(-1)
})
$('#nextPageButton').click(function () {
  changePage(1)
})
$('body').click(resetActivityTimer)
$('#attractorOverlay').click(hideAttractor)
$('.hideLightboxTrigger').click(hideImageLightBox)
