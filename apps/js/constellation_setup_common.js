/* global bootstrap, showdown */

import * as constCommon from '../js/constellation_app_common.js'
import * as constFileSelect from '../js/constellation_file_select_modal.js'

$.fn.visibleHeight = function () {
  // JQuery function to calculate the visible height of an element
  // From https://stackoverflow.com/a/29944927

  const scrollTop = $(window).scrollTop()
  const scrollBot = scrollTop + $(window).height()
  const elTop = this.offset().top
  const elBottom = elTop + this.outerHeight()
  const visibleTop = elTop < scrollTop ? scrollTop : elTop
  const visibleBottom = elBottom > scrollBot ? scrollBot : elBottom
  return Math.max(visibleBottom - visibleTop, 0)
}

export const config = {
  availableDefinitions: {},
  loadDefinition: null
}

export function configure (options) {
  // Set up the common fields for the setup app.

  const defaults = {
    app: null,
    loadDefinition: null
  }

  options = { ...defaults, ...options } // Merge in user-supplied options

  // Make sure we have the options we need
  if (options.app == null) throw new Error("The options must include the 'app' field.")
  if (options.loadDefinition == null) throw new Error("The options must include the 'loadDefinition' field referencing the appropriate function.")

  config.app = options.app
  config.loadDefinition = options.loadDefinition

  constCommon.getAvailableDefinitions(options.app)
    .then((response) => {
      if ('success' in response && response.success === true) {
        populateAvailableDefinitions(response.definitions)
      }
    })
    .then(() => {
      configureFromQueryString()
    })

  document.getElementById('helpButton').addEventListener('click', (event) => {
    showAppHelpMOdal(config.app)
  })
  createAdvancedColorPickers()
  createDefinitionDeletePopup()
  createEventListeners()
}

function showAppHelpMOdal (app) {
  // Ask the helper to send the relavent README.md file and display it in the modal

  const endpointStems = {
    dmx_control: '/dmx_control/',
    infostation: '/InfoStation/',
    media_browser: '/media_browser/',
    media_player: '/media_player/',
    other: '/other/',
    timelapse_viewer: '/timelapse_viewer/',
    timeline_explorer: '/timeline_explorer/',
    voting_kiosk: '/voting_kiosk/',
    word_cloud: '/word_cloud/',
    word_cloud_input: '/word_cloud/',
    word_cloud_viewer: '/word_cloud/'
  }

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: endpointStems[app] + 'README.md',
    rawResponse: true
  })
    .then((result) => {
      const formattedText = markdownConverter.makeHtml(result)
      // Add the formatted text
      $('#helpTextDiv').html(formattedText)
      // Then, search the children for images and fix the links with the right endpoints
      $('#helpTextDiv').find('img').each((i, img) => {
        // Strip off the http://localhost:8000/ porition
        const src = img.src.split('/').slice(3).join('/')
        // Rebuild the correct path
        img.src = constCommon.config.helperAddress + endpointStems[app] + '/' + src
        img.style.maxWidth = '100%'
      })
      $('#helpTextDiv').parent().parent().scrollTop(0)
    })

  $('#appHelpModal').modal('show')
}

export function populateAvailableDefinitions (definitions) {
  // Take a list of definitions and add them to the select.

  $('#availableDefinitionSelect').empty()
  config.availableDefinitions = definitions
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

export function configureFromQueryString () {
  // Use the query string to configure the setup app.

  const queryString = decodeURIComponent(window.location.search)
  const searchParams = new URLSearchParams(queryString)

  if (searchParams.get('definition') != null) {
    config.loadDefinition(searchParams.get('definition'))
    document.getElementById('availableDefinitionSelect').value = searchParams.get('definition')
  }
}

export function getDefinitionByUUID (uuid = '') {
  // Return the definition with this UUID

  if (uuid === '') {
    uuid = $('#availableDefinitionSelect').val()
  }
  let matchedDef = null
  Object.keys(config.availableDefinitions).forEach((key) => {
    const def = config.availableDefinitions[key]
    if (def.uuid === uuid) {
      matchedDef = def
    }
  })
  return matchedDef
}

function deleteDefinition () {
  // Delete the definition currently listed in the select.

  const definition = $('#availableDefinitionSelect').val()

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/definitions/' + definition + '/delete'
  })
    .then(() => {
      constCommon.getAvailableDefinitions(config.app)
        .then((response) => {
          if ('success' in response && response.success === true) {
            populateAvailableDefinitions(response.definitions)
          }
        })
    })
}

export function updateWorkingDefinition (property, value) {
  // Update a field in the working defintion.
  // 'property' should be an array of subproperties, e.g., ["style", "color", 'headerColor']
  // for definition.style.color.headerColor

  constCommon.setObjectProperty($('#definitionSaveButton').data('workingDefinition'), property, value)
}

function createEventListeners () {
  // Bind various event listeners to their elements.

  // Edit definition button
  document.getElementById('editDefinitionButton').addEventListener('click', () => {
    config.loadDefinition()
  })

  // Rotate preview button
  document.getElementById('previewRotateButton').addEventListener('click', () => {
    rotatePreview()
  })

  // Preview frame
  window.addEventListener('load', resizePreview)
  window.addEventListener('resize', resizePreview)
  window.addEventListener('scroll', resizePreview)

  // Activate tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    return new bootstrap.Tooltip(tooltipTriggerEl)
  })
}

function createDefinitionDeletePopup () {
  // Create the popup that occurs when clicking the definition delete button.

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
}

