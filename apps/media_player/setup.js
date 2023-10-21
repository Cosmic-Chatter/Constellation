/* global bootstrap, Coloris */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'
import * as constSetup from '../js/constellation_setup_common.js'

function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
  // Get a new temporary uuid
    constCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/uuid/new'
    })
      .then((response) => {
        $('#definitionSaveButton').data('initialDefinition', {
          uuid: response.uuid,
          content: {},
          content_order: [],
          style: {
            background: {
              mode: 'color',
              color: '#000'
            }
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          content: {},
          content_order: [],
          style: {
            background: {
              mode: 'color',
              color: '#000'
            }
          }
        })
        previewDefinition()
      })
  }

  // Definition details
  $('#definitionNameInput').val('')

  constSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#000',
    gradient_color_1: '#000',
    gradient_color_2: '#000'
  })

  document.getElementById('itemList').innerHTML = ''
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = constSetup.getDefinitionByUUID(uuid)

  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)
  rebuildItemList()

  if ('style' in def === false) {
    def.style = {
      background: {
        mode: 'color',
        color: '#000'
      }
    }
    constSetup.updateWorkingDefinition(['style', 'background', 'mode'], 'color')
    constSetup.updateWorkingDefinition(['style', 'background', 'color'], '#000')
  }

  // Set the appropriate values for any advanced color pickers
  if ('background' in def.style) {
    constSetup.updateAdvancedColorPicker('style>background', def.style.background)
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_player.html?standalone=true&definition=' + def.uuid
}

function previewDefinition (automatic = false) {
  // Save the definition to a temporary file and load it into the preview frame.
  // If automatic == true, we've called this function beceause a definition field
  // has been updated. Only preview if the 'Refresh on change' checkbox is checked

  if ((automatic === true) && $('#refreshOnChangeCheckbox').prop('checked') === false) {
    return
  }

  const def = $('#definitionSaveButton').data('workingDefinition')
  // Set the uuid to a temp one
  def.uuid = '__previewMediaPlayer'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../media_player.html?standalone=true&definition=__previewMediaPlayer'
      }
    })
}

function saveDefintion () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'media_player'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        console.log('Saved!')
        // Create a thumbnail
        createThumbnail()

        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('media_player')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

function createThumbnail () {
  // Ask the helper to createa video thumbnail based on the thumbnails of all the selected media.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')
  const files = []
  workingDefinition.content_order.forEach((uuid) => {
    files.push(workingDefinition.content[uuid].filename)
  })

  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/thumbnailVideoFromFrames',
    params: {
      filename: workingDefinition.uuid,
      frames: files
    }
  })
}

function addItem () {
  // Add an item to the working defintiion

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const item = {
    uuid: String(Math.random() * 1e20),
    filename: '',
    duration: 30
  }
  workingDefinition.content[item.uuid] = item
  workingDefinition.content_order.push(item.uuid)

  createItemHTML(item, workingDefinition.content_order.length)
  console.log($('#definitionSaveButton').data('workingDefinition'))
}

