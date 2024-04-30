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
  itemCol.setAttribute('id', 'Item_' + item.uuid)

  const card = document.createElement('div')
  card.classList = 'card'
  itemCol.appendChild(card)

  const cardBody = document.createElement('div')
  cardBody.classList = 'card-body row'
  card.appendChild(cardBody)

  const numberCol = document.createElement('div')
  numberCol.classList = 'col-1'
  cardBody.appendChild(numberCol)

  const number = document.createElement('div')
  number.classList = 'w-100 fw-bold h4 mb-3'
  number.innerHTML = num
  numberCol.appendChild(number)

  const nameCol = document.createElement('div')
  nameCol.classList = 'col-11'
  cardBody.appendChild(nameCol)

  const name = document.createElement('div')
  name.classList = 'w-100 mb-3 file-field'
  name.innerHTML = item.filename
  nameCol.appendChild(name)

  const modifyPane = document.createElement('div')
  modifyPane.classList = 'col-12 col-md-6'
  cardBody.appendChild(modifyPane)

  const modifyRow = document.createElement('div')
  modifyRow.classList = 'row gy-2'
  modifyPane.appendChild(modifyRow)

  const selectButtonCol = document.createElement('div')
  selectButtonCol.classList = 'col-12 mt-2'
  modifyRow.appendChild(selectButtonCol)

  const selectDropdown = document.createElement('div')
  selectDropdown.classList = 'dropdown w-100'
  selectButtonCol.appendChild(selectDropdown)

  const selectButton = document.createElement('button')
  selectButton.classList = 'btn btn-primary dropdown-toggle w-100'
  selectButton.setAttribute('type', 'button')
  selectButton.setAttribute('data-bs-toggle', 'dropdown')
  selectButton.setAttribute('aria-expanded', false)
  selectButton.innerHTML = 'Select media'
  selectDropdown.appendChild(selectButton)

  const selectMenu = document.createElement('ul')
  selectMenu.classList = 'dropdown-menu'
  selectDropdown.appendChild(selectMenu)

  const li1 = document.createElement('li')
  const li2 = document.createElement('li')
  selectMenu.appendChild(li1)
  selectMenu.appendChild(li2)

  const selectFile = document.createElement('a')
  selectFile.classList = 'dropdown-item'
  selectFile.innerHTML = 'From file'
  selectFile.style.cursor = 'pointer'
  selectFile.addEventListener('click', () => {
    constFileSelect.createFileSelectionModal({
      filetypes: ['audio', 'image', 'video'],
      multiple: false
    })
      .then((result) => {
        const file = result[0]
        if (file == null) return
        setItemContent(item.uuid, cardBody, file)
      })
  })
  li1.appendChild(selectFile)

  const selectURL = document.createElement('a')
  selectURL.classList = 'dropdown-item'
  selectURL.innerHTML = 'From URL'
  selectURL.style.cursor = 'pointer'
  selectURL.addEventListener('click', () => {
    showChooseURLModal(item.uuid)
  })
  li1.appendChild(selectURL)

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

  const cacheCol = document.createElement('div')
  cacheCol.classList = 'col-12 mt-2 cache-col'
  modifyRow.appendChild(cacheCol)

  const cacheGroup = document.createElement('div')
  cacheGroup.classList = 'form-check'
  cacheCol.appendChild(cacheGroup)

  const cacheCheck = document.createElement('input')
  cacheCheck.classList = 'form-check-input'
  cacheCheck.setAttribute('type', 'checkbox')
  if ('no_cache' in item && item.no_cache === true) cacheCheck.checked = true
  cacheCheck.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', item.uuid, 'no_cache'], cacheCheck.checked)
    constSetup.previewDefinition(true)
  })
  cacheGroup.appendChild(cacheCheck)

  const cacheLabel = document.createElement('label')
  cacheLabel.classList = 'form-check-label'
  cacheLabel.innerHTML = `
  Disable cache
  <span class="badge bg-info ml-1 align-middle text-dark" data-bs-toggle="tooltip" data-bs-placement="top" title="Choose this option only if the media will change. Please respect usage limits for linked media." style="font-size: 0.55em;">?</span>
  `
  cacheGroup.appendChild(cacheLabel)

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
  deleteButton.classList = 'btn btn-danger btn-sm w-100 my-2'
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

  if (item.filename !== '') setItemContent(item.uuid, itemCol, item.filename, item.type)

  document.getElementById('itemList').appendChild(itemCol)

  // Annotations
  if ('annotations' in item) {
    for (const key of Object.keys(item.annotations)) {
      createAnnoationHTML(item.uuid, item.annotations[key])
    }
  }

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function showAnnotateFromJSONModal (itemUUID, annotationUUID = null) {
  // Prepare and show the modal for creating an annotation from JSON.

  const workingDefinition = $('#definitionSaveButton').data('workingDefinition')

  const urlInput = document.getElementById('annotateFromJSONModalURLInput')
  const path = document.getElementById('annotateFromJSONModalPath')
  const title = document.getElementById('annotateFromJSONModalTitle')
  const button = document.getElementById('annotateFromJSONModalSubmitButton')
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
  path.setAttribute('data-itemUUID', itemUUID)

  if (annotationUUID != null) {
    // We are editing rather than creating new

    const details = workingDefinition.content[itemUUID].annotations[annotationUUID]
    title.innerHTML = 'Update a JSON annotation'
    button.innerHTML = 'Update'
    path.value = details.path.join(' > ')
    if (details.type === 'url') {
      urlInput.value = details.file
    }

    path.setAttribute('data-annotationUUID', annotationUUID)
    populateAnnotateFromJSONModal(details.file, details.type)
  } else {
    // We are creating a new annotation
    title.innerHTML = 'Create an annotation from JSON'
    button.innerHTML = 'Create'
    urlInput.value = ''
    path.value = ''
    path.setAttribute('data-annotationUUID', '')
  }

  $('#annotateFromJSONModal').modal('show')
}

