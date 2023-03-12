import constConfig from './config.js'
import * as constTools from './constellation_tools.js'
import * as constMaint from './constellation_maintenance.js'

class BaseComponent {
  // A basic Constellation component.

  constructor (id, group) {
    this.id = id
    this.group = group
    this.type = 'base_component'

    this.status = constConfig.STATUS.OFFLINE
    this.allowed_actions = []

    this.ip_address = null
    this.latency = null
    this.lastContactDateTime = null
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
    const cleanId = this.id.replaceAll(' ', '_')

    // Change the amount of the Bootstrap grid being used depending on the
    // number of components in this group. Larger groups get more horizontal
    // space, so each component needs a smaller amount of grid.
    let classString
    if (getExhibitComponentGroup(this.group).components.length > 7) {
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
    mainButton.setAttribute('id', cleanId + 'MainButton')
    mainButton.addEventListener('click', function () {
      showExhibitComponentInfo(thisId)
    }, false)
    btnGroup.appendChild(mainButton)

    const displayNameEl = document.createElement('H5')
    displayNameEl.innerHTML = displayName
    mainButton.appendChild(displayNameEl)

    const statusFieldEl = document.createElement('div')
    statusFieldEl.setAttribute('id', cleanId + 'StatusField')
    statusFieldEl.innerHTML = this.status.name
    mainButton.appendChild(statusFieldEl)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn dropdown-toggle dropdown-toggle-split ' + this.status.colorClass
    dropdownButton.setAttribute('id', cleanId + 'DropdownButton')
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
    dropdownMenu.setAttribute('id', cleanId + 'DropdownMenu')
    this.populateActionMenu(dropdownMenu)
    btnGroup.appendChild(dropdownMenu)

    $('#' + this.group.replaceAll(' ', '_') + 'ComponentList').append(col)
  }

  populateActionMenu (dropdownMenu = null) {
    // Build out the dropdown menu options based on the this.allowed_actions.

    if (dropdownMenu == null) {
      const cleanID = this.id.replaceAll(' ', '_')
      dropdownMenu = document.getElementById(cleanID + 'DropdownMenu')
    }
    $(dropdownMenu).empty()
    const thisId = this.id

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
        option.innerHTML = 'Sleep component'
        cmd = 'shutdown'
      } else if (action === 'power_on') {
        option.innerHTML = 'Wake component'
        cmd = 'power_on'
      } else if (action === 'sleep') {
        option.innerHTML = 'Wake display'
        cmd = 'wakeDisplay'

        const option2 = document.createElement('a')
        option2.classList = 'dropdown-item handCursor'
        option2.innerHTML = 'Sleep display'
        option2.addEventListener('click', function () {
          queueCommand(thisId, 'sleepDisplay')
        }, false)
        dropdownMenu.appendChild(option2)
      } else {
        numOptions -= 1
      }

      option.addEventListener('click', function () {
        queueCommand(thisId, cmd)
      }, false)
      dropdownMenu.appendChild(option)
    })

    if (numOptions === 0) {
      const option = document.createElement('a')
      option.classList = 'dropdown-item handCursor'
      option.innerHTML = 'No available actions'
      dropdownMenu.appendChild(option)
    }
  }

  remove () {
    // Remove the component from its ComponentGroup
    getExhibitComponentGroup(this.group).removeComponent(this.id)
    // Remove the component from the exhibitComponents list
    const thisInstance = this
    constConfig.exhibitComponents = $.grep(constConfig.exhibitComponents, function (el, idx) { return el.id === thisInstance.id }, true)
    // Cancel the pollingFunction
    clearInterval(this.pollingFunction)
    // Rebuild the interface
    rebuildComponentInterface()
  }

  setAllowedActions (actions) {
    // Set the compnent's allowed actions and then rebuild the action list

    this.allowed_actions = actions
    this.populateActionMenu()
  }

  setStatus (status) {
    // Set the component's status and change the GUI to reflect the change.

    const cleanId = this.id.replaceAll(' ', '_')

    this.status = constConfig.STATUS[status]
    $('#' + cleanId + 'StatusField').html(this.status.name)

    const btnClass = this.status.colorClass
    // Strip all existing classes, then add the new one
    $('#' + cleanId + 'MainButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
    $('#' + cleanId + 'DropdownButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
  }

  updateFromServer (update) {
    // Use a dictionary of values from Control Server to update this component.

    this.setStatus(update.status)

    if ('ip_address' in update) {
      this.ip_address = update.ip_address
    }
    if ('allowed_actions' in update) {
      if (constTools.arraysEqual(this.allowed_actions, update.allowed_actions) === false) {
        this.setAllowedActions(update.allowed_actions)
      }
    }
    if ('description' in update) {
      this.description = update.description
    }
    if ('latency' in update) {
      this.latency = update.latency
    }
    if ('lastContactDateTime' in update) {
      this.lastContactDateTime = update.lastContactDateTime
    }
    if ('error' in update) {
      try {
        const newError = JSON.parse(update.error)
        constConfig.errorDict[this.id] = newError
      } catch (e) {
        console.log("Error parsing 'error' field from ping. It should be a stringified JSON expression. Received:", update.error)
        console.log(e)
      }
      constTools.rebuildNotificationList()
    }
  }
}

class ExhibitComponent extends BaseComponent {
  // A component representing an device running a Constellation App or using the API

  constructor (id, group) {
    super(id, group)

    this.type = 'exhibit_component'
    this.content = null
    this.helperAddress = null
    this.state = {}
    this.AnyDeskID = ''
    this.constellationAppId = ''
    this.platformDetails = {}
  }

  getHelperURL () {
    // Return the url for the helper of this component.

    return this.helperAddress
  }

  updateFromServer (update) {
    // Extend parent update to include exhibit component-specific items

    super.updateFromServer(update)

    if ('AnyDeskID' in update) {
      this.AnyDeskID = update.AnyDeskID
    }
    if ('autoplay_audio' in update) {
      this.autoplay_audio = update.autoplay_audio
    }
    if ('constellation_app_id' in update) {
      this.constellationAppId = update.constellation_app_id
    }
    if ('content' in update) {
      this.content = update.content
    }
    if ('definition' in update) {
      this.definition = update.definition
    }
    if ('helperAddress' in update) {
      this.helperAddress = update.helperAddress
    }
    if ('image_duration' in update) {
      this.image_duration = update.image_duration
    }
    if ('platform_details' in update) {
      this.platformDetails = update.platform_details
    }
  }
}

export class WakeOnLANComponent extends BaseComponent {
  // A component representings a Wake on LAN device

  constructor (id, group) {
    super(id, group)

    this.type = 'wol_component'
    this.constellationAppId = 'wol_only'
  }
}

class Projector extends BaseComponent {
  // A component representing a projector

  constructor (id, group) {
    super(id, group)

    this.type = 'projector'
    this.constellationAppId = 'projector'
    this.protocol = null // 'pjlink' or 'serial'
    this.state = {}
  }

  updateFromServer (update) {
    // Extend parent method for proejctor-specific items

    super.updateFromServer(update)

    if ('state' in update) {
      const state = update.state
      if ('model' in state) {
        this.state.model = state.model
      }
      if ('power_state' in state) {
        this.state.power_state = state.power_state
      }
      if ('lamp_status' in state) {
        this.state.lamp_status = state.lamp_status
      }
      if ('error_status' in state) {
        this.state.error_status = state.error_status
        const errorList = {}
        Object.keys(state.error_status).forEach((item, i) => {
          if ((state.error_status)[item] !== 'ok') {
            errorList[item] = (state.error_status)[item]
          }
        })
        constConfig.errorDict[this.id] = errorList
        constTools.rebuildNotificationList()
      }
    }
    if ('protocol' in update) {
      this.protocol = update.protocol
    }
  }
}

class ExhibitComponentGroup {
  constructor (group) {
    this.type = 'component_group'
    this.group = group
    this.components = []
    this.buildHTML()
  }

  addComponent (component) {
    this.components.push(component)
    this.sortComponentList()
    rebuildComponentInterface()
  }

  sortComponentList () {
    // Sort the component list by ID and then rebuild the HTML
    // representation in order

    this.components.sort(
      function (a, b) {
        if (a.status === constConfig.STATUS.STATIC && b.status !== constConfig.STATUS.STATIC) {
          return 1
        } else if (b.status === constConfig.STATUS.STATIC && a.status !== constConfig.STATUS.STATIC) {
          return -1
        }
        if (a.status.value > b.status.value) {
          return -1
        } else if (b.status.value > a.status.value) {
          return 1
        } else if (a.id > b.id) {
          return 1
        } else if (b.id > a.id) {
          return -1
        }
        return 0
      }
    )
  }

  removeComponent (id) {
    // Remove a component based on its id

    this.components = $.grep(this.components, function (el, idx) { return el.id === id }, true)

    // If the group now has seven components, make sure we're using the small
    // size rendering now by rebuilding the interface
    if (this.components.length === 7) {
      rebuildComponentInterface()
    }
  }

  buildHTML () {
    // Function to build the HTML representation of this group
    // and add it to the componentGroupsRow

    let onCmdName = ''
    let offCmdName = ''
    const thisGroup = this.group
    if (this.group === 'projector') {
      onCmdName = 'power_on'
      offCmdName = 'sleepDisplay'
    } else {
      onCmdName = 'wakeDisplay'
      offCmdName = 'sleepDisplay'
    }
    let displayRefresh = 'block'
    if (thisGroup === 'WAKE_ON_LAN') {
      displayRefresh = 'none'
    }

    // Cycle through the components and count how many we will actually be displaying
    const showStatic = $('#componentsTabSettingsShowStatic').prop('checked')
    let numToDisplay = 0
    this.components.forEach((component) => {
      if (showStatic || component.status !== constConfig.STATUS.STATIC) {
        numToDisplay += 1
      }
    })

    if (numToDisplay === 0) {
      // Nothing to do
      return
    }

    // Allow groups with lots of components to display with double width
    let classString
    if (numToDisplay > 7) {
      classString = 'col-12 col-lg-8 col-xl-6 mt-4'
    } else {
      classString = 'col-12 col-md-6 col-lg-4 col-xl-3 mt-4'
    }

    const col = document.createElement('div')
    col.classList = classString

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group btn-block'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn btn-secondary btn-block btn-lg'
    mainButton.setAttribute('type', 'button')
    mainButton.innerHTML = this.group
    btnGroup.appendChild(mainButton)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn btn-secondary dropdown-toggle dropdown-toggle-split'
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-haspopup', 'true')
    dropdownButton.setAttribute('aria-expanded', 'false')
    btnGroup.appendChild(dropdownButton)

    const srHint = document.createElement('span')
    srHint.classList = 'sr-only'
    srHint.innerHTML = 'Toggle Dropdown'
    dropdownButton.appendChild(srHint)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    btnGroup.appendChild(dropdownMenu)

    const refreshOption = document.createElement('a')
    refreshOption.classList = 'dropdown-item handCursor'
    refreshOption.style.display = displayRefresh
    refreshOption.innerHTML = 'Refresh all components'
    refreshOption.addEventListener('click', function () {
      sendGroupCommand(thisGroup, 'refresh_page')
    }, false)
    dropdownMenu.appendChild(refreshOption)

    const wakeOption = document.createElement('a')
    wakeOption.classList = 'dropdown-item handCursor'
    wakeOption.innerHTML = 'Wake all components'
    wakeOption.addEventListener('click', function () {
      sendGroupCommand(thisGroup, onCmdName)
    }, false)
    dropdownMenu.appendChild(wakeOption)

    const sleepOption = document.createElement('a')
    sleepOption.classList = 'dropdown-item handCursor'
    sleepOption.innerHTML = 'Sleep all components'
    sleepOption.addEventListener('click', function () {
      sendGroupCommand(thisGroup, offCmdName)
    }, false)
    dropdownMenu.appendChild(sleepOption)

    const componentList = document.createElement('div')
    componentList.classList = 'row'
    componentList.setAttribute('id', thisGroup.replaceAll(' ', '_') + 'ComponentList')
    col.appendChild(componentList)

    $('#componentGroupsRow').append(col)

    this.components.forEach((component) => {
      component.buildHTML()
    })
  }
}

export function createComponentFromUpdate (update) {
  // Use an update dictionary to create a new component

  // Make sure this component doesn't already exist
  const obj = getExhibitComponent(update.id)
  if (obj != null) return

  // First, make sure the group matching this group exists
  let group = getExhibitComponentGroup(update.group)
  if (group == null) {
    group = new ExhibitComponentGroup(update.group)
    constConfig.componentGroups.push(group)
  }

  // Then create a new component
  let newComponent
  if (update.class === 'exhibitComponent') {
    newComponent = new ExhibitComponent(update.id, update.group)
  } else if (update.class === 'wolComponent') {
    newComponent = new WakeOnLANComponent(update.id, update.group)
  } else if (update.class === 'projector') {
    newComponent = new Projector(update.id, update.group)
  }

  newComponent.buildHTML()
  constConfig.exhibitComponents.push(newComponent)

  // Add the component to the right group
  group.addComponent(newComponent)

  // Finally, update the new component
  newComponent.updateFromServer(update)
}

export function updateComponentFromServer (update) {
  // Read the dictionary of component information from the control server
  // and use it to set up the component

  const obj = getExhibitComponent(update.id)
  if (obj != null) {
    // Update the object with the latest info from the server
    obj.updateFromServer(update)
  } else {
    createComponentFromUpdate(update)
  }
}

export function sendGroupCommand (group, cmd) {
  // Iterate through the components in the given group and queue the command
  // for each

  group = getExhibitComponentGroup(group)
  console.log(group, cmd)
  for (let i = 0; i < group.components.length; i++) {
    queueCommand(group.components[i].id, cmd)
  }
}

export function getExhibitComponentGroup (group) {
  // Function to search the componentGroups list for a given group id

  const result = constConfig.componentGroups.find(obj => {
    return obj.group === group
  })
  return result
}

export function showExhibitComponentInfo (id) {
  // This sets up the componentInfoModal with the info from the selected
  // component and shows it on the screen.

  if (id === '') {
    id = $('#componentInfoModalTitle').html()
  }
  $('#componentInfoModal').data('id', id)

  const obj = getExhibitComponent(id)

  $('#componentInfoModalTitle').html(id)

  // Set up the upper-right dropdown menu with helpful details
  $('#constellationComponentIdButton').html(convertAppIDtoDisplayName(obj.constellationAppId))
  if (obj.ip_address != null) {
    $('#componentInfoModalIPAddress').html(obj.ip_address)
    $('#componentInfoModalIPAddressGroup').show()
  } else {
    $('#componentInfoModalIPAddressGroup').hide()
  }
  if (obj.ip_address != null &&
      constTools.extractIPAddress(obj.helperAddress) != null &&
      obj.ip_address !== constTools.extractIPAddress(obj.helperAddress)
  ) {
    $('#componentInfoModalHelperIPAddress').html(constTools.extractIPAddress(obj.helperAddress))
    $('#componentInfoModalHelperIPAddressGroup').show()
  } else {
    $('#componentInfoModalHelperIPAddressGroup').hide()
  }
  if ('platformDetails' in obj) {
    if ('operating_system' in obj.platformDetails) {
      $('#componentInfoModalOperatingSystem').html(obj.platformDetails.operating_system.replace('OS X', 'macOS'))
      $('#componentInfoModalOperatingSystemGroup').show()
    } else {
      $('#componentInfoModalOperatingSystemGroup').hide()
    }
    if ('browser' in obj.platformDetails) {
      $('#componentInfoModalBrowser').html(obj.platformDetails.browser)
      $('#componentInfoModalBrowserGroup').show()
    } else {
      $('#componentInfoModalBrowserGroup').hide()
    }
  } else {
    $('#componentInfoModalOperatingSystemGroup').hide()
    $('#componentInfoModalBrowserGroup').hide()
  }
  if ('protocol' in obj && obj.protocol != null) {
    const protocolNames = {
      pjlink: 'PJLink',
      serial: 'Serial'
    }
    $('#componentInfoModalProtocol').html(protocolNames[obj.protocol])
    $('#componentInfoModalProtocolGroup').show()
  } else {
    $('#componentInfoModalProtocolGroup').hide()
  }
  if (obj.latency != null) {
    $('#componentInfoModalLatency').html(String(obj.latency) + ' ms')
    $('#componentInfoModalLatencyGroup').show()
  } else {
    $('#componentInfoModalLatencyGroup').hide()
  }
  if (obj.lastContactDateTime != null) {
    $('#componentInfoModalLastContact').html(constTools.formatDateTimeDifference(new Date(), new Date(obj.lastContactDateTime)))
    $('#componentInfoModalLastContactGroup').show()
  } else {
    $('#componentInfoModalLastContactGroup').hide()
  }
  if (obj.type === 'exhibit_component' && obj.status !== constConfig.STATUS.STATIC) {
    // This is an active component, so add a remove button
    $('#componentInfoModalRemoveButtonGroup').show()
  } else {
    $('#componentInfoModalRemoveButtonGroup').hide()
  }

  // Add any available description
  if (obj.description === '') {
    $('#componentInfoModalDescription').hide()
  } else {
    $('#componentInfoModalDescription').html(obj.description)
    $('#componentInfoModalDescription').show()
  }
  // Show/hide warnings and checkboxes as appropriate
  $('#componentInfoModalThumbnailCheckbox').prop('checked', true)
  $('#componentAvailableContentList').empty()
  $('#contentUploadSubmitButton').prop('disabled', false)
  $('#contentUploadSubmitButton').html('Upload')
  $('#componentContentUploadfilename').html('Choose file')
  $('#componentContentUpload').val(null)
  $('#contentUploadSubmitButton').hide()
  $('#contentUploadEqualSignWarning').hide()
  $('#uploadOverwriteWarning').hide()
  $('#contentUploadProgressBarContainer').hide()
  $('#contentUploadSystemStatsView').hide()
  $('#componentInfoConnectingNotice').show()
  $('#componentInfoConnectionStatusFailed').hide()
  $('#componentInfoConnectionStatusInPrograss').show()
  $('#componentSaveConfirmationButton').hide()
  $('#componentAvailableContentRow').hide()
  $('#componentcontentUploadInterface').hide()
  $('#componentInfoModalDefinitionSaveButton').hide()
  constMaint.setComponentInfoModalMaintenanceStatus(id)

  if ('AnyDeskID' in obj && obj.AnyDeskID !== '') {
    $('#AnyDeskButton').prop('href', 'anydesk:' + obj.AnyDeskID)
    $('#AnyDeskLabel').prop('href', 'anydesk:' + obj.AnyDeskID)
    $('#AnyDeskLabel').html('AnyDesk ID: ' + obj.AnyDeskID)
    $('#AnyDeskButton').prop('title', String(obj.AnyDeskID))
    $('#AnyDeskButton').addClass('d-sm-none d-none d-md-inline').show()
    $('#AnyDeskLabel').addClass('d-sm-inline d-md-none').show()
  } else {
    $('#AnyDeskButton').removeClass('d-sm-none d-none d-md-inline').hide()
    $('#AnyDeskLabel').removeClass('d-sm-inline d-md-none').hide()
  }

  // Configure the settings page with the current settings
  $('#componentInfoModalSettingsAppName').val(obj.constellationAppId)
  $('#componentInfoModalFullSettingsButton').prop('href', obj.helperAddress + '?showSettings=true')
  $('#componentInfoModalSettingsAllowRefresh').prop('checked', obj.allowed_actions.includes('refresh'))
  $('#componentInfoModalSettingsAllowRestart').prop('checked', obj.allowed_actions.includes('restart'))
  $('#componentInfoModalSettingsAllowShutdown').prop('checked', obj.allowed_actions.includes('shutdown'))
  $('#componentInfoModalSettingsAllowSleep').prop('checked', obj.allowed_actions.includes('sleep'))
  if ('AnyDeskID' in obj) {
    $('#componentInfoModalSettingsAnyDeskID').val(obj.AnyDeskID)
  } else {
    $('#componentInfoModalSettingsAnyDeskID').val('')
  }
  if ('autoplay_audio' in obj) {
    $('#componentInfoModalSettingsAutoplayAudio').prop('checked', constTools.stringToBool(obj.autoplay_audio))
  } else {
    $('#componentInfoModalSettingsAutoplayAudio').prop('checked', false)
  }
  if (obj.constellationAppId === 'media_player') {
    $('#componentInfoModalSettingsImageDuration').parent().parent().show()
    if ('image_duration' in obj) {
      $('#componentInfoModalSettingsImageDuration').val(obj.image_duration)
    }
  } else {
    $('#componentInfoModalSettingsImageDuration').parent().parent().hide()
  }

  // If this is a projector, populate the status pane
  if (obj.type === 'projector') {
    populateProjectorInfo(obj.id)
    $('#componentInfoModaProejctorTabButton').show()
  } else {
    $('#componentInfoModaProejctorTabButton').hide()
    $('#componentInfoModalModelGroup').hide()
  }

  // Must be after all the settings are configured
  toggleExhibitComponentInfoSettingWarnings()
  $('#componentInfoModalSettingsSaveButton').hide()

  // Show the approriate panes depending on the type
  if (obj.type === 'exhibit_component' && obj.status !== constConfig.STATUS.STATIC) {
    $('#componentInfoModalSettingsTabButton').show()
    $('#componentInfoModalContentTabButton').show()

    // This component may be accessible over the network.
    updateComponentInfoModalFromHelper(obj.id)
    $('#componentInfoModalContentTabButton').tab('show')
  } else {
    $('#componentInfoModalSettingsTabButton').hide()
    $('#componentInfoModalContentTabButton').hide()

    // This static component will defintely have no content.
    $('#componentInfoConnectionStatusFailed').show()
    $('#componentInfoConnectionStatusInPrograss').hide()

    // Show a useful tab
    if (obj.status === constConfig.STATUS.STATIC || obj.type === 'wol_component') {
      $('#componentInfoModalMaintenanceTabButton').tab('show')
    } else if (obj.type === 'projector') {
      $('#componentInfoModaProejctorTabButton').tab('show')
    }
  }

  // Make the modal visible
  $('#componentInfoModal').modal('show')
}

function populateProjectorInfo (id) {
  // Set up the projector status pane of the componentInfoModal with the info
  // from the selected projector

  const obj = getExhibitComponent(id)

  // First, reset all the cell shadings
  $('#projectorInfoLampState').parent().removeClass()
  $('#projectorInfoFanState').parent().removeClass()
  $('#projectorInfoFilterState').parent().removeClass()
  $('#projectorInfoCoverState').parent().removeClass()
  $('#projectorInfoOtherState').parent().removeClass()
  $('#projectorInfoTempState').parent().removeClass()

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
    $('#componentInfoModalModel').html(obj.state.model)
    $('#componentInfoModalModelGroup').show()
  } else {
    $('#componentInfoModalModelGroup').hide()
  }

  if ('lamp_status' in obj.state && obj.state.lamp_status !== '') {
    const lampList = obj.state.lamp_status

    $('#componentInfoModalProjectorLampList').empty()
    for (let i = 0; i < lampList.length; i++) {
      createProjectorLampStatusEntry(lampList[i], i)
    }
  }
}

