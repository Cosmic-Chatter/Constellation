/* global bootstrap */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'

function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  $('#availableDefinitionSelect').empty()
  availableDefinitions = definitions
  const keys = Object.keys(definitions).sort()

  keys.forEach((uuid) => {
    if ((uuid.slice(0, 9) === '__preview') || uuid.trim() === '') return
    const definition = definitions[uuid]
    const option = document.createElement('option')
    option.value = uuid
    option.innerHTML = definition.name

    $('#availableDefinitionSelect').append(option)
  })
}

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
          content_order: []
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          content: {},
          content_order: []
        })
      })
  }

  // Definition details
  $('#definitionNameInput').val('')
}

function createNewDefinition () {
  // Set up for a new definition

  clearDefinitionInput()
}

function deleteDefinition () {
  // Delete the definition currently listed in the select.

  const definition = $('#availableDefinitionSelect').val()

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + definition + '/delete'
  })
    .then(() => {
      constCommon.getAvailableDefinitions('media_player')
        .then((response) => {
          if ('success' in response && response.success === true) {
            populateAvailableDefinitions(response.definitions)
          }
        })
    })
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = getDefinitionByUUID(uuid)
  console.log(def)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_player.html?standalone=true&definition=' + def.uuid
}

function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  constCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
  console.log($('#definitionSaveButton').data('workingDefinition'))
}

function getDefinitionByUUID (uuid = '') {
  // Return the definition with this UUID

  if (uuid === '') {
    uuid = $('#availableDefinitionSelect').val()
  }
  let matchedDef = null
  Object.keys(availableDefinitions).forEach((key) => {
    const def = availableDefinitions[key]
    if (def.uuid === uuid) {
      matchedDef = def
    }
  })
  return matchedDef
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
  def.uuid = '__previewMediaBrowser'
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../media_player.html?standalone=true&definition=__previewMediaBrowser'
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
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('media_player')
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
            }
          })
      }
    })
}

function resizePreview () {
  const paneWidth = $('#previewPane').width()
  const frameWidth = $('#previewFrame').width()
  const transformRatio = paneWidth / frameWidth

  $('#previewFrame').css('transform', 'scale(' + transformRatio + ')')
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
  itemCol.classList = 'col-12 col-md-6 row mt-2 content-item'

  const numberCol = document.createElement('div')
  numberCol.classList = 'col-3 pe-0'
  itemCol.appendChild(numberCol)

  const number = document.createElement('div')
  number.classList = 'text-center bg-secondary w-100 h-100 pt-2 fw-bold'
  number.innerHTML = num
  numberCol.appendChild(number)

  const selectButtonCol = document.createElement('div')
  selectButtonCol.classList = 'col-9 ps-0'
  itemCol.appendChild(selectButtonCol)

  const selectButton = document.createElement('button')
  selectButton.classList = 'btn btn-info w-100 text-break select-button rounded-0'
  selectButton.innerHTML = 'Select file'
  selectButton.addEventListener('click', (event) => {
    constFileSelect.createFileSelectionModal({
      filetypes: ['audio', 'image', 'video'],
      multiple: false
    })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        setItemContent(item, itemCol, file)
      })
  })
  selectButtonCol.appendChild(selectButton)

  const orderButtonsCol = document.createElement('div')
  orderButtonsCol.classList = 'col-12'
  itemCol.appendChild(orderButtonsCol)

  const orderButtonsRow = document.createElement('div')
  orderButtonsRow.classList = 'row'
  orderButtonsCol.appendChild(orderButtonsRow)

  const orderButtonLeftCol = document.createElement('div')
  orderButtonLeftCol.classList = 'col-6 pe-0'
  orderButtonsRow.appendChild(orderButtonLeftCol)

  const orderButtonLeft = document.createElement('button')
  orderButtonLeft.classList = 'btn btn-secondary btn-sm w-100 rounded-0 border-bottom border-end'
  orderButtonLeft.innerHTML = '◀'
  orderButtonLeftCol.appendChild(orderButtonLeft)

  const orderButtonRightCol = document.createElement('div')
  orderButtonRightCol.classList = 'col-6  ps-0'
  orderButtonsRow.appendChild(orderButtonRightCol)

  const orderButtonRight = document.createElement('button')
  orderButtonRight.classList = 'btn btn-secondary btn-sm w-100 rounded-0 border-bottom'
  orderButtonRight.innerHTML = '▶'
  orderButtonRightCol.appendChild(orderButtonRight)

  const previewCol = document.createElement('div')
  previewCol.classList = 'col-12'
  previewCol.style.maxHeight = '200px'
  previewCol.style.width = '100%'
  itemCol.appendChild(previewCol)

  const image = document.createElement('img')
  image.classList = 'image-preview bg-secondary py-1'
  image.style.maxHeight = '200px'
  image.style.width = '100%'
  image.style.objectFit = 'contain'
  image.style.display = 'none'
  previewCol.appendChild(image)

  const video = document.createElement('video')
  video.classList = 'video-preview bg-secondary py-1'
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
  itemCol.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100 rounded-0'
  deleteButton.innerHTML = 'Delete'
  deleteCol.appendChild(deleteButton)

  if (item.filename !== '') setItemContent(item, itemCol, item.filename)

  document.getElementById('itemList').appendChild(itemCol)
}

