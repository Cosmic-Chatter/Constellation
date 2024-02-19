/* global bootstrap, Coloris */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'
import * as constSetup from '../js/constellation_setup_common.js'

function initializeDefinition () {
  // Create a blank definition at save it to workingDefinition.

  return new Promise(function (resolve, reject) {
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
          },
          watermark: {}
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
          },
          watermark: {}
        })
        constSetup.previewDefinition(false)
        resolve()
      })
  })
}

async function clearDefinitionInput (full = true) {
  // Clear all input related to a defnition

  if (full === true) {
    await initializeDefinition()
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
  const watermarkSelect = document.getElementById('watermarkSelect')
  watermarkSelect.innerHTML = 'Select file'
  watermarkSelect.setAttribute('data-filename', '')
  document.getElementById('watermarkXPos').value = '80'
  document.getElementById('watermarkYPos').value = '80'
  document.getElementById('watermarkSize').value = '10'
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

  // Set the appropriate values for the watermark
  if ('watermark' in def && 'file' in def.watermark && def.watermark.file !== '') {
    const watermarkSelect = document.getElementById('watermarkSelect')
    watermarkSelect.innerHTML = def.watermark.file
    watermarkSelect.setAttribute('data-filename', def.watermark.file)
  }
  if ('watermark' in def && 'x_position' in def.watermark) {
    document.getElementById('watermarkXPos').value = def.watermark.x_position
  }
  if ('watermark' in def && 'y_position' in def.watermark) {
    document.getElementById('watermarkYPos').value = def.watermark.y_position
  }
  if ('watermark' in def && 'size' in def.watermark) {
    document.getElementById('watermarkSize').value = def.watermark.size
  }

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../media_player.html?standalone=true&definition=' + def.uuid
}

function saveDefinition () {
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
  itemCol.classList = 'col-12 content-item'

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
  number.classList = 'text-center w-100 fw-bold h6 mb-3'
  number.innerHTML = num
  numberCol.appendChild(number)

  const modifyPane = document.createElement('div')
  modifyPane.classList = 'col-12 col-md-6'
  cardBody.appendChild(modifyPane)

  const modifyRow = document.createElement('div')
  modifyRow.classList = 'row gy-2'
  modifyPane.appendChild(modifyRow)

  const selectButtonCol = document.createElement('div')
  selectButtonCol.classList = 'col-12 mt-2'
  modifyRow.appendChild(selectButtonCol)

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
  modifyRow.appendChild(orderButtonsCol)

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
  modifyRow.appendChild(durationCol)

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

  const annotateCol = document.createElement('div')
  annotateCol.classList = 'col-12'
  modifyRow.appendChild(annotateCol)

  const annotateButton = document.createElement('button')
  annotateButton.classList = 'btn btn-primary w-100'
  annotateButton.innerHTML = 'Add annotation'
  annotateButton.addEventListener('click', () => {
    showAnnotateFromJSONModal(item.uuid)
  })
  annotateCol.appendChild(annotateButton)

  const previewCol = document.createElement('div')
  previewCol.classList = 'col-12 col-md-6'
  previewCol.style.maxHeight = '200px'
  cardBody.appendChild(previewCol)

  const image = document.createElement('img')
  image.classList = 'image-preview'
  image.style.maxHeight = '200px'
  image.style.width = '100%'
  image.style.objectFit = 'contain'
  image.style.display = 'none'
  previewCol.appendChild(image)

  const video = document.createElement('video')
  video.classList = 'video-preview'
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
  modifyRow.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm w-100 mt-2'
  deleteButton.innerHTML = 'Delete'
  deleteButton.addEventListener('click', (event) => {
    deleteitem(item.uuid)
  })
  previewCol.appendChild(deleteButton)

  const annotationsPane = document.createElement('div')
  annotationsPane.classList = 'col-12'
  cardBody.appendChild(annotationsPane)

  const annotationsRow = document.createElement('div')
  annotationsRow.classList = 'row gy-2'
  annotationsRow.setAttribute('id', 'annotationRow_' + item.uuid)
  annotationsPane.appendChild(annotationsRow)

  if (item.filename !== '') setItemContent(item, itemCol, item.filename)

  document.getElementById('itemList').appendChild(itemCol)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function showAnnotateFromJSONModal (uuid) {
  // Prepare and show the modal for creating an annotation from JSON.

  document.getElementById('annotateFromJSONModalPath').setAttribute('data-uuid', uuid)
  $('#annotateFromJSONModal').modal('show')
}

function populateAnnotateFromJSONModal (file, type = 'file') {
  // Retrieve the given JSON file and parse it into a tree.
  // 'type' should be one of [file | url]

  constCommon.makeServerRequest({
    method: 'GET',
    endpoint: '/content/' + file,
    noCache: true
  })
    .then((text) => {
      // Store the file for later use.
      const el = document.getElementById('annotateFromJSONModalPath')
      el.setAttribute('data-file', file)
      el.setAttribute('data-type', type)

      const parent = document.getElementById('annotateFromJSONModalTreeView')
      createTreeSubEntries(parent, text)
    })
}

function createTreeSubEntries (parent, dict, path = []) {
  // Take the keys of the given dict and turn them into <li> elements,
  // creating sub-trees with recursive calls.
  // 'path' gives the hierarchy of keys to reach 'dict'

  for (const key of Object.keys(dict)) {
    const li = document.createElement('li')
    if (typeof dict[key] === 'object') {
      // A nested dict
      const name = document.createElement('span')
      name.classList = 'caret'
      name.innerHTML = key
      li.appendChild(name)
      const ul = document.createElement('ul')
      ul.classList = 'nested'
      name.addEventListener('click', function () {
        ul.classList.toggle('active')
        this.classList.toggle('caret-down')
      })
      li.appendChild(ul)
      createTreeSubEntries(ul, dict[key], [...path, key])
    } else {
      const span = document.createElement('span')
      span.innerHTML = `<u>${key}</u>: ${dict[key]}`
      span.style.cursor = 'pointer'
      span.addEventListener('click', () => {
        selectAnnotationJSONPath([...path, key])
      })
      li.appendChild(span)
    }
    parent.appendChild(li)
  }
}

function selectAnnotationJSONPath (path) {
  // Called when a field is clicked in the JSON tree view

  const el = document.getElementById('annotateFromJSONModalPath')
  el.value = path.join(' > ')
  el.setAttribute('data-path', JSON.stringify(path))
}

function addAnnotationFromModal () {
  // Collect the needed information and add the annotation.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const el = document.getElementById('annotateFromJSONModalPath')
  const itemUUID = el.getAttribute('data-uuid')
  const path = JSON.parse(el.getAttribute('data-path'))
  const file = el.getAttribute('data-file')
  const type = el.getAttribute('data-type')
  const annotationUUID = constCommon.uuid()

  const annotation = {
    uuid: annotationUUID,
    path,
    file,
    type
  }
  let annotations
  if ('annotations' in workingDefinition.content[itemUUID]) {
    annotations = [...workingDefinition.content[itemUUID].annotations, annotation]
  } else {
    annotations = [annotation]
  }
  constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  constSetup.previewDefinition(true)
}

function setItemContent (item, itemEl, file) {
  // Populate the given element, item, with content.

  constSetup.updateWorkingDefinition(['content', item.uuid, 'filename'], file)
  constSetup.previewDefinition(true)

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

function onWatermarkFileChange () {
  // Called when a new image is selected.

  const file = document.getElementById('watermarkSelect').getAttribute('data-filename')
  constSetup.updateWorkingDefinition(['watermark', 'file'], file)

  constSetup.previewDefinition(true)
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

document.getElementById('manageContentButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ manage: true, filetypes: ['audio', 'image', 'video'] })
})

// Content
document.getElementById('addItemButton').addEventListener('click', (event) => {
  addItem()
})

// Annotations
document.getElementById('annotateFromJSONModalFileSelect').addEventListener('click', () => {
  constFileSelect.createFileSelectionModal({ filetypes: ['json'] })
    .then((result) => {
      if (result.length === 1) {
        populateAnnotateFromJSONModal(result)
      }
    })
})
document.getElementById('annotateFromJSONModalSubmitButton').addEventListener('click', addAnnotationFromModal)

// Watermark
document.getElementById('watermarkSelect').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ filetypes: ['image'], multiple: false })
    .then((files) => {
      if (files.length === 1) {
        event.target.innerHTML = files[0]
        event.target.setAttribute('data-filename', files[0])
        onWatermarkFileChange()
      }
    })
})
document.getElementById('watermarkSelectClear').addEventListener('click', (event) => {
  const attractorSelect = document.getElementById('watermarkSelect')
  attractorSelect.innerHTML = 'Select file'
  attractorSelect.setAttribute('data-filename', '')
  onWatermarkFileChange()
})
Array.from(document.querySelectorAll('.watermark-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const field = event.target.getAttribute('data-field')
    constSetup.updateWorkingDefinition(['watermark', field], event.target.value)
    constSetup.previewDefinition(true)
  })
})

// Set helper address for use with constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

clearDefinitionInput()

constSetup.configure({
  app: 'media_player',
  clearDefinition: clearDefinitionInput,
  initializeDefinition,
  loadDefinition: editDefinition,
  saveDefinition
})