function convertAppIDtoDisplayName (appName) {
  // Convert app names to their display text

  let displayName = 'Unknown Component'
  if (appName !== '') {
    const constellationAppIdDisplayNames = {
      heartbeat: 'Heartbeat',
      infostation: 'InfoStation',
      media_browser: 'Media Browser',
      media_player: 'Media Player',
      media_player_kiosk: 'Media Player Kiosk',
      projector: 'Projector',
      sos_kiosk: 'SOS Kiosk',
      sos_screen_player: 'SOS Screen Player',
      static_component: 'Static component',
      timelapse_viewer: 'Timelapse Viewer',
      timeline_explorer: 'Timeline Explorer',
      voting_kiosk: 'Voting Kiosk',
      wol_only: 'Wake on LAN',
      word_cloud_input: 'Word Cloud Input',
      word_cloud_viewer: 'Word Cloud Viewer'
    }
    if (appName in constellationAppIdDisplayNames) {
      displayName = constellationAppIdDisplayNames[appName]
    }
  }

  return displayName
}

function createProjectorLampStatusEntry (entry, number) {
  // Take a dictionary and turn it into HTML elements

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-6 col-sm-3 mb-3'
  $(containerCol).data('config', entry)
  $('#componentInfoModalProjectorLampList').append(containerCol)

  const containerRow = document.createElement('div')
  containerRow.classList = 'row px-1'
  containerCol.appendChild(containerRow)

  const topCol = document.createElement('div')
  topCol.classList = 'col-12'
  containerRow.appendChild(topCol)

  const row1 = document.createElement('div')
  row1.classList = 'row'
  topCol.appendChild(row1)

  const titleCol = document.createElement('div')
  titleCol.classList = 'col-8 bg-primary'
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.innerHTML = 'Lamp ' + String(number + 1)
  row1.appendChild(titleCol)

  const stateCol = document.createElement('div')
  stateCol.classList = 'col-4 text-center py-1'
  stateCol.style.borderTopRightRadius = '0.25rem'
  if (entry[1] === true) {
    // Lamp is on
    stateCol.innerHTML = 'On'
    stateCol.classList += ' bg-success'
  } else {
    stateCol.innerHTML = 'Off'
    stateCol.classList += ' bg-info'
  }
  row1.appendChild(stateCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const hoursCol = document.createElement('div')
  hoursCol.classList = 'col-12 bg-secondary py-1 text-center'
  hoursCol.style.borderBottomLeftRadius = '0.25rem'
  hoursCol.style.borderBottomRightRadius = '0.25rem'
  hoursCol.innerHTML = String(entry[0]) + ' hours'
  row2.appendChild(hoursCol)
}

export function removeExhibitComponentFromModal () {
  // Called when the Remove button is clicked in the componentInfoModal.
  // Send a message to the server to remove the component.

  const id = $('#componentInfoModalTitle').html()

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/removeComponent',
    params: {
      component: {
        id
      }
    }
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        getExhibitComponent(id).remove()
        $('#componentInfoModal').modal('hide')
      }
    })
}