function populateAnnotateFromJSONModal (file, type = 'file') {
  // Retrieve the given JSON file and parse it into a tree.
  // 'type' should be one of [file | url]

  // Store the file for later use.
  const el = document.getElementById('annotateFromJSONModalPath')
  el.setAttribute('data-file', file)
  el.setAttribute('data-type', type)

  const parent = document.getElementById('annotateFromJSONModalTreeView')
  parent.innerHTML = ''

  if (type === 'file') {
    constCommon.makeServerRequest({
      method: 'GET',
      endpoint: '/content/' + file,
      noCache: true
    })
      .then((text) => {
        createTreeSubEntries(parent, text)
      })
  } else if (type === 'url') {
    $.getJSON(file, function (text) {
      createTreeSubEntries(parent, text)
    })
      .fail((error) => {
        console.log(error)
        if (error.statusText === 'Not Found') {
          parent.innerHTML = 'The entered URL is unreachable.'
        } else if (error.statusText === 'parsererror') {
          parent.innerHTML = 'The entered URL does not return valid JSON.'
        } else {
          parent.innerHTML = 'An unknown error has occurred. This often occurs because a CORS request has been blocked. Make sure the server you are accessing allows cross-origin requests.'
        }
      })
  }
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
  const itemUUID = el.getAttribute('data-itemUUID')
  const path = JSON.parse(el.getAttribute('data-path'))
  const file = el.getAttribute('data-file')
  const type = el.getAttribute('data-type')
  let annotationUUID = el.getAttribute('data-annotationUUID')
  let annotation

  if ((annotationUUID == null) || (annotationUUID === '')) {
    // We are creating a new annotation.
    annotationUUID = constCommon.uuid()
    annotation = {
      uuid: annotationUUID,
      path,
      file,
      type
    }
    createAnnoationHTML(itemUUID, annotation)
  } else {
    // We are editing an existing annotation.
    annotation = workingDefinition.content[itemUUID].annotations[annotationUUID]
    annotation.path = path
    annotation.file = file
    annotation.type = type
    document.getElementById('Annotation' + annotation.uuid + 'Title').innerHTML = '<b>Annotation: </b>' + path.slice(-1)
  }

  let annotations
  if ('annotations' in workingDefinition.content[itemUUID]) {
    annotations = workingDefinition.content[itemUUID].annotations
    annotations[annotationUUID] = annotation
  } else {
    annotations = {}
    annotations[annotationUUID] = annotation
  }
  constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  constSetup.previewDefinition(true)
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
  $('#annotateFromJSONModal').modal('hide')
}

