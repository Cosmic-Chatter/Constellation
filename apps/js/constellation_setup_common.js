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
  clearDefinition: null,
  loadDefinition: null,
  saveDefinition: null
}

export function configure (options) {
  // Set up the common fields for the setup app.

  const defaults = {
    app: null,
    clearDefinition: null,
    loadDefinition: null,
    saveDefinition: null
  }

  options = { ...defaults, ...options } // Merge in user-supplied options

  // Make sure we have the options we need
  if (options.app == null) throw new Error("The options must include the 'app' field.")
  if (options.loadDefinition == null) throw new Error("The options must include the 'loadDefinition' field referencing the appropriate function.")
  if (options.saveDefinition == null) throw new Error("The options must include the 'saveDefinition' field referencing the appropriate function.")

  config.app = options.app
  config.clearDefinition = options.clearDefinition
  config.loadDefinition = options.loadDefinition
  config.saveDefinition = options.saveDefinition

  createAdvancedColorPickers()
  createDefinitionDeletePopup()
  createEventListeners()

  constCommon.getAvailableDefinitions(options.app)
    .then((response) => {
      if ('success' in response && response.success === true) {
        populateAvailableDefinitions(response.definitions)
      }
    })
    .then(() => {
      configureFromQueryString()
    })
}

export function showAppHelpModal (app) {
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

  document.getElementById('availableDefinitionSelect').innerHTML = ''
  config.availableDefinitions = definitions
  const keys = Object.keys(definitions).sort((a, b) => {
    const aName = definitions[a].name.toLowerCase()
    const bName = definitions[b].name.toLowerCase()
    if (aName > bName) return 1
    if (bName > aName) return -1
    return 0
  })

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
  } else {
    if (config.clearDefinition != null) config.clearDefinition()
  }
}