function populateComponentDefinitionList (definitions) {
  // Take a dictionary of definitions and convert it to GUI elements.

  const component = getExhibitComponent($('#componentInfoModal').data('id'))

  $('#componentInfoModalDefinitionList').empty()

  Object.keys(definitions).forEach((uuid) => {
    if ((uuid.slice(0, 9) === '__preview') || uuid.trim() === '') return

    const definition = definitions[uuid]

    const col = document.createElement('div')
    col.setAttribute('id', 'definitionButton_' + uuid)
    col.classList = 'col-4 mt-2 handCursor definition-entry'
    $(col).data('definition', definition)
    col.addEventListener('click', () => {
      handleDefinitionItemSelection(uuid)
    })

    const row = document.createElement('div')
    row.classList = 'row px-2'
    col.appendChild(row)

    const name = document.createElement('div')
    name.setAttribute('id', 'definitionButtonName_' + uuid)
    name.classList = 'col-12 bg-primary rounded-top py-1 position-relative'
    name.style.fontSize = '18px'
    name.innerHTML = definition.name
    row.appendChild(name)

    const selectedBadge = document.createElement('span')
    selectedBadge.setAttribute('id', 'definitionButtonSelectedBadge_' + uuid)
    selectedBadge.classList = 'position-absolute top-0 start-100 translate-middle badge rounded-circle bg-success definition-selected-button'
    selectedBadge.style.right = '0%'
    selectedBadge.style.top = '0%'
    if (component.definition !== definition.uuid) {
      selectedBadge.style.display = 'none'
    }
    selectedBadge.innerHTML = '✓'
    name.append(selectedBadge)

    const app = document.createElement('div')
    app.classList = 'col-12 bg-info rounded-bottom py-1'
    app.setAttribute('id', 'definitionButtonApp_' + uuid)
    app.innerHTML = convertAppIDtoDisplayName(definition.app)
    row.appendChild(app)

    $('#componentInfoModalDefinitionList').append(col)
  })
}