function createAnnoationHTML (itemUUID, details) {
  // Create the HTML represetnation of an annotation and add it to the item.

  const col = document.createElement('div')
  col.classList = 'col-12 border rounded py-2'
  col.setAttribute('id', 'Annotation' + details.uuid)

  const row = document.createElement('div')
  row.classList = 'row gy-2'
  col.appendChild(row)

  const title = document.createElement('div')
  title.classList = 'col-12 text-center'
  title.setAttribute('id', 'Annotation' + details.uuid + 'Title')
  title.innerHTML = '<b>Annotation: </b>' + details.path.slice(-1)
  row.appendChild(title)

  const xPosCol = document.createElement('div')
  xPosCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(xPosCol)

  const xPosDiv = document.createElement('div')
  xPosDiv.classList = 'w-100'
  xPosCol.appendChild(xPosDiv)

  const xPosLabel = document.createElement('label')
  xPosLabel.classList = 'form-label'
  xPosLabel.innerHTML = 'Horizontal position'
  xPosLabel.setAttribute('for', 'xPosInput' + details.uuid)
  xPosDiv.appendChild(xPosLabel)

  const xPosInput = document.createElement('input')
  xPosInput.classList = 'form-control'
  xPosInput.setAttribute('type', 'number')
  xPosInput.setAttribute('id', 'xPosInput' + details.uuid)
  xPosInput.setAttribute('min', '0')
  xPosInput.setAttribute('max', '100')
  xPosInput.setAttribute('step', '1')
  if ('x_position' in details) {
    xPosInput.value = details.x_position
  } else {
    xPosInput.value = 50
  }
  xPosInput.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'x_position'], event.target.value)
    constSetup.previewDefinition(true)
  })
  xPosDiv.appendChild(xPosInput)

  const yPosCol = document.createElement('div')
  yPosCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(yPosCol)

  const yPosDiv = document.createElement('div')
  yPosDiv.classList = 'w-100'
  yPosCol.appendChild(yPosDiv)

  const yPosLabel = document.createElement('label')
  yPosLabel.classList = 'form-label'
  yPosLabel.innerHTML = 'Vertical position'
  yPosLabel.setAttribute('for', 'yPosInput' + details.uuid)
  yPosDiv.appendChild(yPosLabel)

  const yPosInput = document.createElement('input')
  yPosInput.classList = 'form-control'
  yPosInput.setAttribute('type', 'number')
  yPosInput.setAttribute('id', 'yPosInput' + details.uuid)
  yPosInput.setAttribute('min', '0')
  yPosInput.setAttribute('max', '100')
  yPosInput.setAttribute('step', '1')
  if ('y_position' in details) {
    yPosInput.value = details.y_position
  } else {
    yPosInput.value = 50
  }
  yPosInput.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'y_position'], event.target.value)
    constSetup.previewDefinition(true)
  })
  yPosDiv.appendChild(yPosInput)

  const alignCol = document.createElement('div')
  alignCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(alignCol)

  const alignDiv = document.createElement('div')
  alignDiv.classList = 'w-100'
  alignCol.appendChild(alignDiv)

  const alignLabel = document.createElement('label')
  alignLabel.classList = 'form-label'
  alignLabel.innerHTML = 'Text alignment'
  alignLabel.setAttribute('for', 'alignSelect' + details.uuid)
  alignDiv.appendChild(alignLabel)

  const alignSelect = document.createElement('select')
  alignSelect.classList = 'form-select'
  alignSelect.appendChild(new Option('Left', 'left'))
  alignSelect.appendChild(new Option('Center', 'center'))
  alignSelect.appendChild(new Option('Right', 'right'))
  if ('align' in details) {
    alignSelect.value = details.align
  }
  alignSelect.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'align'], event.target.value)
    constSetup.previewDefinition(true)
  })
  alignDiv.appendChild(alignSelect)

  const fontSizeCol = document.createElement('div')
  fontSizeCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(fontSizeCol)

  const fontSizeDiv = document.createElement('div')
  fontSizeCol.appendChild(fontSizeDiv)

  const fontSizeLabel = document.createElement('label')
  fontSizeLabel.classList = 'form-label'
  fontSizeLabel.innerHTML = 'Text size'
  fontSizeLabel.setAttribute('for', 'fontSizeInput' + details.uuid)
  fontSizeDiv.appendChild(fontSizeLabel)

  const fontSizeInput = document.createElement('input')
  fontSizeInput.classList = 'form-control'
  fontSizeInput.setAttribute('type', 'number')
  fontSizeInput.setAttribute('id', 'fontSizeInput' + details.uuid)
  fontSizeInput.setAttribute('min', '1')
  fontSizeInput.setAttribute('step', '1')
  if ('font_size' in details) {
    fontSizeInput.value = details.font_size
  } else {
    fontSizeInput.value = 20
  }
  fontSizeInput.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'font_size'], event.target.value)
    constSetup.previewDefinition(true)
  })
  fontSizeDiv.appendChild(fontSizeInput)

  const fontColorCol = document.createElement('div')
  fontColorCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(fontColorCol)

  const fontColorDiv = document.createElement('div')
  fontColorCol.appendChild(fontColorDiv)

  const fontColorLabel = document.createElement('label')
  fontColorLabel.classList = 'form-label'
  fontColorLabel.innerHTML = 'Text color'
  fontColorLabel.setAttribute('for', 'fontColorInput' + details.uuid)
  fontColorDiv.appendChild(fontColorLabel)

  const fontColorInput = document.createElement('input')
  fontColorInput.classList = 'coloris'
  fontColorInput.style.height = '35px'
  fontColorInput.setAttribute('id', 'fontColorInput' + details.uuid)
  if ('color' in details) {
    fontColorInput.value = details.color
  } else {
    fontColorInput.value = 'black'
  }
  fontColorInput.addEventListener('change', (event) => {
    constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations', details.uuid, 'color'], event.target.value)
    constSetup.previewDefinition(true)
  })
  fontColorDiv.appendChild(fontColorInput)
  setTimeout(setUpColorPickers, 100)

  const fontFaceCol = document.createElement('div')
  fontFaceCol.classList = 'col-12 col-md-6'
  row.appendChild(fontFaceCol)

  const actionCol = document.createElement('div')
  actionCol.classList = 'col-12 col-md-6 col-lg-3 d-flex align-items-end'
  row.appendChild(actionCol)

  const actionDropdown = document.createElement('div')
  actionDropdown.classList = 'dropdown w-100'
  actionCol.appendChild(actionDropdown)

  const actionButton = document.createElement('button')
  actionButton.classList = 'btn btn-primary dropdown-toggle w-100'
  actionButton.setAttribute('type', 'button')
  actionButton.setAttribute('data-bs-toggle', 'dropdown')
  actionButton.setAttribute('aria-expanded', false)
  actionButton.innerHTML = 'Action'
  actionDropdown.appendChild(actionButton)

  const actionMenu = document.createElement('ul')
  actionMenu.classList = 'dropdown-menu'
  actionDropdown.appendChild(actionMenu)

  const li1 = document.createElement('li')
  const li2 = document.createElement('li')
  actionMenu.appendChild(li1)
  actionMenu.appendChild(li2)

  const editAction = document.createElement('a')
  editAction.classList = 'dropdown-item text-info'
  editAction.innerHTML = 'Edit JSON field'
  editAction.style.cursor = 'pointer'
  editAction.addEventListener('click', () => {
    showAnnotateFromJSONModal(itemUUID, details.uuid)
  })
  li1.appendChild(editAction)

  const deleteAction = document.createElement('a')
  deleteAction.classList = 'dropdown-item text-danger'
  deleteAction.innerHTML = 'Delete'
  deleteAction.style.cursor = 'pointer'
  deleteAction.addEventListener('click', () => {
    document.getElementById('deleteAnnotationModal').setAttribute('data-annotationUUID', details.uuid)
    document.getElementById('deleteAnnotationModal').setAttribute('data-itemUUID', itemUUID)
    $('#deleteAnnotationModal').modal('show')
  })
  li1.appendChild(deleteAction)

  document.getElementById('annotationRow_' + itemUUID).appendChild(col)

  // Must be after we had the main element to the DOM

  constSetup.createAdvancedFontPicker({
    parent: fontFaceCol,
    name: 'Font',
    path: `content>${itemUUID}>annotations>${details.uuid}>font`,
    default: 'OpenSans-Regular.ttf'
  })
  constSetup.refreshAdvancedFontPickers()
}

