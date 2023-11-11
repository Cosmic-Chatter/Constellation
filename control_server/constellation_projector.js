import * as constTools from './constellation_tools.js'

export function showAddProjectorModal () {
  // Prepare the modal for adding static components and show it.

  // Reset values
  document.getElementById('addProjectorModalIDField').value = ''
  document.getElementById('addProjectorModalGroupField').value = ''

  // Hide warnings
  document.getElementById('addProjectorModalIDError').style.display = 'none'
  document.getElementById('addProjectorModalGroupError').style.display = 'none'
  document.getElementById('addProjectorModalIPError').style.display = 'none'

  $('#addProjectorModal').modal('show')
}

export function submitProjectorAdditionFromModal () {
  // Set up a new projector from the components tab modal

  // Check that the fields are properly filled out
  const group = document.getElementById('addProjectorModalGroupField').value.trim()
  const id = document.getElementById('addProjectorModalIDField').value.trim()
  const ipAddress = document.getElementById('addProjectorModalIPField').value.trim()

  if (id === '') {
    document.getElementById('addProjectorModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalIDError').style.display = 'none'
  }
  if (group === '') {
    document.getElementById('addProjectorModalGroupError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalGroupError').style.display = 'none'
  }
  if (ipAddress === '') {
    document.getElementById('addProjectorModalIPError').style.display = 'block'
    return
  } else {
    document.getElementById('addProjectorModalIPError').style.display = 'none'
  }

  submitProjectorChange(id, {
    group,
    id,
    ip_address: ipAddress,
    password: document.getElementById('addProjectorModalPasswordField').value,
    protocol: 'pjlink'
  })
    .then(() => {
      $('#addProjectorModal').modal('hide')
    })
}

export function submitProjectorChange (currentID, update) {
  // Modify the projector settings conifguration with the given details

  if ('protocol' in update === false) update.protocol = 'pjlink'

  // First, get the current projector configuration
  return constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/projectors/getConfiguration'
  })
    .then((result) => {
      let projConfig
      if (result.success === true) {
        projConfig = result.configuration
      } else {
        projConfig = []
      }

      // Next, check if there is a configuration matching this id
      let matchFound = false
      for (let i = 0; i < projConfig.length; i++) {
        if (projConfig[i].id === currentID) {
          projConfig[i].id = update.id
          projConfig[i].group = update.group
          projConfig[i].ip_address = update.ip_address
          projConfig[i].password = update.password
          projConfig[i].protocol = update.protocol
          matchFound = true
          break
        }
      }
      if (matchFound === false) {
        projConfig.push(update)
      }

      // Finally, send the configuration back for writing
      constTools.makeServerRequest({
        method: 'POST',
        endpoint: '/system/projectors/updateConfiguration',
        params: {
          configuration: projConfig
        }
      })
    })
}