function handleDefinitionItemSelection (uuid) {
  // Called when a user clicks on the definition in the componentInfoModal.

  $('.definition-entry').removeClass('definition-selected')
  $('#definitionButton_' + uuid).addClass('definition-selected')
  $('.definition-selected-button').hide()
  $('#definitionButtonSelectedBadge_' + uuid).show()
  $('#componentInfoModalDefinitionSaveButton').show()
}

export function submitDefinitionSelectionFromModal () {
  // Called when the "Save changes" button is pressed on the definitions pane of the componentInfoModal.

  const definition = $('.definition-selected').data('definition')
  const id = $('#componentInfoModal').data('id')

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + id + '/setDefinition',
    params: { uuid: definition.uuid }
  })
  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + id + '/setApp',
    params: { app_name: definition.app }
  })
  $('#componentInfoModalDefinitionSaveButton').hide()
}

function updateComponentInfoModalFromHelper (id) {
  // Ask the given helper to send an update and use it to update the interface.

  const obj = getExhibitComponent(id)

  const url = obj.getHelperURL()
  if (url == null) {
    // We don't have enough information to contact the helper
    $('#componentInfoConnectionStatusFailed').show()
    $('#componentInfoConnectionStatusInPrograss').hide()

    // Show the maintenance tab
    $('#componentInfoModalMaintenanceTabButton').tab('show')
    // Make the modal visible
    $('#componentInfoModal').modal('show')
    return
  }

  constTools.makeRequest({
    method: 'GET',
    url,
    endpoint: '/getAvailableContent',
    timeout: 10000
  })
    .then((availableContent) => {
      // Good connection, so show the interface elements
      $('#componentAvailableContentRow').show()
      $('#componentcontentUploadInterface').show()
      $('#componentInfoConnectingNotice').hide()

      // Create entries for available definitions
      if (availableContent.definitions != null) {
        populateComponentDefinitionList(availableContent.definitions)
      }

      // If available, configure for multiple file upload
      if ('multiple_file_upload' in availableContent) {
        $('#componentContentUpload').prop('multiple', true)
        $('#componentContentUploadfilename').html('Choose files')
      } else {
        $('#componentContentUpload').prop('multiple', false)
        $('#componentContentUploadfilename').html('Choose file')
      }

      // If it is provided, show the system stats
      if ('system_stats' in availableContent) {
        const stats = availableContent.system_stats

        // Disk
        $('#contentUploadDiskSpaceUsedBar').attr('ariaValueNow', 100 - stats.disk_pct_free)
        $('#contentUploadDiskSpaceUsedBar').width(String(100 - stats.disk_pct_free) + '%')
        $('#contentUploadDiskSpaceFreeBar').attr('ariaValueNow', stats.disk_pct_free)
        $('#contentUploadDiskSpaceFreeBar').width(String(stats.disk_pct_free) + '%')
        $('#contentUploadDiskSpaceFree').html(`Disk: ${String(Math.round(stats.disK_free_GB))} GB`)
        if (stats.disk_pct_free > 20) {
          $('#contentUploadDiskSpaceUsedBar').removeClass('bg-warning bg-danger').addClass('bg-success')
        } else if (stats.disk_pct_free > 10) {
          $('#contentUploadDiskSpaceUsedBar').removeClass('bg-success bg-danger').addClass('bg-warning')
        } else {
          $('#contentUploadDiskSpaceUsedBar').removeClass('bg-success bg-warning').addClass('bg-danger')
        }

        // CPU
        $('#contentUploadCPUUsedBar').attr('ariaValueNow', stats.cpu_load_pct)
        $('#contentUploadCPUUsedBar').width(String(stats.cpu_load_pct) + '%')
        $('#contentUploadCPUFreeBar').attr('ariaValueNow', 100 - stats.cpu_load_pct)
        $('#contentUploadCPUFreeBar').width(String(100 - stats.cpu_load_pct) + '%')
        $('#contentUploadCPUUsed').html(`CPU: ${String(Math.round(stats.cpu_load_pct))}%`)
        if (stats.cpu_load_pct < 80) {
          $('#contentUploadCPUUsedBar').removeClass('bg-warning bg-danger').addClass('bg-success')
        } else if (stats.cpu_load_pct < 90) {
          $('#contentUploadCPUUsedBar').removeClass('bg-success bg-danger').addClass('bg-warning')
        } else {
          $('#contentUploadCPUUsedBar').removeClass('bg-success bg-warning').addClass('bg-danger')
        }

        // RAM
        $('#contentUploadRAMUsedBar').attr('ariaValueNow', stats.ram_used_pct)
        $('#contentUploadRAMUsedBar').width(String(stats.ram_used_pct) + '%')
        $('#contentUploadRAMFreeBar').attr('ariaValueNow', 100 - stats.ram_used_pct)
        $('#contentUploadRAMFreeBar').width(String(100 - stats.ram_used_pct) + '%')
        $('#contentUploadRAMUsed').html(`RAM: ${String(Math.round(stats.ram_used_pct))}%`)
        if (stats.ram_used_pct < 80) {
          $('#contentUploadRAMUsedBar').removeClass('bg-warning bg-danger').addClass('bg-success')
        } else if (stats.ram_used_pct < 90) {
          $('#contentUploadRAMUsedBar').removeClass('bg-success bg-danger').addClass('bg-warning')
        } else {
          $('#contentUploadCPUUsedBar').removeClass('bg-success bg-warning').addClass('bg-danger')
        }

        $('#contentUploadSystemStatsView').show()
      } else {
        $('#contentUploadSystemStatsView').hide()
      }

      // Build buttons for each file in all exhibits
      populateComponentContent(availableContent, 'all_exhibits', id, obj.constellationAppId, 'componentAvailableContentList')

      // Attach an event handler to change the button's color when clicked
      $('.componentContentButton').on('click', function (e) {
        const id = $(this).attr('id')
        // $('.componentContentButton').not($(this)).removeClass("btn-primary").addClass("btn-secondary");
        $(this).toggleClass('btn-primary').toggleClass('btn-secondary')

        // $('.componentContentDropdownButton').not($("#"+id+"Dropdown")).removeClass("btn-primary").addClass("btn-secondary");
        $('#' + id + 'Dropdown').toggleClass('btn-secondary').toggleClass('btn-primary')

        if ($('.componentContentButton.btn-primary').length === 0) {
          $('#componentSaveConfirmationButton').hide() // Can't save a state with no selected content.
        } else {
          $('#componentSaveConfirmationButton').show()
        }
      })
    })
}

