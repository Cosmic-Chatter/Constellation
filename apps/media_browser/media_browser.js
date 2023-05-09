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
  $('#searchInput').val('')
  keyboard.input.default = ''
  keyboard.input.searchInput = ''
  $('.filterSelect').val(null)
  populateResultsRow()
}

function createCard (obj) {
  // Take a JSON object and turn it into a card in the resultsRow

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

  let titleClass
  if (title.length > 30) {
    titleClass = 'resultTitleSmall'
  } else if (title.length > 20) {
    titleClass = 'resultTitleMedium'
  } else {
    titleClass = 'resultTitleLarge'
  }

  const col = document.createElement('div')
  col.classList = 'cardCol col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2 align-items-center justify-content-top d-flex'

  const card = document.createElement('div')
  card.classList = 'resultCard row my-2 w-100'
  card.addEventListener('click', function () {
    displayMedia(id)
  })
  col.appendChild(card)

  const center = document.createElement('center')
  card.appendChild(center)

  const img = document.createElement('img')
  img.classList = 'resultImg'
  img.src = thumb
  img.setAttribute('id', 'Entry_' + id)
  center.appendChild(img)

  const p = document.createElement('p')
  p.classList = 'cardTitle ' + titleClass
  p.innerHTML = title
  center.appendChild(p)

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

    const uniqueValues = [...new Set(data.map(entry => entry[key]))].sort()
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

  const input = $('#searchInput').val()
  // Filter on search terms
  const searchTerms = (input).split(' ')
  const searchedData = []
  spreadsheet.forEach((item, i) => {
    console.log(item)
    let matchCount = 0
    searchTerms.forEach((term, i) => {
      console.log(term, searchTerms)
      if (term !== '' || (term === '' && searchTerms.length === 1)) {
        // Strip out non-letters, since the keyboard doesn't allow them
        if (item.searchData.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z\s]/ig, '').toLowerCase().includes(term.replace(/[^A-Za-z]/ig, '').toLowerCase())) {
          matchCount += 1
        }
      }
    })
    if (matchCount > 0) {
      item.matchCount = matchCount
      searchedData.push(item)
    }
  })

  // Filter on filter options
  const filters = $.makeArray($('.filterSelect'))
  const filteredData = []
  let thisKey, selectedValues, filterMathces
  // Iterate through the remaining data and make sure it matches at least
  // one filtered value.
  searchedData.forEach((item, i) => {
    filterMathces = {}
    filters.forEach((filter, j) => {
      thisKey = filter.getAttribute('data-filterKey')
      selectedValues = $(filter).val()
      if (selectedValues.length > 0) {
        if (selectedValues.includes(item[thisKey])) {
          filterMathces[thisKey] = 1
          item.matchCount += 1
        } else {
          filterMathces[thisKey] = 0
        }
      } else {
        // If no values are selected for this filter, pass all matches through
        filterMathces[thisKey] = 1
      }
    })
    // Iterate through the matches to make sure we've matched on every filter
    let totalMathces = 0
    for (const [matchKey, matchValue] of Object.entries(filterMathces)) {
      if (matchValue === 1) {
        totalMathces += 1
      }
    }
    if (totalMathces === filters.length) {
      filteredData.push(item)
    }
  })

  // Sort by the number of matches, so better results rise to the top.
  filteredData.sort((a, b) => b.matchCount - a.matchCount)

  // Make sure we have no more than 12 results to display
  const displayedResults = filteredData.slice(cardsPerPage * currentPage, cardsPerPage * (currentPage + 1))
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

  const obj = data.filter(function (item) {
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

  // createLanguageSwitcher(def)
  defaultLang = langs[0]

  // Load the CSV file containing the timeline data and use it to build the timeline entries.
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/content/' + def.spreadsheet,
    rawResponse: true
  })
    .then((response) => {
      const csvAsJSON = constCommon.csvToJSON(response)
      spreadsheet = csvAsJSON // Global property
      localize(defaultLang)
    })

  // Configure the attractor
  if ('attractor' in def && def.attractor.trim() !== '') {
    $('#attractorVideo').attr('src', 'content/' + def.attractor)
    document.getElementById('attractorVideo').play()
    attractorAvailable = true
  } else {
    hideAttractor()
    attractorAvailable = false
  }

  if ('search_keys' in def) {
    searchKeys = def.search_keys
  } else {
    searchKeys = []
  }
  // if ('title_key' in definition.SETTINGS) {
  //   titleKey = definition.SETTINGS.title_key
  // } else {
  //   titleKey = 'Title'
  // }
  // if ('caption_key' in definition.SETTINGS) {
  //   captionKey = definition.SETTINGS.caption_key
  // } else {
  //   captionKey = 'Caption'
  // }
  // if ('credit_key' in definition.SETTINGS) {
  //   creditKey = definition.SETTINGS.credit_key
  // } else {
  //   creditKey = 'Credit'
  // }
  // if ('filter_keys' in definition.SETTINGS) {
  //   // Split and trim the entries in a list
  //   filterKeys = definition.SETTINGS.filter_keys.split(',').map(function (item) {
  //     return item.trim()
  //   })
  //   $('#filterRegion').show()
  // } else {
  //   filterKeys = []
  //   $('#filterRegion').hide()
  // }
  // let filterTitles = null
  // if ('filter_titles' in definition.SETTINGS) {
  //   // Split and trim the entries in a list
  //   filterTitles = definition.SETTINGS.filter_titles.split(',').map(function (item) {
  //     return item.trim()
  //   })
  // }
  if ('items_per_page' in def) {
    cardsPerPage = parseInt(def.items_per_page)
    customCardsPerPage = true
  } else {
    cardsPerPage = null
    customCardsPerPage = false
    setCardCount()
  }

  // // Send a GET request for the content and then build the tab
  // const xhr = new XMLHttpRequest()
  // xhr.onreadystatechange = function () {
  //   if (xhr.readyState === 4 && xhr.status === 200) {
  //     // Set the global data variable
  //     data = constCommon.csvToJSON(xhr.responseText)

  //     // Create a new property, searchData, for each data element that includes
  //     // everything we can search against as a string.
  //     data.forEach((item, i) => {
  //       item.searchData = ''
  //       searchKeys.forEach((key, j) => {
  //         item.searchData += String(item[key]) + ' '
  //       })
  //     })
  //     populateResultsRow()
  //     populateFilterOptions(filterTitles)
  //   }
  // }
  // xhr.open('GET', constCommon.config.helperAddress + '/' + 'content/' + definition.SETTINGS.data, true)
  // xhr.send(null)
}

