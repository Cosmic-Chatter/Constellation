/* global Coloris, bootstrap */

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
          attractor: {},
          behavior: {},
          style: {
            background: {
              mode: 'color',
              color: '#22222E'
            }
          }
        })
        $('#definitionSaveButton').data('workingDefinition', {
          uuid: response.uuid,
          attractor: {},
          behavior: {},
          style: {
            background: {
              mode: 'color',
              color: '#22222E'
            }
          }
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
  document.getElementById('definitionNameInput').value = ''
  document.getElementById('behaviorInput_animation_duration').value = 15

  // Content details
  document.getElementById('filePatternInput').value = ''
  document.getElementById('filenamePatternMatches').value = null

  // Attractor details
  document.getElementById('attractorInput_attractor_timeout').value = 30
  document.getElementById('attractorCheck_use_attractor').checked = false
  disableAttractorOptions(true)
  document.getElementById('attractorCheck_use_finger_animation').checked = true
  document.getElementById('attractorInput_attractor_height').value = 40
  document.getElementById('attractorInput_text').value = ''
  document.getElementById('attractorInput_font_adjust').value = 0
  document.getElementById('attractorInput_attractor_background').value = 'rgba(0, 0, 0, 0.2)'
  document.querySelector('#attractorInput_attractor_background').dispatchEvent(new Event('input', { bubbles: true }))
  document.getElementById('attractorInput_text_color').value = '#fff'
  document.querySelector('#attractorInput_text_color').dispatchEvent(new Event('input', { bubbles: true }))
  constSetup.resetAdvancedFontPickers()

  // Appearance details
  constSetup.updateAdvancedColorPicker('style>background', {
    mode: 'color',
    color: '#22222E',
    gradient_color_1: '#22222E',
    gradient_color_2: '#22222E'
  })
}

function editDefinition (uuid = '') {
  // Populate the given definition for editing.

  clearDefinitionInput(false)
  const def = constSetup.getDefinitionByUUID(uuid)
  $('#definitionSaveButton').data('initialDefinition', structuredClone(def))
  $('#definitionSaveButton').data('workingDefinition', structuredClone(def))

  $('#definitionNameInput').val(def.name)
  document.getElementById('filePatternInput').value = def.files
  retrieveMatchingFilesCount()

  // Set the appropriate values for the behavior fields
  Object.keys(def.behavior).forEach((key) => {
    document.getElementById('behaviorInput_' + key).value = def.behavior[key]
  })

  // Set the appropriate values for the attractor fields
  Object.keys(def.attractor).forEach((key) => {
    let el
    if (['use_attractor', 'use_finger_animation'].includes(key)) {
      el = document.getElementById('attractorCheck_' + key)
      el.checked = def.attractor[key]

      // If this is the Show Attractor checkbox, set the approprate state for the rest of the options
      if (key === 'use_attractor') {
        if (def.attractor[key] === true) {
          disableAttractorOptions(false)
        } else {
          disableAttractorOptions(true)
        }
      }
    } else if (key === 'font') {
      const picker = document.querySelector('.AFP-select[data-path="attractor>font"')
      constSetup.setAdvancedFontPicker(picker, def.attractor.font)
    } else {
      el = document.getElementById('attractorInput_' + key)
      el.value = def.attractor[key]
    }

    // Set the appropriate values for any advanced color pickers
    if ('background' in def.style) {
      constSetup.updateAdvancedColorPicker('style>background', def.style.background)
    }

    if (['attractor_background', 'text_color'].includes(key)) {
      // Send a special event to the color picker to trigger the change
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  })

  // Configure the preview frame
  document.getElementById('previewFrame').src = '../timelapse_viewer.html?standalone=true&definition=' + def.uuid
  constSetup.previewDefinition()
}

function disableAttractorOptions (disable) {
  // Set the disabled property for the attractor options
  if (disable) {
    Array.from(document.getElementsByClassName('attractor-input')).forEach((match) => {
      match.disabled = true
    })
  } else {
    Array.from(document.getElementsByClassName('attractor-input')).forEach((match) => {
      match.disabled = false
    })
  }
}

function saveDefinition () {
  // Collect inputted information to save the definition

  const definition = $('#definitionSaveButton').data('workingDefinition')
  const initialDefinition = $('#definitionSaveButton').data('initialDefinition')
  definition.app = 'timelapse_viewer'
  definition.name = $('#definitionNameInput').val()
  definition.uuid = initialDefinition.uuid

  constCommon.writeDefinition(definition)
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Update the UUID in case we have created a new definition
        $('#definitionSaveButton').data('initialDefinition', structuredClone(definition))
        constCommon.getAvailableDefinitions('timelapse_viewer')
          .then((response) => {
            if ('success' in response && response.success === true) {
              constSetup.populateAvailableDefinitions(response.definitions)
              document.getElementById('availableDefinitionSelect').value = definition.uuid
            }
          })
      }
    })
}