function populateComponentContent (availableContent, key, id, appName, div) {
  // Get filenames listed under key in availableContent and add
  // the resulting buttons to the div given by div

  const activeContent = availableContent.active_content
  const contentList = availableContent[key].sort(function (a, b) { return a.localeCompare(b) })
  let thumbnailList = availableContent.thumbnails
  if (thumbnailList == null) {
    thumbnailList = []
  }

  $('#' + div).empty()

  for (let i = 0; i < contentList.length; i++) {
    const container = document.createElement('div')
    container.classList = 'col-6 col-md-4 mt-1'

    // Check if this file type is supported by the current app
    const file = contentList[i]
    const fileExt = contentList[i].split('.').pop().toLowerCase()
    const supportedTypes = getAllowableContentTypes(appName)

    if (!supportedTypes.includes(fileExt)) {
      container.classList += ' incompatible-content'
    }
    if (activeContent.includes(contentList[i])) {
      container.classList += ' active-content'
    }

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100 h-100'
    container.appendChild(btnGroup)

    const button = document.createElement('button')
    const cleanFilename = contentList[i].split('.').join('').split(')').join('').split('(').join('').split(/[\\/]/).join('').replace(/\s/g, '')
    button.setAttribute('type', 'button')
    button.setAttribute('id', cleanFilename + 'Button')
    button.classList = 'btn componentContentButton'

    const fileName = document.createElement('span')
    fileName.classList = 'contentFilenameContainer'
    fileName.setAttribute('id', cleanFilename + 'NameField')
    fileName.innerHTML = contentList[i]
    button.appendChild(fileName)

    const fileNameEditGroup = document.createElement('div')
    fileNameEditGroup.setAttribute('id', cleanFilename + 'NameEditGroup')
    fileNameEditGroup.classList = 'row'
    button.appendChild(fileNameEditGroup)
    $(fileNameEditGroup).hide() // Will be shown when editing the filename

    const fileNameEditCol = document.createElement('div')
    fileNameEditCol.classList = 'col-9 mr-0 pr-0'
    fileNameEditGroup.appendChild(fileNameEditCol)

    const fileNameEditCloseCol = document.createElement('div')
    fileNameEditCloseCol.classList = 'col-3 ml-0 pl-0'
    fileNameEditGroup.appendChild(fileNameEditCloseCol)

    const fileNameEditCloseButton = document.createElement('button')
    fileNameEditCloseButton.classList = 'btn btn-none px-0'
    fileNameEditCloseButton.innerHTML = '&#x2715'
    fileNameEditCloseButton.addEventListener('click', function (event) {
      cancelFileRename(cleanFilename)
      event.stopPropagation()
    })
    fileNameEditCloseCol.appendChild(fileNameEditCloseButton)

    const fileNameEditField = document.createElement('input')
    fileNameEditField.setAttribute('id', cleanFilename + 'NameEditField')
    $(fileNameEditField).data('filename', file)
    fileNameEditField.classList = 'form-control'
    fileNameEditField.addEventListener('keyup', function (e) {
      if (e.key === 'Enter') {
        submitFileRename(cleanFilename)
      }
    })
    fileNameEditCol.appendChild(fileNameEditField)

    const fileNameEditErrorMessageCol = document.createElement('div')
    fileNameEditErrorMessageCol.classList = 'col-12'
    fileNameEditGroup.appendChild(fileNameEditErrorMessageCol)

    const fileNameEditErrorMessage = document.createElement('span')
    fileNameEditErrorMessage.setAttribute('id', cleanFilename + 'NameEditErrorMessage')
    fileNameEditErrorMessage.classList = 'text-danger mt-1'
    fileNameEditErrorMessage.innerHTML = 'A file with this name already exists!'
    $(fileNameEditErrorMessage).hide()
    fileNameEditErrorMessageCol.appendChild(fileNameEditErrorMessage)

    let thumbName
    const mimetype = constTools.guessMimetype(contentList[i])
    if (mimetype === 'image') {
      thumbName = contentList[i].replace(/\.[^/.]+$/, '') + '.jpg'
      if (thumbnailList.includes(thumbName)) {
        const thumb = document.createElement('img')
        thumb.classList = 'contentThumbnail mt-1'
        thumb.src = getExhibitComponent(id).helperAddress + '/thumbnails/' + thumbName
        button.appendChild(thumb)
      }
    } else if (mimetype === 'video') {
      thumbName = contentList[i].replace(/\.[^/.]+$/, '') + '.mp4'
      if (thumbnailList.includes(thumbName)) {
        const thumb = document.createElement('video')
        thumb.classList = 'contentThumbnail mt-1'
        thumb.src = getExhibitComponent(id).helperAddress + '/thumbnails/' + thumbName
        thumb.setAttribute('loop', true)
        thumb.setAttribute('autoplay', true)
        thumb.setAttribute('disablePictureInPicture', true)
        thumb.setAttribute('webkit-playsinline', true)
        thumb.setAttribute('playsinline', true)
        button.appendChild(thumb)
      }
    }

    btnGroup.appendChild(button)

    const dropdownButton = document.createElement('button')
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('id', cleanFilename + 'ButtonDropdown')
    dropdownButton.setAttribute('data-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-haspopup', true)
    dropdownButton.setAttribute('aria-expanded', false)
    dropdownButton.classList = 'btn dropdown-toggle dropdown-toggle-split componentContentDropdownButton'
    // Color the button and dropdown button depending on the status of the content
    if (activeContent.includes(contentList[i])) {
      dropdownButton.classList += ' btn-primary'
      button.classList += ' btn-primary'
    } else {
      dropdownButton.classList += ' btn-secondary'
      button.classList += ' btn-secondary'
    }
    dropdownButton.innerHTML = '<span class="sr-only">Toggle Dropdown</span>'
    btnGroup.appendChild(dropdownButton)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'

    const renameFileButton = document.createElement('a')
    renameFileButton.classList = 'dropdown-item'
    renameFileButton.addEventListener('click', function () {
      showFileRenameField(id, cleanFilename)
    })
    renameFileButton.innerHTML = 'Rename'
    dropdownMenu.appendChild(renameFileButton)

    const deleteFileButton = document.createElement('a')
    deleteFileButton.classList = 'dropdown-item text-danger'
    deleteFileButton.addEventListener('click', function () {
      deleteRemoteFile(id, file)
    })
    deleteFileButton.innerHTML = 'Delete'
    dropdownMenu.appendChild(deleteFileButton)
    btnGroup.appendChild(dropdownMenu)

    $('#' + div).append(container)
  }
  updateComponentInfoModalContentButtonState()
}