export function getDefinitionByUUID (uuid = '') {
  // Return the definition with this UUID

  if (uuid === '') {
    uuid = document.getElementById('availableDefinitionSelect').value
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

function cloneDefinition () {
  // Clone the definition currently in the select and make it active.

  const uuidToClone = document.getElementById('availableDefinitionSelect').value
  if (uuidToClone === '') return

  const defToClone = structuredClone(getDefinitionByUUID(uuidToClone))

  defToClone.uuid = '' // Will be replaced with a new UUID on saving
  defToClone.name += ' 2'

  constCommon.writeDefinition(defToClone)
    .then((result) => {
      if ('success' in result && result.success === true) {
        constCommon.getAvailableDefinitions(config.app)
          .then((response) => {
            if ('success' in response && response.success === true) {
              populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = result.uuid
              config.loadDefinition(result.uuid)
            }
          })
      }
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

  // New definition buttons
  document.getElementById('newDefinitionButton').addEventListener('click', () => {
    config.clearDefinition()
  })
  document.getElementById('cloneDefinitionButton').addEventListener('click', cloneDefinition)

  // Edit definition button
  document.getElementById('editDefinitionButton').addEventListener('click', () => {
    config.loadDefinition()
  })

  // Save definition button
  document.getElementById('definitionSaveButton').addEventListener('click', () => {
    config.saveDefinition()
  })

  // Preview definition button
  document.getElementById('previewRefreshButton').addEventListener('click', () => {
    previewDefinition(false)
  })

  // Rotate preview button
  document.getElementById('previewRotateButton').addEventListener('click', () => {
    rotatePreview()
  })

  // Help button
  document.getElementById('helpButton').addEventListener('click', () => {
    showAppHelpModal(config.app)
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

function createAdvancedColorPickers () {
  // Look for advanced-color-picker elements and fill them with the combo widget.

  Array.from(document.querySelectorAll('.advanced-color-picker')).forEach((el) => {
    const name = el.getAttribute('data-constACP-name')
    const path = el.getAttribute('data-constACP-path').split('>')
    _createAdvancedColorPicker(el, name, path)
  })
}

function _createAdvancedColorPicker (el, name, path) {
  // Create the GUI for an advanced color picker
  // 'name' is the name of the picker to be displayed in the label
  // 'path' is the definition path to be prepended to the elements.

  const id = String(Math.round(Math.random() * 1e10))
  el.setAttribute('data-constACP-id', id)

  const html = `
    <div class="border rounded px-2 py-2">
      <label class="form-label">${name}</label>
      <div class="row">
        <div class="col-6">
          <select id="ACPModeSelect_${id}" class="form-select constACP-mode">
            <option value="color">Solid color</option>
            <option value="gradient">Color gradient</option>
            <option value="image">Image</option>
          </select>
        </div>
        <div id="ACPColorCol_${id}" class="col-6">
          <input id="ACPColor_${id}" type="text" class="coloris form-control constACP-color" value="#22222E">
        </div>
        <div id="ACPGradientCol_${id}" class="col-6 d-none">
          <div class="row gy-1">
            <div class="col-6">
              <input id="ACPGradient_gradient1_${id}" type="text" class="coloris form-control constACP-gradient1" value="#22222E">
              <input id="ACPGradient_gradient2_${id}" type="text" class="coloris form-control constACP-gradient2" value="#22222E">
            </div>
            <div class="col-6">
              <label for="ACPAnglePicker_${id}" class="form-label">Angle</label>
              <input id="ACPAnglePicker_${id}" class="form-control constACP-angle" type="number" min="0", max="359" value="0">
            </div>
          </div>
        </div>
        <div id="ACPImageCol_${id}" class="col-6 d-none">
          <button id="ACPImage_${id}" class="btn btn-outline-primary w-100 text-break constACP-image">Select image</button>
        </div>
        
      </div>
    </div>
  `
  el.innerHTML = html

  // Add event listeners
  document.getElementById(`ACPModeSelect_${id}`).addEventListener('change', (event) => {
    _onAdvancedColorPickerModeChange(id, path, event.target.value)
  })

  document.getElementById(`ACPColor_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'color'], event.target.value)
    previewDefinition(true)
  })

  document.getElementById(`ACPImage_${id}`).addEventListener('click', (event) => {
    constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
      .then((result) => {
        if (result != null && result.length > 0) {
          updateWorkingDefinition([...path, 'image'], result[0])
          event.target.innerHTML = result[0]
          previewDefinition(true)
        }
      })
  })
  document.getElementById(`ACPGradient_gradient1_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_1'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPGradient_gradient2_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_color_2'], event.target.value)
    previewDefinition(true)
  })
  document.getElementById(`ACPAnglePicker_${id}`).addEventListener('change', (event) => {
    updateWorkingDefinition([...path, 'gradient_angle'], event.target.value % 360)
    previewDefinition(true)
  })
}

function _onAdvancedColorPickerModeChange (id, path, value) {
  // Configure the GUI based on the selected value

  const colorCol = document.getElementById(`ACPColorCol_${id}`)
  const gradCol = document.getElementById(`ACPGradientCol_${id}`)
  const imageCol = document.getElementById(`ACPImageCol_${id}`)

  if (value === 'color') {
    colorCol.classList.remove('d-none')
    gradCol.classList.add('d-none')
    imageCol.classList.add('d-none')
  } else if (value === 'gradient') {
    colorCol.classList.add('d-none')
    gradCol.classList.remove('d-none')
    imageCol.classList.add('d-none')
  } else if (value === 'image') {
    colorCol.classList.add('d-none')
    gradCol.classList.add('d-none')
    imageCol.classList.remove('d-none')
  }
  updateWorkingDefinition([...path, 'mode'], value)
  previewDefinition(true)
}

export function updateAdvancedColorPicker (path, details) {
  // Update the color picker defined by path using the values in details.

  const el = document.querySelector(`.advanced-color-picker[data-constACP-path="${path}"]`)
  if (el.childNodes.length === 0) return

  if ('mode' in details) {
    el.querySelector('.constACP-mode').value = details.mode
  }
  if ('color' in details) {
    const solidColorPicker = el.querySelector('.constACP-color')
    solidColorPicker.value = details.color
    solidColorPicker.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_color_1' in details) {
    const gradientPicker1 = el.querySelector('.constACP-gradient1')
    gradientPicker1.value = details.gradient_color_1
    gradientPicker1.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_color_2' in details) {
    const gradientPicker2 = el.querySelector('.constACP-gradient2')
    gradientPicker2.value = details.gradient_color_2
    gradientPicker2.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if ('gradient_angle' in details) {
    el.querySelector('.constACP-angle').value = details.gradient_angle
  }
  if ('image' in details) {
    el.querySelector('.constACP-image').innerHTML = details.image
  }

  const id = el.getAttribute('data-constACP-id')
  _onAdvancedColorPickerModeChange(id, path, details.mode)
}

const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')
