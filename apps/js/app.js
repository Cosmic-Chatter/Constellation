import * as constCommon from '../js/constellation_app_common.js'

function updateParser (update) {
  // Read updates
}

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

constCommon.config.updateParser = updateParser // Function to read app-specific updatess
constCommon.config.constellationAppID = 'none'
constCommon.config.debug = true
constCommon.config.helperAddress = window.location.origin

constCommon.askForDefaults()