function showFileRenameField (id, cleanID) {
  // Begin the process of editing a filename in the componentInfoModal

  const filename = $('#' + cleanID + 'NameEditField').data('filename')
  const fileNameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename
  $('#' + cleanID + 'NameEditGroup').show()
  $('#' + cleanID + 'NameEditErrorMessage').hide()

  // Pass the filename to the edit field, and save it for later use
  $('#' + cleanID + 'NameEditField')
    .val(filename)
    .data('id', id)
  const el = $('#' + cleanID + 'NameEditField')[0]
  el.setSelectionRange(0, fileNameWithoutExt.length)
  el.focus()
  $('#' + cleanID + 'NameField').hide()
}

function cancelFileRename (cleanID) {
  // Called when the X button is clicked to close the file edit dialog without saving

  $('#' + cleanID + 'NameField').show()
  $('#' + cleanID + 'NameEditGroup').hide()
}

function submitFileRename (cleanID) {
  // Called when the user submits the input field to send to the helper.

  const input = $('#' + cleanID + 'NameEditField')
  const currentName = input.data('filename')
  const newName = input.val().trim()
  const id = input.data('id')
  const obj = getExhibitComponent(id)

  // If the new name is actually the current name, just put things back how they were
  if (currentName.trim() === newName.trim()) {
    $('#' + cleanID + 'NameField').html(newName).show()
    $('#' + cleanID + 'NameEditGroup').hide()
    $('#' + cleanID + 'NameEditErrorMessage').hide()
    return
  }

  // If the new name contains an equals sign, reject it
  if (newName.includes('=')) {
    $('#' + cleanID + 'NameEditErrorMessage').html('Filename cannot contain an equals sign.').show()
    return
  }

  constTools.makeRequest({
    method: 'POST',
    url: obj.getHelperURL(),
    endpoint: '/renameFile',
    params: {
      current_name: currentName,
      new_name: newName
    }
  })
    .then((result) => {
      if (result.success === true) {
        $('#' + cleanID + 'NameField').html(newName).show()
        $('#' + cleanID + 'NameEditGroup').hide()
        $('#' + cleanID + 'NameEditErrorMessage').hide()
        input.data('filename', newName)
      } else {
        if (result.error === 'file_exists') {
          $('#' + cleanID + 'NameEditErrorMessage').html('A file with this name already exists!').show()
        }
      }
    })
}

export function updateComponentInfoModalContentButtonState () {
  // Use the state of the filter checkboxes to show/hide the appropriate buttons

  const showThumbs = $('#componentInfoModalThumbnailCheckbox').prop('checked')
  if (showThumbs) {
    $('.contentThumbnail').show()
  } else {
    $('.contentThumbnail').hide()
  }

  const hideIncompatible = $('#componentInfoModalHideIncompatibleCheckbox').prop('checked')
  if (hideIncompatible) {
    $('.incompatible-content').hide()
    $('.active-content').show()
  } else {
    $('.incompatible-content').show()
  }
}

function getAllowableContentTypes (appID) {
  // Return a list of file extensions supported by the given appID

  const supportedTypes = {
    heartbeat: ['ini'],
    infostation: ['ini'],
    media_browser: ['ini'],
    media_player: ['jpeg', 'jpg', 'gif', 'tiff', 'tif', 'png', 'webp', 'heic', 'mpeg', 'mpeg4', 'mp4', 'webm', 'm4v', 'avi', 'mov', 'mkv', 'ogv', 'aac', 'm4a', 'mp3', 'oga', 'ogg', 'weba', 'wav'],
    media_player_kiosk: ['ini'],
    sos_kiosk: ['ini'],
    sos_screen_player: ['ini'],
    timelapse_viewer: ['ini'],
    timeline_explorer: ['const'],
    voting_kiosk: ['ini'],
    word_cloud_input: ['ini'],
    word_cloud_viewer: ['ini']
  }
  if (appID in supportedTypes) {
    return supportedTypes[appID]
  }

  return []
}

export function toggleExhibitComponentInfoSettingWarnings () {
  // Show or hide the exhibit component setting warnings based on their state

  // Enable all tooltips
  $('[data-toggle="tooltip"]').tooltip()

  if ($('#componentInfoModalSettingsAllowShutdown').prop('checked')) {
    $('#componentInfoModalSettingsAllowShutdownWarning').show()
  } else {
    $('#componentInfoModalSettingsAllowShutdownWarning').hide()
  }

  if ($('#componentInfoModalSettingsAutoplayAudio').prop('checked')) {
    $('#componentInfoModalSettingsAutoplayAudioWarning').show()
  } else {
    $('#componentInfoModalSettingsAutoplayAudioWarning').hide()
  }
}