function localize (lang) {
  // Use the spreadsheet and defintion to set the content to the given language

  const definition = $(document).data('browserDefinition')

  if ('media_key' in definition[lang]) {
    mediaKey = definition[lang].media_key
  } else {
    mediaKey = 'Media'
  }
  if ('thumbnail_key' in definition[lang]) {
    thumbnailKey = definition[lang].thumbnail_key
  } else {
    thumbnailKey = null
  }

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
    document.getElementById('attractorVideo').play()
      .then(result => {
        $('#attractorOverlay').show()
        hideImageLightBox()
        clear()
      })
  } else {
    hideImageLightBox()
    clear()
  }
}

function hideAttractor () {
  // Make the attractor layer invisible

  $('#attractorOverlay').hide(result => {
    document.getElementById('attractorVideo').pause()
    constCommon.config.currentInteraction = true
    resetActivityTimer()
  })
}

function resetActivityTimer () {
  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer)
  inactivityTimer = setTimeout(showAttractor, 30000)
}

function setCardCount () {
  // Based on the window size and the Bootstrap grid, calculate the number of
  // cards we will be showing per page.

  if (customCardsPerPage === false) {
    const windowWidth = window.innerWidth
    if (window.innerWidth > window.innerHeight) {
      if (windowWidth >= 1200) {
        cardsPerPage = 12
      } else if (windowWidth >= 992) {
        cardsPerPage = 8
      } else if (windowWidth >= 768) {
        cardsPerPage = 6
      } else if (windowWidth >= 576) {
        cardsPerPage = 4
      } else {
        cardsPerPage = 2
      }
    } else {
      if (windowWidth >= 1000) {
        cardsPerPage = 16
      } else if (windowWidth >= 992) {
        cardsPerPage = 8
      } else if (windowWidth >= 768) {
        cardsPerPage = 9
      } else if (windowWidth >= 576) {
        cardsPerPage = 6
      } else {
        cardsPerPage = 3
      }
    }
  }

  populateResultsRow()
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
    $('#imageLightboxImage, #imageLightboxTitle, #imageLightboxCredit').fadeIn()
    if (caption === '') {
      $('#imageLightboxImage').addClass('imageLightboxImageTall').removeClass('imageLightboxImageShort')
      $('#imageLightboxCaption').hide()
    } else {
      $('#imageLightboxImage').removeClass('imageLightboxImageTall').addClass('imageLightboxImageShort')
      $('#imageLightboxCaption').fadeIn()
    }
  }).attr('src', 'content/' + image)

  $('#imageLightbox').css('display', 'flex').animate({ opacity: 1, queue: false }, 100)
}

const Keyboard = window.SimpleKeyboard.default

// Add a listener to each input so we direct keyboard input to the right one
document.querySelectorAll('.input').forEach(input => {
  input.addEventListener('focus', onInputFocus)
})
function onInputFocus (event) {
  keyboard.setOptions({
    inputName: event.target.id
  })
}
function onInputChange (event) {
  keyboard.setInput(event.target.value, event.target.id)
}
function onKeyPress (button) {
  if (button === '{lock}' || button === '{shift}') handleShiftButton()
  currentPage = 0
  populateResultsRow(button)
}
document.querySelector('.input').addEventListener('input', event => {
  keyboard.setInput(event.target.value)
})
function onChange (input) {
  document.querySelector('#searchInput').value = input
}

const keyboard = new Keyboard({
  onChange: input => onChange(input),
  onKeyPress: button => onKeyPress(button),
  layout: {
    default: [
      'Q W E R T Y U I O P',
      'A S D F G H J K L',
      'Z X C V B N M {bksp}',
      '{space}'
    ]
  }
})

let spreadsheet, mediaKey, thumbnailKey, searchKeys, titleKey, captionKey, creditKey, filterKeys
const currentContent = []
let currentPage = 0
let cardsPerPage
let customCardsPerPage = false
let defaultLang

// Constellation stuff
constCommon.config.helperAddress = window.location.origin
constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.constellationAppID = 'media_browser'
constCommon.config.debug = true
let currentDefintion = ''

let inactivityTimer = null
let attractorAvailable = false

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
  // Hide the cursor
  document.body.style.cursor = 'none'
}

window.addEventListener('resize', setCardCount)
document.getElementById('clearButton').addEventListener('click', clear)

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
