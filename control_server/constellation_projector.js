import constConfig from './config.js'
import * as constTools from './constellation_tools.js'
import * as constExhibit from './constellation_exhibit.js'

export class Projector {
  constructor (id, type) {
    this.id = id
    this.type = type
    this.ip = ''
    this.state = {}
    this.status = constConfig.STATUS.OFFLINE
    this.lastContactDateTime = null
    this.allowed_actions = []

    this.checkProjector()
    const thisInstance = this
    this.pollingFunction = setInterval(function () { thisInstance.checkProjector() }, 5000)
  }

  checkProjector () {
    // Function to ask the server to ping the projector
    const thisInstance = this

    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/projector/getUpdate',
      params: {
        projector: {
          id: this.id
        }
      }
    })
      .then((response) => {
        if ('success' in response) {
          if (response.success === false) {
            if ('status' in response && response.status === 'DELETE') {
              thisInstance.remove()
            } else {
              console.log('checkProjector: Error:', response.reason)
            }
          } else {
            if ('state' in response) {
              const state = response.state
              thisInstance.setStatus(state.status)
              if ('model' in state) {
                thisInstance.state.model = state.model
              }
              if ('power_state' in state) {
                thisInstance.state.power_state = state.power_state
              }
              if ('lamp_status' in state) {
                thisInstance.state.lamp_status = state.lamp_status
              }
              if ('error_status' in state) {
                thisInstance.state.error_status = state.error_status
                const errorList = {}
                Object.keys(state.error_status).forEach((item, i) => {
                  if ((state.error_status)[item] !== 'ok') {
                    errorList[item] = (state.error_status)[item]
                  }
                })
                constConfig.errorDict[thisInstance.id] = errorList
                constTools.rebuildErrorList()
              }
            }
          }
        }
      })
  }

  setStatus (status) {
    this.status = constConfig.STATUS[status]
    $('#' + this.id + 'StatusField').html(this.status.name)

    const btnClass = this.status.colorClass
    // Strip all existing classes, then add the new one
    $('#' + this.id + 'MainButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
    $('#' + this.id + 'DropdownButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
  }

  buildHTML () {
    // Function to build the HTML representation of this component
    // and add it to the row of the parent group

    // If the element is static and the 'Show STATIC' checkbox is ticked, bail out
    if (this.status === constConfig.STATUS.STATIC && $('#componentsTabSettingsShowStatic').prop('checked') === false) {
      return
    }

    const displayName = this.id
    const thisId = this.id

    // Change the amount of the Bootstrap grid being used depending on the
    // number of components in this group. Larger groups get more horizontal
    // space, so each component needs a smaller amount of grid.
    let classString
    if (constExhibit.getExhibitComponentGroup(this.type).components.length > 7) {
      classString = 'col-12 col-sm-4 col-md-3 mt-1'
    } else {
      classString = 'col-12 col-sm-4 col-md-6 mt-1'
    }

    const col = document.createElement('div')
    col.classList = classString

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group btn-block h-100 w-100'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn btn-block componentStatusButton ' + this.status.colorClass
    mainButton.setAttribute('type', 'button')
    mainButton.setAttribute('id', this.id + 'MainButton')
    mainButton.addEventListener('click', function () {
      showProjectorInfo(thisId)
    }, false)
    btnGroup.appendChild(mainButton)

    const displayNameEl = document.createElement('H5')
    displayNameEl.innerHTML = displayName
    mainButton.appendChild(displayNameEl)

    const statusFieldEl = document.createElement('div')
    statusFieldEl.setAttribute('id', this.id + 'StatusField')
    statusFieldEl.innerHTML = this.status.name
    mainButton.appendChild(statusFieldEl)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn dropdown-toggle dropdown-toggle-split ' + this.status.colorClass
    dropdownButton.setAttribute('id', this.id + 'DropdownButton')
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-haspopup', 'true')
    dropdownButton.setAttribute('aria-expanded', 'false')
    btnGroup.appendChild(dropdownButton)

    const dropdownLabel = document.createElement('span')
    dropdownLabel.classList = 'sr-only'
    dropdownLabel.innerHTML = 'Toggle Dropdown'
    dropdownButton.appendChild(dropdownLabel)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    btnGroup.appendChild(dropdownMenu)

    let numOptions = 0
    this.allowed_actions.forEach((action) => {
      const option = document.createElement('a')
      option.classList = 'dropdown-item handCursor'

      let cmd
      numOptions += 1
      if (action === 'refresh') {
        option.innerHTML = 'Refresh Component'
        cmd = 'refresh_page'
      } else if (action === 'restart') {
        option.innerHTML = 'Restart component'
        numOptions += 1
        cmd = 'restart'
      } else if (action === 'shutdown' || action === 'power_off') {
        option.innerHTML = 'Sleep projector'
        cmd = 'sleepDisplay'
      } else if (action === 'power_on') {
        option.innerHTML = 'Wake projector'
        cmd = 'power_on'
      } else if (action === 'sleep') {
        option.innerHTML = 'Wake display'
        cmd = 'wakeDisplay'

        const option2 = document.createElement('a')
        option2.classList = 'dropdown-item handCursor'
        option2.innerHTML = 'Sleep display'
        option2.addEventListener('click', function () {
          constExhibit.queueCommand(thisId, 'sleepDisplay')
        }, false)
        dropdownMenu.appendChild(option2)
      } else {
        numOptions -= 1
      }

      option.addEventListener('click', function () {
        constExhibit.queueCommand(thisId, cmd)
      }, false)
      dropdownMenu.appendChild(option)
    })

    if (numOptions === 0) {
      const option = document.createElement('a')
      option.classList = 'dropdown-item handCursor'
      option.innerHTML = 'No available actions'
      dropdownMenu.appendChild(option)
    }

    $('#' + this.type + 'ComponentList').append(col)
  }
}

export function showManageProjectorsModal () {
  // Show the modal for managing projectors.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/getProjectorConfiguration'
  })
    .then((result) => {
      populateManageProjectorModal(result.configuration)
    })

  $('#manageProjectorsEditMakeInput').hide()
  $('#manageProjectorsEditMakeInputLabel').hide()
  $('#manageProjectorsModal').modal('show')

  // Clear the input fields
  $('#manageProjectorsEditIDInput').val(null)
  $('#manageProjectorsEditTypeInput').val(null)
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
  titleCol.innerHTML = entry.id
  row1.appendChild(titleCol)

  const editCol = document.createElement('div')
  editCol.classList = 'col-3 bg-info text-center handCursor py-1 h-100'
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
  protocolCol.classList = 'col-5 col-md-3 bg-secondary py-1 px-1 text-center'
  protocolCol.setAttribute('id', 'manageProjectorProtocol_' + cleanID)
  protocolCol.style.borderBottomLeftRadius = '0.25rem'
  protocolCol.innerHTML = protocolNames[entry.protocol]
  row2.appendChild(protocolCol)

  const ipCol = document.createElement('div')
  ipCol.classList = 'd-none d-sm-flex col-md-4 bg-secondary py-1 px-1 text-center'
  ipCol.setAttribute('id', 'manageProjectorIP_' + entry.id)
  ipCol.innerHTML = entry.ip_address
  row2.appendChild(ipCol)

  const typeCol = document.createElement('div')
  typeCol.classList = 'col-7 col-md-5 bg-secondary py-1 px-1 text-center'
  typeCol.setAttribute('id', 'manageProjectorType_' + cleanID)
  typeCol.style.borderBottomRightRadius = '0.25rem'
  if ('type' in entry) {
    typeCol.innerHTML = entry.type
  } else {
    typeCol.innerHTML = 'PROJECTOR'
  }
  row2.appendChild(typeCol)
}

function populateManageProjectorEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageProjector_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageProjectorsEditIDInput').data('id', id)

  $('#manageProjectorsEditIDInput').val(details.id)
  $('#manageProjectorsEditTypeInput').val(details.type)
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

  const newType = $('#manageProjectorsEditTypeInput').val()
  if (newType != null && newType !== '') {
    $('#manageProjectorType_' + id).html(newType)
    details.type = newType
  } else {
    $('#manageProjectorType_' + id).html('PROJECTOR')
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
    endpoint: '/system/updateProjectorConfiguration',
    params: { configuration: listToSend }
  })
    .then((result) => {
      $('#manageProjectorsModal').modal('hide')
    })
}

export function updateProjectorFromServer (projector) {
  // Read the dictionary of projector information from the control server
  // and use it to set up the projector

  const obj = constExhibit.getExhibitComponent(projector.id)
  if (obj != null) {
    // Update the object with the latest info from the server
    obj.setStatus(projector.status)
    if ('ip_address' in projector) {
      obj.ip = projector.ip_address
    }
    if ('allowed_actions' in projector) {
      obj.allowed_actions = projector.allowed_actions
    }
    if ('description' in projector) {
      obj.description = projector.description
    }
    if ('lastContactDateTime' in projector) {
      obj.lastContactDateTime = projector.lastContactDateTime
    }
    if ('error' in projector) {
      try {
        const newError = JSON.parse(projector.error)
        constConfig.errorDict[obj.id] = newError
      } catch (e) {
        console.log("Error parsing 'error' field from ping. It should be a stringified JSON expression. Received:", projector.error)
        console.log(e)
      }
      constTools.rebuildErrorList()
    }
  } else {
    // First, make sure the group matching this type exists
    let group = constExhibit.getExhibitComponentGroup(projector.type)
    if (group == null) {
      group = new constExhibit.ExhibitComponentGroup(projector.type)
      constConfig.componentGroups.push(group)
    }

    // Then create a new component
    const newProjector = new Projector(projector.id, projector.type)
    newProjector.setStatus(projector.status)
    if ('allowed_actions' in projector) {
      newProjector.allowed_actions = projector.allowed_actions
    }
    newProjector.buildHTML()
    constConfig.exhibitComponents.push(newProjector)

    // Add the component to the right group
    group.addComponent(newProjector)

    // Finally, call this function again to populate the information
    updateProjectorFromServer(projector)
  }
}