export function submitComponentSettingsChange () {
  // Collect the current settings and send them to the component's helper for saving.
  // If the app is changed, send that to Control Server

  const obj = getExhibitComponent($('#componentInfoModalTitle').html())

  const settings = {}

  settings.allow_refresh = $('#componentInfoModalSettingsAllowRefresh').prop('checked')
  settings.allow_restart = $('#componentInfoModalSettingsAllowRestart').prop('checked')
  settings.allow_shutdown = $('#componentInfoModalSettingsAllowShutdown').prop('checked')
  settings.allow_sleep = $('#componentInfoModalSettingsAllowSleep').prop('checked')
  settings.autoplay_audio = $('#componentInfoModalSettingsAutoplayAudio').prop('checked')

  const imageDuration = $('#componentInfoModalSettingsImageDuration').val().trim()
  if (imageDuration !== '') {
    settings.image_duration = parseFloat(imageDuration)
  }

  const AnyDeskID = $('#componentInfoModalSettingsAnyDeskID').val().trim()
  if (AnyDeskID !== '') {
    settings.anydesk_id = AnyDeskID
  }

  constTools.makeRequest({
    method: 'POST',
    url: obj.getHelperURL(),
    endpoint: '/setDefaults',
    params: { defaults: settings }
  })
    .then((response) => {
      if ('success' in response) {
        if (response.success === true) {
          $('#componentInfoModalSettingsSaveButton').hide()
        }
      }
    })

  const app = $('#componentInfoModalSettingsAppName').val()
  if (app !== obj.constellationAppId) {
    $('#constellationComponentIdButton').html(convertAppIDtoDisplayName(app))
    obj.constellationAppId = app
    updateComponentInfoModalFromHelper(obj.id)

    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/exhibit/setComponentApp',
      params: {
        component: {
          id: obj.id
        },
        app_name: app
      }
    })
  }
}

export function getExhibitComponent (id) {
  // Function to search the exhibitComponents list for a given id

  const result = constConfig.exhibitComponents.find(obj => {
    return obj.id === id
  })

  return result
}

function deleteRemoteFile (id, file, warn = true) {
  // If called with warn=True, show a modal asking to delete the file.
  // Otherwise, send the command to delete.

  const model = $('#fileDeleteModal')

  if (warn === true) {
    $('#fileDeleteModalText').html(`Delete ${file} from ${id}?`)
    // Remove any previous event handler and then add one to actually do the deletion.
    $('#fileDeleteConfirmationButton').show()
    $('#fileDeleteConfirmationButton').off()
    $('#fileDeleteConfirmationButton').on('click', function () {
      deleteRemoteFile(id, file, warn = false)
    })
    model.modal('show')
  } else {
    $('#fileDeleteModalText').html(`Deleting ${file}...`)
    $('#fileDeleteConfirmationButton').hide()

    const fileSplit = file.split(/[\\/]/) // regex to split on forward and back slashes
    let exhibit
    let fileToDelete
    if (fileSplit.length > 1) {
      // our file is of form "exhibit/file"
      exhibit = fileSplit[0]
      fileToDelete = fileSplit[1]
    } else {
      exhibit = constConfig.currentExhibit.split('.')[0]
      fileToDelete = file
    }
    const obj = getExhibitComponent(id)
    const requestDict = {
      file: fileToDelete,
      fromExhibit: exhibit
    }

    constTools.makeRequest({
      method: 'POST',
      url: obj.getHelperURL(),
      endpoint: '/deleteFile',
      params: requestDict
    })
      .then((response) => {
        if ('success' in response) {
          if (response.success === true) {
            model.modal('hide')
            showExhibitComponentInfo(id)
          }
        }
      })
  }
}

export function rebuildComponentInterface () {
  // Clear the componentGroupsRow and rebuild it

  document.getElementById('componentGroupsRow').innerHTML = ''
  let i
  for (i = 0; i < constConfig.componentGroups.length; i++) {
    constConfig.componentGroups[i].sortComponentList()
    constConfig.componentGroups[i].buildHTML()
  }
}

export function queueCommand (id, cmd) {
  // Function to send a command to the control server that will then
  // be sent to the component the next time it pings the server

  const obj = getExhibitComponent(id)
  if (['shutdown', 'restart'].includes(cmd) && obj.type === 'exhibit_component') {
    // We send these commands directly to the helper
    constTools.makeRequest({
      method: 'GET',
      url: obj.getHelperURL(),
      endpoint: '/' + cmd
    })
  } else {
    // We send these commands to the server to pass to the component itself
    let cmdPath = ''
    if (obj.type === 'projector') {
      cmdPath = '/projector/queueCommand'
    } else if (obj.group === 'WAKE_ON_LAN') {
      cmdPath = '/exhibit/queueWOLCommand'
    } else {
      cmdPath = '/exhibit/queueCommand'
    }

    const requestDict = {
      component: {
        id
      },
      command: cmd
    }

    constTools.makeServerRequest({
      method: 'POST',
      endpoint: cmdPath,
      params: requestDict
    })
  }
}

export function showManageWakeOnLANModal () {
  // Show the modal for managing Wake on LAN devices.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/wake_on_LAN/getConfiguration'
  })
    .then((result) => {
      populateManageWakeOnLANModal(result.configuration)
    })

  $('#manageWakeOnLANEditMACInputWarning').hide()

  // Clear the input fields
  $('#manageWakeOnLANEditIDInput').val(null)
  $('#manageWakeOnLANEditMACInput').val(null)
  $('#manageWakeOnLANEditIPInput').val(null)
  $('#manageWakeOnLANModalSaveButton').hide()

  $('#manageWakeOnLANModal').modal('show')
}

function populateManageWakeOnLANModal (list) {
  // Get a list of Wake on LAN configs from Control Server and build a widget for each.

  $('#manageWakeOnLANList').empty()
  list.forEach((entry) => {
    createManageWakeOnLANEntry(entry)
  })
}

