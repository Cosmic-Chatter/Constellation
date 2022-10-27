import * as constCommon from '../js/constellation_app_common.js'

function changePage (val) {
  switch (val) {
    case 0:
      currentPage = 0
      break
    case 1:
      currentPage += 1
      if (currentPage * cardsPerPage > data.length) {
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
    thumb = 'thumbs/' + String(obj[thumbnailKey])
  } else {
    thumb = 'thumbs/' + String(obj[mediaKey])
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

  const html = `
    <div class='cardCol col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2 align-items-center justify-content-top d-flex'>
      <div class="resultCard row my-2 w-100" onclick="displayMedia('${id}')">
        <center>
          <img class='resultImg' src="${thumb}" id=Entry_${id}>
          <p class='cardTitle ${titleClass}'>${title}</p>
        </center>
      </div>
    </div>
  `

  $('#resultsRow').append(html)
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

function populateFilterOptions () {
  // Read the filterKeys and create a dropdown for each

  if (filterKeys == null) {
    return
  }
  $('#filterOptionsRow').empty()

  filterKeys.forEach((key, i) => {
    const newCol = document.createElement('div')
    newCol.className = 'col-12 col-xl-6'
    $('#filterOptionsRow').append(newCol)

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
  data.forEach((item, i) => {
    let matchCount = 0
    searchTerms.forEach((term, i) => {
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
  // console.log("populateResultsRow runetime:", performance.now()-startTime)
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

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    console.log(`Received content update: ${update.content}`)
  }
}

function showAttractor () {
  // Make the attractor layer visible

  document.getElementById('attractorVideo').play()
    .then(result => {
      $('#attractorOverlay').show()
      hideImageLightBox()
      clear()
      constCommon.config.currentInteraction = false
    })
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

  const windowWidth = window.innerWidth
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
  }).attr('src', 'media/' + image)

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

// THIS USED TO BE PROVIDED BY data.js
const data = [{}]
const mediaKey = 'Media'
const thumbnailKey = null
const searchKeys = ['Last Name', 'First']
const titleKey = 'Entry Title'
const captionKey = null
const creditKey = 'credit'
const filterKeys = ['Grade Level']

// Create a new property, searchData, for each data element that includes
// everything we can search against as a string.

data.forEach((item, i) => {
  item.searchData = ''
  searchKeys.forEach((key, j) => {
    item.searchData += String(item[key]) + ' '
  })
})

constCommon.config.helperAddress = window.location.origin
constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.softwareVersion = 2.0
constCommon.config.softwareUpdateLocation = 'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/apps/media_browser/version.txt'
constCommon.config.constellationAppID = 'media_browser'
constCommon.config.debug = true

let inactivityTimer = null

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()
setInterval(constCommon.sendPing, 5000)

let currentPage = 0
let cardsPerPage
setCardCount()
window.addEventListener('resize', setCardCount)
document.getElementById('clearButton').addEventListener('click', clear)
populateFilterOptions()

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