function rotatePreview () {
  // Toggle the preview between landscape and portrait orientations.

  document.getElementById('previewFrame').classList.toggle('preview-landscape')
  document.getElementById('previewFrame').classList.toggle('preview-portrait')
  resizePreview()
}

function resizePreview () {
  // Resize the preview so that it always fits the view.

  // Size of things above view area
  const headerHeight = $('#setupHeader').visibleHeight()
  const toolsHeight = $('#setupTools').visibleHeight()
  const viewportHeight = window.innerHeight

  // First, set the height of the area available for the preview
  $('#previewPane').css('height', viewportHeight - headerHeight - toolsHeight)

  // Size of available area
  const paneWidth = $('#previewPane').width()
  const paneHeight = $('#previewPane').height()

  // Size of frame (this will be 1920x1080 or 1080x1920)
  const frameWidth = $('#previewFrame').width()
  const frameHeight = $('#previewFrame').height()
  const frameAspect = frameWidth / frameHeight

  let transformRatio
  if (frameAspect <= 1) {
    // Handle portrait (constraint should be height)
    transformRatio = 0.95 * paneHeight / frameHeight
  } else {
    // Handle landscape (constraint should be width)
    transformRatio = 1.0 * paneWidth / frameWidth
  }

  $('#previewFrame').css('transform', 'scale(' + transformRatio + ')')
}

function createAdvancedColorPickers () {
  // Look for advanced-color-picker elements and fill them with the combo widget.

  Array.from(document.querySelectorAll('.advanced-color-picker')).forEach((el) => {
    const name = el.getAttribute('data-const-name')
    createAdvancedColorPicker(el, name)
  })
}

export function previewDefinition (automatic = false) {
  // Save the definition to a temporary file and load it into the preview frame.
  // If automatic == true, we've called this function beceause a definition field
  // has been updated. Only preview if the 'Refresh on change' checkbox is checked

  if ((automatic === true) && $('#refreshOnChangeCheckbox').prop('checked') === false) {
    return
  }

  const def = $('#definitionSaveButton').data('workingDefinition')
  // Set the uuid to a temp one
  def.uuid = '__preview_' + config.app
  constCommon.writeDefinition(def)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Configure the preview frame
        document.getElementById('previewFrame').src = '../' + config.app + '.html?standalone=true&definition=' + '__preview_' + config.app
      }
    })
}

function createAdvancedColorPicker (el, name) {
  // Create the GUI for an advanced color picker

  const id = String(Math.round(Math.random() * 1e10))

  const html = `
    <div class="border rounded px-2 py-2">
      <label class="form-label">${name}</label>
      <div class="row">
        <div class="col-6">
          <select id="ACPModeSelect_${id}" class="form-select">
            <option value="color">Solid color</option>
            <option value="gradient">Color gradient</option>
            <option value="image">Image</option>
          </select>
        </div>
        <div id="ACPColorCol_${id}" class="col-6">
          <input id="ACPColor_${id}" type="text" class="coloris form-control" value="#22222E">
        </div>
        <div id="ACPGradientCol_${id}" class="col-6 d-none">
          <div class="row gy-1">
            <div class="col-6">
              <input id="ACPGradient_gradient1_${id}" type="text" class="coloris form-control" value="#22222E">
              <input id="ACPGradient_gradient2_${id}" type="text" class="coloris form-control" value="#22222E">
            </div>
            <div class="col-6">
              <label for="ACPAnglePicker_${id}" class="form-label">Angle</label>
              <input id="ACPAnglePicker_${id}" class="form-control" type="number" min="0", max="359" value="0">
            </div>
          </div>
        </div>
        <div id="ACPImageCol_${id}" class="col-6 d-none">
          <button id="ACPImage_${id}" class="btn btn-outline-primary w-100 text-break">Select image</button>
        </div>
        
      </div>
    </div>
  `
  el.innerHTML = html

  // Add event listeners
  document.getElementById(`ACPModeSelect_${id}`).addEventListener('change', (event) => {
    const colorCol = document.getElementById(`ACPColorCol_${id}`)
    const gradCol = document.getElementById(`ACPGradientCol_${id}`)
    const imageCol = document.getElementById(`ACPImageCol_${id}`)
    if (event.target.value === 'color') {
      colorCol.classList.remove('d-none')
      gradCol.classList.add('d-none')
      imageCol.classList.add('d-none')
    } else if (event.target.value === 'gradient') {
      colorCol.classList.add('d-none')
      gradCol.classList.remove('d-none')
      imageCol.classList.add('d-none')
    } else if (event.target.value === 'image') {
      colorCol.classList.add('d-none')
      gradCol.classList.add('d-none')
      imageCol.classList.remove('d-none')
    }
    updateWorkingDefinition(['style', 'background', 'mode'], event.target.value)
    previewDefinition(true)
  })

  document.getElementById(`ACPColor_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition(['style', 'background', 'color'], event.target.value)
    previewDefinition(true)
  })

  document.getElementById(`ACPImage_${id}`).addEventListener('click', (event) => {
    constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
      .then((result) => {
        if (result != null && result.length > 0) {
          updateWorkingDefinition(['style', 'background', 'image'], result[0])
          event.target.innerHTML = result[0]
          previewDefinition(true)
        }
      })
  })
  document.getElementById(`ACPGradient_gradient1_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition(['style', 'background', 'gradient_color_1'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPGradient_gradient2_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition(['style', 'background', 'gradient_color_2'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPAnglePicker_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition(['style', 'background', 'gradient_angle'], event.target.value % 360)
    previewDefinition(true)
  })
}

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')