function createItemHTML (item, num) {
  // Add a blank item to the itemList

  const itemCol = document.createElement('div')
  itemCol.classList = 'col-12 col-md-6 mt-2 content-item'

  const card = document.createElement('div')
  card.classList = 'card'
  itemCol.appendChild(card)

  const cardBody = document.createElement('div')
  cardBody.classList = 'card-body row'
  card.appendChild(cardBody)

  const numberCol = document.createElement('div')
  numberCol.classList = 'col-12'
  cardBody.appendChild(numberCol)

  const number = document.createElement('div')
  number.classList = 'text-center w-100 fw-bold'
  number.innerHTML = num
  numberCol.appendChild(number)

  const selectButtonCol = document.createElement('div')
  selectButtonCol.classList = 'col-12 mt-2'
  cardBody.appendChild(selectButtonCol)

  const selectButton = document.createElement('button')
  selectButton.classList = 'btn btn-primary w-100 text-break select-button'
  selectButton.innerHTML = 'Select file'
  selectButton.addEventListener('click', (event) => {
    constFileSelect.createFileSelectionModal({
      filetypes: ['audio', 'image', 'video'],
      multiple: false
    })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        setItemContent(item, cardBody, file)
      })
  })
  selectButtonCol.appendChild(selectButton)

  const orderButtonsCol = document.createElement('div')
  orderButtonsCol.classList = 'col-12 mt-2'
  cardBody.appendChild(orderButtonsCol)

  const orderButtonsRow = document.createElement('div')
  orderButtonsRow.classList = 'row'
  orderButtonsCol.appendChild(orderButtonsRow)

  const orderButtonLeftCol = document.createElement('div')
  orderButtonLeftCol.classList = 'col-6'
  orderButtonsRow.appendChild(orderButtonLeftCol)

  const orderButtonLeft = document.createElement('button')
  orderButtonLeft.classList = 'btn btn-info btn-sm w-100'
  orderButtonLeft.innerHTML = '◀'
  orderButtonLeft.addEventListener('click', (event) => {
    changeItemOrder(item.uuid, -1)
  })
  orderButtonLeftCol.appendChild(orderButtonLeft)

  const orderButtonRightCol = document.createElement('div')
  orderButtonRightCol.classList = 'col-6'
  orderButtonsRow.appendChild(orderButtonRightCol)

  const orderButtonRight = document.createElement('button')
  orderButtonRight.classList = 'btn btn-info btn-sm w-100'
  orderButtonRight.innerHTML = '▶'
  orderButtonRight.addEventListener('click', (event) => {
    changeItemOrder(item.uuid, 1)
  })
  orderButtonRightCol.appendChild(orderButtonRight)

  const durationCol = document.createElement('div')
  durationCol.classList = 'col-12 mt-2 duration-col'
  cardBody.appendChild(durationCol)

  const durationLabel = document.createElement('label')
  durationLabel.classList = 'form-label'
  durationLabel.innerHTML = `
  Duration
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="The number of seconds the image should be displayed." style="font-size: 0.55em;">?</span>
  `
  durationCol.appendChild(durationLabel)

  const durationInput = document.createElement('input')
  durationInput.classList = 'form-control'
  durationInput.setAttribute('placeholder', 30)
  durationInput.setAttribute('type', 'number')
  durationInput.value = item.duration
  durationInput.addEventListener('input', (event) => {
    const inputStr = event.target.value
    let durationVal
    if (inputStr.trim() === '') {
      durationVal = 30
    } else {
      durationVal = parseFloat(inputStr)
    }
    constSetup.updateWorkingDefinition(['content', item.uuid, 'duration'], durationVal)
  })
  durationCol.appendChild(durationInput)
  if (constCommon.guessMimetype(item.filename) === 'image') {
    durationCol.style.display = 'block'
  } else {
    durationCol.style.display = 'none'
  }

  const previewCol = document.createElement('div')
  previewCol.classList = 'col-12 pt-2'
  previewCol.style.maxHeight = '200px'
  previewCol.style.width = '100%'
  cardBody.appendChild(previewCol)

  const image = document.createElement('img')
  image.classList = 'image-preview py-1'
  image.style.maxHeight = '200px'
  image.style.width = '100%'
  image.style.objectFit = 'contain'
  image.style.display = 'none'
  previewCol.appendChild(image)

  const video = document.createElement('video')
  video.classList = 'video-preview py-1'
  video.style.maxHeight = '200px'
  video.style.width = '100%'
  video.style.display = 'none'
  video.style.objectFit = 'contain'
  video.setAttribute('autoplay', true)
  video.muted = 'true'
  video.setAttribute('loop', 'true')
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('disablePictureInPicture', 'true')
  previewCol.appendChild(video)

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-12'
  cardBody.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100 mt-2'
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', (event) => {
    deleteitem(item.uuid)
  })
  deleteCol.appendChild(deleteButton)

  if (item.filename !== '') setItemContent(item, itemCol, item.filename)

  document.getElementById('itemList').appendChild(itemCol)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function setItemContent (item, itemEl, file) {
  // Populate the given element, item, with content.

  constSetup.updateWorkingDefinition(['content', item.uuid, 'filename'], file)
  previewDefinition(true)

  const image = itemEl.querySelector('.image-preview')
  const video = itemEl.querySelector('.video-preview')
  const selectButton = itemEl.querySelector('.select-button')

  itemEl.setAttribute('data-filename', file)
  const mimetype = constCommon.guessMimetype(file)
  selectButton.innerHTML = file
  if (mimetype === 'audio') {
    image.src = constFileSelect.getDefaultAudioIcon()
    image.style.display = 'block'
    video.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
  } else if (mimetype === 'image') {
    image.src = '/thumbnails/' + constCommon.withExtension(file, 'jpg')
    image.style.display = 'block'
    video.style.display = 'none'
    // Show the duration input
    itemEl.querySelector('.duration-col').style.display = 'block'
  } else if (mimetype === 'video') {
    video.src = '/thumbnails/' + constCommon.withExtension(file, 'mp4')
    video.style.display = 'block'
    image.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
  }
}

function deleteitem (uuid) {
  // Remove this item from the working defintion and destroy its GUI representation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  delete workingDefinition.content[uuid]
  workingDefinition.content_order = workingDefinition.content_order.filter(item => item !== uuid)
  rebuildItemList()
  console.log(workingDefinition)
}

function changeItemOrder (uuid, dir) {
  // Move the location of the given item.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const uuidIndex = workingDefinition.content_order.indexOf(uuid)
  if (dir === -1 && uuidIndex === 0) return
  if (dir === 1 && uuidIndex === workingDefinition.content_order.length - 1) return

  // Save the other value to swap them
  const otherUuid = workingDefinition.content_order[uuidIndex + dir]
  workingDefinition.content_order[uuidIndex + dir] = uuid
  workingDefinition.content_order[uuidIndex] = otherUuid
  rebuildItemList()
}

function rebuildItemList () {
  // Use the definition to rebuild the GUI representations of each item

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  // Clear any existing items
  document.getElementById('itemList').innerHTML = ''

  let num = 1
  workingDefinition.content_order.forEach((uuid) => {
    const item = workingDefinition.content[uuid]
    createItemHTML(item, num)
    num += 1
  })
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

// Set up the color pickers
function setUpColorPickers () {
  Coloris({
    el: '.coloris',
    theme: 'pill',
    themeMode: 'dark',
    formatToggle: false,
    clearButton: false,
    swatches: [
      '#000',
      '#22222E',
      '#393A5A',
      '#719abf',
      '#fff'
    ]
  })
}
// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

// Add event listeners
// -------------------------------------------------------------

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})

document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ manage: true, filetypes: ['audio', 'image', 'video'] })
})

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

clearDefinitionInput()

constSetup.configure({
  app: 'media_player',
  clearDefinition: clearDefinitionInput,
  loadDefinition: editDefinition
})
