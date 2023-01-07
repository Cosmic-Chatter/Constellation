import * as constCommon from '../js/constellation_app_common.js'

function updateFunc (update) {
  // Read updates for media player-specific actions and act on them

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]
    }
  }

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    // console.log(update.content)
  }
}

function getDMXConfiguration () {
  // Ask the helper for the current DMX configuration and update the interface.

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/getConfiguration'
  })
    .then((response) => {
      console.log(response.configuration)
    })
}

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.constellationAppID = 'dmx_control'

constCommon.config.debug = true

constCommon.config.helperAddress = window.location.origin

constCommon.askForDefaults()
constCommon.checkForSoftwareUpdate()
constCommon.sendPing()

setInterval(constCommon.sendPing, 5000)
setInterval(constCommon.checkForHelperUpdates, 5000)

getDMXConfiguration()
