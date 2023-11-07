import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function showManageProjectorsModal () {
  // Show the modal for managing projectors.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/projectors/getConfiguration'
  })
    .then((result) => {
      populateManageProjectorModal(result.configuration)
    })

  $('#manageProjectorsEditMakeInput').hide()
  $('#manageProjectorsEditMakeInputLabel').hide()
  $('#manageProjectorsModal').modal('show')

  // Clear the input fields
  $('#manageProjectorsEditIDInput').val(null)
  $('#manageProjectorsEditGroupInput').val(null)
  $('#manageProjectorsEditProtocolSelect').val(null)
  $('#manageProjectorsEditIPInput').val(null)
  $('#manageProjectorsEditPasswordInput').val(null)
  $('#manageProjectorsEditMakeInput').val(null)
  $('#manageProjectorsModalSaveButton').hide()
}

function populateManageProjectorModal (list) {
  // Get a list of projector configs from Control Server and build a widget for each.

  $('#manageProjectorList').empty()
  list.forEach((entry) => {
    createManageProjectorEntry(entry)
  })
}

export function createManageProjectorEntry (entry) {
  // Take a dictionary and turn it into HTML elements

  const protocolNames = {
    pjlink: 'PJLink',
    serial: 'Serial'
  }

  // Create a new ID used only to track this projector through the edit process,
  // even if the actual ID is changed.
  const cleanID = String(new Date().getTime() + Math.round(1000000 * Math.random()))

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-12 mb-3 manageProjectorEntry'
  containerCol.setAttribute('id', 'manageProjector_' + cleanID)
  $(containerCol).data('config', entry)
  $('#manageProjectorList').append(containerCol)

  const containerRow = document.createElement('div')
  containerRow.classList = 'row'
  containerCol.appendChild(containerRow)

  const topCol = document.createElement('div')
  topCol.classList = 'col-12'
  containerRow.appendChild(topCol)

  const row1 = document.createElement('div')
  row1.classList = 'row'
  topCol.appendChild(row1)

  const titleCol = document.createElement('div')
  titleCol.classList = 'col-9 bg-primary'
  titleCol.setAttribute('id', 'manageProjectorID_' + cleanID)
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.style.overflowWrap = 'break-word'
  titleCol.innerHTML = entry.id
  row1.appendChild(titleCol)

  const editCol = document.createElement('div')
  editCol.classList = 'col-3 bg-info text-center handCursor py-1'
  editCol.setAttribute('id', 'manageProjectorEdit_' + cleanID)
  editCol.style.borderTopRightRadius = '0.25rem'
  editCol.innerHTML = 'Edit'
  $(editCol).click(function () {
    populateManageProjectorEdit(cleanID)
  })
  row1.appendChild(editCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const protocolCol = document.createElement('div')
  protocolCol.classList = 'col-5 col-sm-3 bg-secondary py-1 px-1 text-center'
  protocolCol.setAttribute('id', 'manageProjectorProtocol_' + cleanID)
  protocolCol.style.borderBottomLeftRadius = '0.25rem'
  protocolCol.innerHTML = protocolNames[entry.protocol]
  row2.appendChild(protocolCol)

  const ipCol = document.createElement('div')
  ipCol.classList = 'd-none d-sm-block col-sm-4 bg-secondary py-1 px-1 text-center'
  ipCol.setAttribute('id', 'manageProjectorIP_' + cleanID)
  ipCol.innerHTML = entry.ip_address
  row2.appendChild(ipCol)

  const groupCol = document.createElement('div')
  groupCol.classList = 'col-7 col-sm-5 bg-secondary py-1 px-1 text-center'
  groupCol.setAttribute('id', 'manageProjectorGroup_' + cleanID)
  groupCol.style.borderBottomRightRadius = '0.25rem'
  if ('group' in entry) {
    groupCol.innerHTML = entry.group
  } else {
    groupCol.innerHTML = 'Projectors'
  }
  row2.appendChild(groupCol)
}

function populateManageProjectorEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageProjector_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageProjectorsEditIDInput').data('id', id)

  $('#manageProjectorsEditIDInput').val(details.id)
  $('#manageProjectorsEditGroupInput').val(details.group)
  $('#manageProjectorsProtocolSelect').val(details.protocol)
  $('#manageProjectorsEditIPInput').val(details.ip_address)
  $('#manageProjectorsEditPasswordInput').val(details.password)
  $('#manageProjectorsEditMakeInput').val(details.make)

  if (details.protocol === 'pjlink') {
    $('#manageProjectorsEditPasswordInput').show()
    $('#manageProjectorsEditPasswordInputLabel').show()
    $('#manageProjectorsEditMakeInput').hide()
    $('#manageProjectorsEditMakeInputLabel').hide()
  } else {
    $('#manageProjectorsEditPasswordInput').hide()
    $('#manageProjectorsEditPasswordInputLabel').hide()
    $('#manageProjectorsEditMakeInput').show()
    $('#manageProjectorsEditMakeInputLabel').show()
  }
}