function guessFilenamePattern () {
  // Use two given filenames to guess a wildcard (*) pattern to select the range

  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) return

  const firstSplit = first.split('.')
  const firstExt = firstSplit.pop()
  const firstNoExt = firstSplit.join('.')

  const lastSplit = last.split('.')
  const lastNoExt = lastSplit.join('.')

  // Find common prefix
  let prefix = ''
  for (let i = 0; i < firstNoExt.length; i++) {
    if (firstNoExt[i] === lastNoExt[i]) {
      prefix += firstNoExt[i]
    } else break
  }
  const pattern = prefix + '*.' + firstExt
  constSetup.updateWorkingDefinition(['files'], pattern)
  document.getElementById('filePatternInput').value = pattern

  retrieveMatchingFilesCount()
}

function retrieveMatchingFilesCount () {
  // Check the number of files in content that match the given filename wildcard pattern.

  const pattern = document.getElementById('filePatternInput').value
  const split = pattern.split('*.')

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  }).then((result) => {
    const content = result.all_exhibits
    matchedFiles = content.filter((item) => {
      return item.startsWith(split[0]) && item.endsWith(split[1])
    })
    document.getElementById('filenamePatternMatches').value = matchedFiles.length
  })
}

function convertVideo () {
  // Ask the helper to convert the video to frames and track the progress.

  const filename = document.getElementById('selectConversionVideoButton').getAttribute('data-filename')
  if (filename == null || filename.trim() === '') {
    return
  }
  const button = document.getElementById('videoConversionModalSubmitButton')
  button.innerHTML = 'Working...'
  button.classList.add('btn-info')
  button.classList.remove('btn-primary')
  document.getElementById('conversionProgressBarDiv').style.display = 'flex'

  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/files/convertVideoToFrames',
    params: {
      filename,
      file_type: 'jpg'
    },
    timeout: 3.6e6 // 1 hr
  })

  const numFiles = parseInt(document.getElementById('outputFileCountField').value)
  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  }).then((result) => {
    trackConversionProgress(numFiles, result.all_exhibits.length)
  })
}

function trackConversionProgress (total, starting) {
  // Track the progress of the video conversion.
  // total is the estimated number of frames to be converted
  // starting is the number of files when the conversion started
  // The number completed = current total - now

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  }).then((result) => {
    const numComplete = result.all_exhibits.length - starting
    const percent = Math.round(100 * (numComplete / total))
    document.getElementById('conversionProgressBarDiv').setAttribute('aria-valuenow', percent)
    document.getElementById('conversionProgressBar').style.width = String(percent) + '%'
    if (numComplete < total - 5) {
      // Add a little slop (5) in case the estimated number of files is wrong.
      setTimeout(() => {
        trackConversionProgress(total, starting)
      }, 1000)
    } else {
      videoConversionModal.hide()
    }
  })
}

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

// Set helperAddress for calls to constCommon.makeHelperRequest
constCommon.config.helperAddress = window.location.origin

let matchedFiles = []

// Call with a slight delay to make sure the elements are loaded
setTimeout(setUpColorPickers, 100)

// Add event listeners
// -------------------------------------------------------------

// Behavior fields
Array.from(document.querySelectorAll('.behavior-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const key = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['behavior', key], event.target.value)
    constSetup.previewDefinition(true)
  })
})

