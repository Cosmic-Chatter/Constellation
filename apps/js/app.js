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
  .then(() => {
    if (constCommon.config.standalone === false) {
      // Using Control Server
      constCommon.sendPing()
      setInterval(constCommon.sendPing, 5000)
      if (constCommon.config.connectionChecker != null) setInterval(constCommon.config.connectionChecker, 500)
    } else {
      // Not using Control Server
      constCommon.loadDefinition(constCommon.config.currentDefinition)
    }
  })

document.getElementById('settingsButton').addEventListener('click', (event) => {
  if (constCommon.config.remoteDisplay === true) {
    // Switch webpages in the browser

    window.open(window.location.origin + '/setup.html', '_blank').focus()
  } else {
    // Launch the appropriate webview page in the app

    constCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/app/showWindow/settings',
      params: { reload: true }
    })
  }
})