export function showProjectorInfo (id) {
  // Set up the projectorInfoModal with the info from the selected
  // projector and shows it on the screen.

  const obj = constExhibit.getExhibitComponent(id)

  // First, reset all the cell shadings
  $('#projectorInfoLampState').parent().removeClass()
  $('#projectorInfoFanState').parent().removeClass()
  $('#projectorInfoFilterState').parent().removeClass()
  $('#projectorInfoCoverState').parent().removeClass()
  $('#projectorInfoOtherState').parent().removeClass()
  $('#projectorInfoTempState').parent().removeClass()

  // Set the title to the ID
  $('#projectorInfoModalTitle').html(id)
  $('#projectorInfoModalIPAddress').html(obj.ip)
  if (obj.description === '') {
    $('#projectorInfoModalDescription').hide()
  } else {
    $('#projectorInfoModalDescription').html(obj.description)
    $('#projectorInfoModalDescription').show()
  }

  // Then, go through and populate all the cells with as much information
  // as we have. Shade cells red if an error is reported.
  if ('power_state' in obj.state && obj.state.power_state !== '') {
    $('#projectorInfoPowerState').html(obj.state.power_state)
  } else {
    $('#projectorInfoPowerState').html('-')
  }
  if (('error_status' in obj.state) && (obj.state.error_status.constructor === Object)) {
    if ('lamp' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoLampState').html(obj.state.error_status.lamp)
      // Shade if error
      if (obj.state.error_status.lamp === 'error') {
        $('#projectorInfoLampState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoLampState').html('-')
    }
    if ('fan' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoFanState').html(obj.state.error_status.fan)
      // Shade if error
      if (obj.state.error_status.fan === 'error') {
        $('#projectorInfoFanState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoFanState').html('-')
    }
    if ('filter' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoFilterState').html(obj.state.error_status.filter)
      // Shade if error
      if (obj.state.error_status.filter === 'error') {
        $('#projectorInfoFilterState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoFilterState').html('-')
    }
    if ('cover' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoCoverState').html(obj.state.error_status.cover)
      // Shade if error
      if (obj.state.error_status.cover === 'error') {
        $('#projectorInfoCoverState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoCoverState').html('-')
    }
    if ('other' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoOtherState').html(obj.state.error_status.other)
      // Shade if error
      if (obj.state.error_status.other === 'error') {
        $('#projectorInfoOtherState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoOtherState').html('-')
    }
    if ('temperature' in obj.state.error_status) {
      // Populate cell
      $('#projectorInfoTempState').html(obj.state.error_status.temperature)
      // Shade if error
      if (obj.state.error_status === 'error') {
        $('#projectorInfoTempState').parent().addClass('table-danger')
      }
    } else {
      $('#projectorInfoTempState').html('-')
    }
  } else {
    $('#projectorInfoLampState').html('-')
    $('#projectorInfoFanState').html('-')
    $('#projectorInfoFilterState').html('-')
    $('#projectorInfoCoverState').html('-')
    $('#projectorInfoOtherState').html('-')
    $('#projectorInfoTempState').html('-')
  }
  if ('model' in obj.state) {
    $('#projectorInfoModel').html(obj.state.model)
  } else {
    $('#projectorInfoModel').html('-')
  }

  let lampHTML = ''
  if ('lamp_status' in obj.state && obj.state.lamp_status !== '') {
    const lampList = obj.state.lamp_status

    for (let i = 0; i < lampList.length; i++) {
      const lamp = lampList[i]
      let statusStr = ''
      if (lamp[1] === false) {
        statusStr = '(off)'
      } else if (lamp[1] === true) {
        statusStr = '(on)'
      } else {
        statusStr = ''
      }
      lampHTML += `Lamp ${i + 1} ${statusStr}: ${lamp[0]} hours<br>`
    }
  } else {
    lampHTML = '-'
  }
  $('#projectorInfoLampHours').html(lampHTML)

  // Make the modal visible
  $('#projectorInfoModal').modal('show')
}