// Video conversion
const videoConversionModal = new bootstrap.Modal('#videoConversionModal')
document.getElementById('showConvertVideoModal').addEventListener('click', (event) => {
  const convertButton = document.getElementById('videoConversionModalSubmitButton')
  document.getElementById('selectConversionVideoButton').innerHTML = 'Select video'
  document.getElementById('selectConversionVideoButton').setAttribute('data-filename', null)
  document.getElementById('fileConversionVideoPreview').src = null
  document.getElementById('outputFileCountField').value = null
  document.getElementById('conversionProgressBarDiv').style.display = 'none'
  document.getElementById('conversionProgressBarDiv').setAttribute('aria-valuenow', 0)
  document.getElementById('conversionProgressBar').style.width = '0%'

  convertButton.innerHTML = 'Convert'
  convertButton.classList.remove('btn-info')
  convertButton.classList.add('btn-primary')

  videoConversionModal.show()
})
document.getElementById('selectConversionVideoButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['video'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
        document.getElementById('fileConversionVideoPreview').src = constCommon.config.helperAddress + '/thumbnails/' + result[0].replace(/\.[^/.]+$/, '') + '.mp4'

        constCommon.makeHelperRequest({
          method: 'POST',
          endpoint: '/files/getVideoDetails',
          params: {
            filename: result[0]
          }
        })
          .then((response) => {
            if ('success' in response && response.success === true) {
              const frames = Math.round(response.details.duration * response.details.fps)
              document.getElementById('outputFileCountField').value = frames
            }
          })
      }
    })
})

document.getElementById('videoConversionModalSubmitButton').addEventListener('click', (event) => {
  convertVideo()
})

// Pattern generation
document.getElementById('filePatternInput').addEventListener('change', (event) => {
  constSetup.updateWorkingDefinition(['files'], event.target.value)
  retrieveMatchingFilesCount()
  constSetup.previewDefinition(true)
})
document.getElementById('selectFirstImageButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
document.getElementById('selectLastImageButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ multiple: false, filetypes: ['image'] })
    .then((result) => {
      if (result != null && result.length > 0) {
        event.target.setAttribute('data-filename', result[0])
        event.target.innerHTML = result[0]
      }
    })
})
const PatternGeneratorModal = new bootstrap.Modal('#patternGeneratorModal')
document.getElementById('showPatternGeneratorModal').addEventListener('click', (event) => {
  document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'none'
  document.getElementById('selectFirstImageButton').innerHTML = 'Select file'
  document.getElementById('selectFirstImageButton').setAttribute('data-filename', null)
  document.getElementById('selectLastImageButton').innerHTML = 'Select file'
  document.getElementById('selectLastImageButton').setAttribute('data-filename', null)
  PatternGeneratorModal.show()
})
document.getElementById('patternGeneratorModalSubmitButton').addEventListener('click', (event) => {
  const first = document.getElementById('selectFirstImageButton').getAttribute('data-filename')
  const last = document.getElementById('selectLastImageButton').getAttribute('data-filename')

  if (first == null || last == null) {
    document.getElementById('patternGeneratorModalMissingFilenameWarning').style.display = 'block'
  } else {
    guessFilenamePattern()
    PatternGeneratorModal.hide()
    constSetup.previewDefinition(true)
  }
})

// Attractor
Array.from(document.getElementsByClassName('attractor-input')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['attractor', property], event.target.value)
    constSetup.previewDefinition(true)
  })
})

Array.from(document.getElementsByClassName('attractor-check')).forEach((el) => {
  el.addEventListener('change', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['attractor', property], event.target.checked)
    // If we aren't using the attractor, disable the options
    if (event.target.getAttribute('id') === 'attractorCheck_use_attractor') {
      if (event.target.checked) {
        disableAttractorOptions(false)
      } else {
        disableAttractorOptions(true)
      }
    }
    constSetup.previewDefinition(true)
  })
})

// Font upload
document.getElementById('manageFontsButton').addEventListener('click', (event) => {
  constFileSelect.createFileSelectionModal({ filetypes: ['otf', 'ttf', 'woff', 'woff2'], manage: true })
    .then(constSetup.refreshAdvancedFontPickers)
})

// Realtime-sliders should adjust as we drag them
Array.from(document.querySelectorAll('.realtime-slider')).forEach((el) => {
  el.addEventListener('input', (event) => {
    const property = event.target.getAttribute('data-property')
    constSetup.updateWorkingDefinition(['attractor', property], event.target.value)
    constSetup.previewDefinition(true)
  })
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

constSetup.configure({
  app: 'timelapse_viewer',
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