export function manageProjectorUpdateConfigFromEdit () {
  // Called when a change occurs in an edit field.
  // Update both the HTML and the config itself

  const id = $('#manageProjectorsEditIDInput').data('id')
  const details = $('#manageProjector_' + id).data('config')
  $('#manageProjectorsModalSaveButton').show() // Show the save button
  const protocolNames = {
    pjlink: 'PJLink',
    serial: 'Serial'
  }

  const newID = $('#manageProjectorsEditIDInput').val()
  $('#manageProjectorID_' + id).html(newID)
  details.id = newID

  const newGroup = $('#manageProjectorsEditGroupInput').val()
  if (newGroup != null && newGroup !== '') {
    $('#manageProjectorGroup_' + id).html(newGroup)
    details.group = newGroup
  } else {
    $('#manageProjectorGroup_' + id).html('Projectors')
  }

  const newProtocol = $('#manageProjectorsProtocolSelect').val()
  $('#manageProjectorProtocol_' + id).html(protocolNames[newProtocol])
  details.protocol = newProtocol
  if (details.protocol === 'pjlink') {
    $('#manageProjectorsEditPasswordInput').show()
    $('#manageProjectorsEditPasswordInputLabel').show()
    $('#manageProjectorsEditMakeInput').hide()
    $('#manageProjectorsEditMakeInputLabel').hide()
  } else {
    $('#manageProjectorsEditPasswordInput').hide()
    $('#manageProjectorsEditPasswordInputLabel').hide()
    $('#manageProjectorsEditMakeInput').show()
    $('#manageProjectorsEditMakeInputLabel').show()
  }

  const newIP = $('#manageProjectorsEditIPInput').val()
  $('#manageProjectorIP_' + id).html(newIP)
  details.ip_address = newIP

  const newMake = $('#manageProjectorsEditMakeInput').val()
  details.make = newMake

  const newPassword = $('#manageProjectorsEditPasswordInput').val()
  details.password = newPassword

  $('#manageProjector_' + id).data('config', details)
}

export function manageProjectorDeleteProjectorEntry () {
  // Called when the "Delete projector" button is clicked.
  // Remove the HTML entry from the listing

  const id = $('#manageProjectorsEditIDInput').data('id')
  $('#manageProjectorsModalSaveButton').show() // Show the save button
  $('#manageProjector_' + id).remove()

  // Clear the input fields
  $('#manageProjectorsEditIDInput').val(null)
  $('#manageProjectorsEditGroupInput').val(null)
  $('#manageProjectorsEditProtocolSelect').val(null)
  $('#manageProjectorsEditIPInput').val(null)
  $('#manageProjectorsEditPasswordInput').val(null)
  $('#manageProjectorsEditMakeInput').val(null)
}

export function updateProjectorConfigurationFromModal () {
  // Collect the dictionary from each projector element and send it to Control Server to save.

  const entries = $('.manageProjectorEntry')
  const listToSend = []
  entries.each((i, entry) => {
    listToSend.push($(entry).data('config'))
  })

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/projectors/updateConfiguration',
    params: { configuration: listToSend }
  })
    .then((result) => {
      $('#manageProjectorsModal').modal('hide')
    })
}

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

  // First, get the current projector configuration
  constTools.makeServerRequest({
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

      // Next, add the new element
      projConfig.push({
        group: document.getElementById('addProjectorModalGroupField').value,
        id: document.getElementById('addProjectorModalIDField').value,
        ip_address: document.getElementById('addProjectorModalIPField').value,
        password: document.getElementById('addProjectorModalPasswordField').value,
        protocol: 'pjlink'
      })

      // Finally, send the configuration back for writing
      constTools.makeServerRequest({
        method: 'POST',
        endpoint: '/system/projectors/updateConfiguration',
        params: {
          configuration: projConfig
        }
      })
        .then((response) => {
          $('#addProjectorModal').modal('hide')
        })
    })
}