export function createManageWakeOnLANEntry (entry) {
  // Take a dictionary and turn it into HTML elements

  // Create a new ID used only to track this device through the edit process,
  // even if the actual ID is changed.
  const cleanID = String(new Date().getTime() + Math.round(1000000 * Math.random()))

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-12 mb-3 manageWakeOnLANEntry'
  containerCol.setAttribute('id', 'manageWakeOnLAN_' + cleanID)
  $(containerCol).data('config', entry)
  $('#manageWakeOnLANList').append(containerCol)

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
  titleCol.setAttribute('id', 'manageWakeOnLANID_' + cleanID)
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.style.overflowWrap = 'break-word'
  titleCol.innerHTML = entry.id
  row1.appendChild(titleCol)

  const editCol = document.createElement('div')
  editCol.classList = 'col-3 bg-info text-center handCursor py-1'
  editCol.setAttribute('id', 'manageWakeOnLANEdit_' + cleanID)
  editCol.style.borderTopRightRadius = '0.25rem'
  editCol.innerHTML = 'Edit'
  $(editCol).click(function () {
    populateManageWakeOnLANEdit(cleanID)
  })
  row1.appendChild(editCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const protocolCol = document.createElement('div')
  protocolCol.classList = 'col-6 bg-secondary py-1 px-1 text-center'
  protocolCol.setAttribute('id', 'manageWakeOnLANMAC_' + cleanID)
  protocolCol.style.borderBottomLeftRadius = '0.25rem'
  protocolCol.innerHTML = entry.mac_address.replaceAll('-', ':')
  row2.appendChild(protocolCol)

  const ipCol = document.createElement('div')
  ipCol.classList = 'col-md-6 bg-secondary py-1 px-1 text-center'
  ipCol.setAttribute('id', 'manageWakeOnLANIP_' + cleanID)
  ipCol.style.borderBottomRightRadius = '0.25rem'
  ipCol.innerHTML = entry.ip_address || ''
  row2.appendChild(ipCol)
}

function populateManageWakeOnLANEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageWakeOnLAN_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageWakeOnLANEditIDInput').data('id', id)

  $('#manageWakeOnLANEditIDInput').val(details.id)
  $('#manageWakeOnLANEditIPInput').val(details.ip_address)
  $('#manageWakeOnLANEditMACInput').val(details.mac_address.replaceAll('-', ':'))
}
export function manageWakeOnLANUpdateConfigFromEdit () {
  // Called when a change occurs in an edit field.
  // Update both the HTML and the config itself

  const id = $('#manageWakeOnLANEditIDInput').data('id')
  const details = $('#manageWakeOnLAN_' + id).data('config')
  $('#manageWakeOnLANModalSaveButton').show() // Show the save button

  const newID = $('#manageWakeOnLANEditIDInput').val()
  $('#manageWakeOnLANID_' + id).html(newID)
  details.id = newID

  const newIP = $('#manageWakeOnLANEditIPInput').val()
  $('#manageWakeOnLANIP_' + id).html(newIP)
  details.ip_address = newIP

  const inputMAC = $('#manageWakeOnLANEditMACInput').val()
  // Check that we have the right number of characters (12)
  if (inputMAC.replaceAll(':', '').replaceAll('-', '').length !== 12) {
    // Wrong length; show a warning
    $('#manageWakeOnLANEditMACInputWarning').show()
    $('[data-toggle="tooltip"]').tooltip()
  } else {
    $('#manageWakeOnLANEditMACInputWarning').hide()
  }
  const newMAC = inputMAC.replaceAll('-', ':')
  $('#manageWakeOnLANMAC_' + id).html(newMAC)
  details.mac_address = newMAC

  $('#manageWakeOnLAN_' + id).data('config', details)
}

export function manageWakeOnLANDeleteWakeOnLANEntry () {
  // Called when the "Delete device" button is clicked.
  // Remove the HTML entry from the listing

  const id = $('#manageWakeOnLANEditIDInput').data('id')
  if (id == null) {
    return
  }
  $('#manageWakeOnLANModalSaveButton').show() // Show the save button
  $('#manageWakeOnLAN_' + id).remove()

  $('#manageWakeOnLANEditMACInputWarning').hide()

  // Clear the input fields
  $('#manageWakeOnLANEditIDInput').val(null)
  $('#manageWakeOnLANEditMACInput').val(null)
  $('#manageWakeOnLANEditIPInput').val(null)
}

export function updateWakeOnLANConfigurationFromModal () {
  // Collect the dictionary from each WakeOnLAN element and send it to Control Server to save.

  const entries = $('.manageWakeOnLANEntry')
  const listToSend = []
  entries.each((i, entry) => {
    listToSend.push($(entry).data('config'))
  })

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/wake_on_LAN/updateConfiguration',
    params: { configuration: listToSend }
  })
    .then((result) => {
      $('#manageWakeOnLANModal').modal('hide')
    })
}

export function showManageStaticComponentsModal () {
  // Show the modal for managing Wake on LAN devices.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/static/getConfiguration'
  })
    .then((result) => {
      populateManageStaticComponentsModal(result.configuration)
    })

  // Clear the input fields
  $('#manageStaticComponentsEditIDInput').val(null)
  $('#manageStaticComponentsEditGroupInput').val(null)
  $('#manageStaticComponentsModalSaveButton').hide()

  $('#manageStaticComponentsModal').modal('show')
}

function populateManageStaticComponentsModal (list) {
  // Get a list of static components configs from Control Server and build a widget for each.

  $('#manageStaticComponentsList').empty()
  list.forEach((entry) => {
    createManageStaticComponentsEntry(entry)
  })
}

export function createManageStaticComponentsEntry (entry) {
  // Take a dictionary and turn it into HTML elements

  // Create a new ID used only to track this component through the edit process,
  // even if the actual ID is changed.
  const cleanID = String(new Date().getTime() + Math.round(1000000 * Math.random()))

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-12 mb-3 manageStaticComponentsEntry'
  containerCol.setAttribute('id', 'manageStaticComponents_' + cleanID)
  $(containerCol).data('config', entry)
  $('#manageStaticComponentsList').append(containerCol)

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
  titleCol.setAttribute('id', 'manageStaticComponentsID_' + cleanID)
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.style.overflowWrap = 'break-word'
  titleCol.innerHTML = entry.id
  row1.appendChild(titleCol)

  const editCol = document.createElement('div')
  editCol.classList = 'col-3 bg-info text-center handCursor py-1'
  editCol.setAttribute('id', 'manageStaticComponentsEdit_' + cleanID)
  editCol.style.borderTopRightRadius = '0.25rem'
  editCol.innerHTML = 'Edit'
  $(editCol).click(function () {
    populateManageStaticComponentsEdit(cleanID)
  })
  row1.appendChild(editCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const groupCol = document.createElement('div')
  groupCol.classList = 'col-12 bg-secondary py-1 px-1 text-center'
  groupCol.setAttribute('id', 'manageStaticComponentsGroup_' + cleanID)
  groupCol.style.borderBottomLeftRadius = '0.25rem'
  groupCol.style.borderBottomRightRadius = '0.25rem'
  groupCol.innerHTML = entry.group
  row2.appendChild(groupCol)
}

function populateManageStaticComponentsEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageStaticComponents_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageStaticComponentsEditIDInput').data('id', id)

  $('#manageStaticComponentsEditIDInput').val(details.id)
  $('#manageStaticComponentsEditGroupInput').val(details.group)
}

export function manageStaticComponentsUpdateConfigFromEdit () {
  // Called when a change occurs in an edit field.
  // Update both the HTML and the config itself

  const id = $('#manageStaticComponentsEditIDInput').data('id')
  const details = $('#manageStaticComponents_' + id).data('config')
  $('#manageStaticComponentsModalSaveButton').show() // Show the save button

  const newID = $('#manageStaticComponentsEditIDInput').val()
  $('#manageStaticComponentsID_' + id).html(newID)
  details.id = newID

  const newGroup = $('#manageStaticComponentsEditGroupInput').val()
  if (newGroup != null && newGroup !== '') {
    $('#manageStaticComponentsGroup_' + id).html(newGroup)
    details.group = newGroup
  } else {
    $('#manageStaticComponentsGroup_' + id).html('STATIC')
    details.group = 'STATIC'
  }

  $('#manageStaticComponents_' + id).data('config', details)
}

export function manageStaticComponentsDeleteComponentEntry () {
  // Called when the "Delete component" button is clicked.
  // Remove the HTML entry from the listing

  const id = $('#manageStaticComponentsEditIDInput').data('id')
  $('#manageStaticComponentsModalSaveButton').show() // Show the save button
  $('#manageStaticComponents_' + id).remove()

  // Clear the input fields
  $('#manageStaticComponentsEditIDInput').val(null)
  $('#manageStaticComponentsEditGroupInput').val(null)
}

export function updateStaticComponentsConfigurationFromModal () {
  // Collect the dictionary from each component element and send it to Control Server to save.

  const entries = $('.manageStaticComponentsEntry')
  const listToSend = []
  entries.each((i, entry) => {
    listToSend.push($(entry).data('config'))
  })

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/static/updateConfiguration',
    params: { configuration: listToSend }
  })
    .then((result) => {
      $('#manageStaticComponentsModal').modal('hide')
    })
}