function setItemContent (item, itemEl, file) {
  // Populate the given element, item, with content.

  updateWorkingDefinition(['content', item.uuid, 'filename'], file)
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
  } else if (mimetype === 'image') {
    image.src = '/thumbnails/' + constCommon.withExtension(file, 'jpg')
    image.style.display = 'block'
    video.style.display = 'none'
  } else if (mimetype === 'video') {
    video.src = '/thumbnails/' + constCommon.withExtension(file, 'mp4')
    video.style.display = 'block'
    image.style.display = 'none'
  }
}

function rotatePreview () {
  // Toggle the preview between landscape and portrait orientations.

  document.getElementById('previewFrame').classList.toggle('preview-landscape')
  document.getElementById('previewFrame').classList.toggle('preview-portrait')
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

// All the available definitions
let availableDefinitions = {}

constCommon.getAvailableDefinitions('media_player')
  .then((response) => {
    if ('success' in response && response.success === true) {
      populateAvailableDefinitions(response.definitions)
    }
  })

// Activate tooltips
const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
tooltipTriggerList.map(function (tooltipTriggerEl) {
  return new bootstrap.Tooltip(tooltipTriggerEl)
})

// Add event listeners
// -------------------------------------------------------------

// Main buttons
$('#newDefinitionButton').click(createNewDefinition)
$('#editDefinitionButton').click(() => {
  editDefinition()
})
$('#definitionSaveButton').click(saveDefintion)
$('#previewRefreshButton').click(() => {
  previewDefinition()
})
document.getElementById('previewRotateButton').addEventListener('click', () => {
  rotatePreview()
})

document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ manage: true, filetypes: ['audio', 'image', 'video'] })
})

// Definition delete popover button
const deleteDefinitionButton = document.getElementById('deleteDefinitionButton')
deleteDefinitionButton.setAttribute('data-bs-toggle', 'popover')
deleteDefinitionButton.setAttribute('title', 'Are you sure?')
deleteDefinitionButton.setAttribute('data-bs-content', '<a id="DefinitionDeletePopover" class="btn btn-danger w-100">Confirm</a>')
deleteDefinitionButton.setAttribute('data-bs-trigger', 'focus')
deleteDefinitionButton.setAttribute('data-bs-html', 'true')
$(document).on('click', '#DefinitionDeletePopover', function () {
  deleteDefinition()
})
deleteDefinitionButton.addEventListener('click', function () { deleteDefinitionButton.focus() })
const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
popoverTriggerList.map(function (popoverTriggerEl) {
  return new bootstrap.Popover(popoverTriggerEl)
})

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})

// Preview frame
window.addEventListener('load', resizePreview)
window.addEventListener('resize', resizePreview)

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

clearDefinitionInput()