function showChooseURLModal (uuid) {
  // Prepare and show the modal for choosing content from a URL.

  document.getElementById('chooseURLModal').setAttribute('data-uuid', uuid)
  document.getElementById('chooseURLModalInput').value = ''
  document.getElementById('chooseURLModalPreviewVideo').style.display = 'none'
  document.getElementById('chooseURLModalPreviewImage').style.display = 'none'
  document.getElementById('chooseURLModalPreviewAudio').style.display = 'none'
  document.getElementById('chooseURLModalError').style.display = 'none'

  $('#chooseURLModal').modal('show')
}

async function fetchContentFromURL () {
  // From the chooseContentModal, fetch the given link and show a preview.

  const url = document.getElementById('chooseURLModalInput').value.trim()
  const video = document.getElementById('chooseURLModalPreviewVideo')
  const image = document.getElementById('chooseURLModalPreviewImage')
  const audio = document.getElementById('chooseURLModalPreviewAudio')
  const modal = document.getElementById('chooseURLModal')
  const error = document.getElementById('chooseURLModalError')

  const mimetype = constCommon.guessMimetype(url)
  modal.setAttribute('data-mimetype', mimetype)
  console.log(mimetype)
  if (mimetype === 'video') {
    video.src = url
    error.style.display = 'none'
    video.style.display = 'block'
    image.style.display = 'none'
    audio.style.display = 'none'
    audio.pause()
  } else if (mimetype === 'image') {
    image.src = url
    error.style.display = 'none'
    video.style.display = 'none'
    image.style.display = 'block'
    audio.style.display = 'none'
    audio.pause()
    video.pause()
  } else if (mimetype === 'audio') {
    audio.src = url
    error.style.display = 'none'
    video.style.display = 'none'
    image.style.display = 'none'
    audio.style.display = 'block'
    video.pause()
  } else {
    modal.setAttribute('data-mimetype', '')
    error.style.display = 'block'
    video.style.display = 'none'
    image.style.display = 'none'
    audio.style.display = 'none'
    audio.pause()
    video.pause()
  }
}

function setContentFromURLModal () {
  // Set the currently selected file as the item's content.

  const url = document.getElementById('chooseURLModalInput').value.trim()
  const uuid = document.getElementById('chooseURLModal').getAttribute('data-uuid')
  const itemEl = document.getElementById('Item_' + uuid)
  setItemContent(uuid, itemEl, url, 'url')

  $('#chooseURLModal').modal('hide')
}

function setItemContent (uuid, itemEl, file, type = 'file') {
  // Populate the given element, item, with content.

  constSetup.updateWorkingDefinition(['content', uuid, 'filename'], file)
  constSetup.updateWorkingDefinition(['content', uuid, 'type'], type)
  constSetup.previewDefinition(true)

  const image = itemEl.querySelector('.image-preview')
  const video = itemEl.querySelector('.video-preview')
  const fileField = itemEl.querySelector('.file-field')

  itemEl.setAttribute('data-filename', file)
  itemEl.setAttribute('data-type', type)
  const mimetype = constCommon.guessMimetype(file)
  fileField.innerHTML = file
  if (mimetype === 'audio') {
    image.src = constFileSelect.getDefaultAudioIcon()
    image.style.display = 'block'
    video.style.display = 'none'
    // Hide the duration input
    itemEl.querySelector('.duration-col').style.display = 'none'
  } else if (mimetype === 'image') {
    if (type === 'file') {
      image.src = '/thumbnails/' + constCommon.withExtension(file, 'jpg')
    } else if (type === 'url') {
      image.src = file
    }
    image.style.display = 'block'
    video.style.display = 'none'
    // Show the duration input
    itemEl.querySelector('.duration-col').style.display = 'block'
  } else if (mimetype === 'video') {
    if (type === 'file') {
      video.src = '/thumbnails/' + constCommon.withExtension(file, 'mp4')
    } else if (type === 'url') {
      video.src = file
    }
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
document.getElementById('chooseURLModalFetchButton').addEventListener('click', () => {
  fetchContentFromURL()
})
document.getElementById('chooseURLModalSubmitButton').addEventListener('click', setContentFromURLModal)

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
document.getElementById('annotateFromJSONModalFetchURLButton').addEventListener('click', () => {
  const url = document.getElementById('annotateFromJSONModalURLInput').value
  populateAnnotateFromJSONModal(url, 'url')
})
document.getElementById('deleteAnnotationModalSubmitButton').addEventListener('click', () => {
  const modal = document.getElementById('deleteAnnotationModal')
  const definition = $('#definitionSaveButton').data('workingDefinition')
  const itemUUID = modal.getAttribute('data-itemUUID')
  const annotationUUID = modal.getAttribute('data-annotationUUID')
  const annotations = definition.content[itemUUID].annotations
  delete annotations[annotationUUID]

  constSetup.updateWorkingDefinition(['content', itemUUID, 'annotations'], annotations)
  constSetup.previewDefinition(true)
  document.getElementById('Annotation' + annotationUUID).remove()
  $(modal).modal('hide')
})
document.getElementById('annotateFromJSONModalCloseButton').addEventListener('click', () => {
  // When we close the annotate from JSON modal, clear the tree, as complex JSON structures can limit performance.
  document.getElementById('annotateFromJSONModalTreeView').innerHTML = ''
})

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

constCommon.askForDefaults(false)
  .then(() => {
    if (constCommon.config.standalone === false) {
      // We are using Control Server, so attempt to log in
      constSetup.authenticateUser()
    } else {
      // Hide the login details
      document.getElementById('loginMenu').style.display = 'none'
    }
  })
