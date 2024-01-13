import constConfig from './config.js'
import * as constDMX from './constellation_dmx.js'
import * as constGroup from './constellation_group.js'
import * as constMaint from './constellation_maintenance.js'
import * as constTools from './constellation_tools.js'
import * as constUsers from './constellation_users.js'

class BaseComponent {
  // A basic Constellation component.

  constructor (uuid, id, groups) {
    this.uuid = uuid
    this.id = id
    this.groups = groups
    this.type = 'base_component'

    this.status = constConfig.STATUS.OFFLINE
    this.maintenanceStatus = constConfig.MAINTANANCE_STATUS['Off floor, not working']
    this.permissions = {}

    this.ip_address = null
    this.latency = null
    this.lastContactDateTime = null
  }

  buildHTML (group) {
    // Function to build the HTML representation of this component
    // and add it to the row of the parent group

    // First, make sure we have permission to view this group.
    if (constUsers.checkUserPermission('components', 'view', group) === false) return

    let permission = 'view'
    if (constUsers.checkUserPermission('components', 'edit', group)) {
      permission = 'edit'
    }

    // If the element is static and the 'Show STATIC' checkbox is not ticked, bail out
    if (this.status === constConfig.STATUS.STATIC && $('#componentsTabSettingsShowStatic').prop('checked') === false) {
      return
    }

    const displayName = this.id
    const thisId = this.id
    const cleanId = this.id.replaceAll(' ', '_')

    const col = document.createElement('div')
    col.classList = 'col mt-1'

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group h-100 w-100'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn w-100 componentStatusButton ' + this.getStatus().colorClass
    mainButton.setAttribute('type', 'button')
    mainButton.setAttribute('id', cleanId + '_' + group + '_MainButton')
    mainButton.addEventListener('click', function () {
      showExhibitComponentInfo(thisId, group)
    }, false)
    btnGroup.appendChild(mainButton)

    const displayNameEl = document.createElement('div')
    displayNameEl.classList = 'fs-5 fw-medium'
    displayNameEl.innerHTML = displayName
    mainButton.appendChild(displayNameEl)

    const statusFieldEl = document.createElement('div')
    statusFieldEl.setAttribute('id', cleanId + '_' + group + '_StatusField')
    statusFieldEl.innerHTML = this.getStatus().name
    mainButton.appendChild(statusFieldEl)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn dropdown-toggle dropdown-toggle-split ' + this.getStatus().colorClass
    dropdownButton.setAttribute('id', cleanId + '_' + group + '_DropdownButton')
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-haspopup', 'true')
    dropdownButton.setAttribute('aria-expanded', 'false')
    btnGroup.appendChild(dropdownButton)

    const dropdownLabel = document.createElement('span')
    dropdownLabel.classList = 'visually-hidden'
    dropdownLabel.innerHTML = 'Toggle Dropdown'
    dropdownButton.appendChild(dropdownLabel)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    dropdownMenu.setAttribute('id', cleanId + '_' + group + '_DropdownMenu')
    this.populateActionMenu(dropdownMenu, group, permission)
    btnGroup.appendChild(dropdownMenu)
    return col
  }

  getStatus () {
    // Return the current status, based on the selected status mode

    if (document.getElementById('componentStatusModeRealtimeCheckbox').checked === true) {
      return this.status
    } else if (this.maintenanceStatus != null) {
      return this.maintenanceStatus
    }
    return constConfig.MAINTANANCE_STATUS['Off floor, not working']
  }

  populateActionMenu (dropdownMenu, groupUUID, permission = 'view') {
    // Build out the dropdown menu options based on the this.permissions.

    $(dropdownMenu).empty()
    const thisId = this.id
    let numOptions = 0

    if (permission === 'edit') {
      if ('refresh' in this.permissions && this.permissions.refresh === true) {
        numOptions += 1
        const refreshAction = document.createElement('a')
        refreshAction.classList = 'dropdown-item handCursor'
        refreshAction.innerHTML = 'Refresh component'
        refreshAction.addEventListener('click', function () {
          queueCommand(thisId, 'refresh')
        }, false)
        dropdownMenu.appendChild(refreshAction)
      }

      if ('sleep' in this.permissions && this.permissions.sleep === true) {
        numOptions += 2
        const sleepAction = document.createElement('a')
        sleepAction.classList = 'dropdown-item handCursor'
        sleepAction.innerHTML = 'Sleep display'
        sleepAction.addEventListener('click', function () {
          queueCommand(thisId, 'sleepDisplay')
        }, false)
        dropdownMenu.appendChild(sleepAction)

        const wakeAction = document.createElement('a')
        wakeAction.classList = 'dropdown-item handCursor'
        wakeAction.innerHTML = 'Wake display'
        wakeAction.addEventListener('click', function () {
          queueCommand(thisId, 'wakeDisplay')
        }, false)
        dropdownMenu.appendChild(wakeAction)
      }

      if ('restart' in this.permissions && this.permissions.restart === true) {
        numOptions += 1
        const restartAction = document.createElement('a')
        restartAction.classList = 'dropdown-item handCursor'
        restartAction.innerHTML = 'Restart component'
        restartAction.addEventListener('click', function () {
          queueCommand(thisId, 'restart')
        }, false)
        dropdownMenu.appendChild(restartAction)
      }

      if ('shutdown' in this.permissions && this.permissions.shutdown === true) {
        numOptions += 1
        const shutdownAction = document.createElement('a')
        shutdownAction.classList = 'dropdown-item handCursor'
        shutdownAction.innerHTML = 'Power off component'
        shutdownAction.addEventListener('click', function () {
          queueCommand(thisId, 'restart')
        }, false)
        dropdownMenu.appendChild(shutdownAction)
      }

      if ('power_on' in this.permissions && this.permissions.power_on === true) {
        numOptions += 1
        const powerOnAction = document.createElement('a')
        powerOnAction.classList = 'dropdown-item handCursor'
        powerOnAction.innerHTML = 'Power on component'
        powerOnAction.addEventListener('click', function () {
          queueCommand(thisId, 'power_on')
        }, false)
        dropdownMenu.appendChild(powerOnAction)
      }

      if (numOptions > 0) {
        const divider = document.createElement('hr')
        divider.classList = 'dropdown-divider'
        dropdownMenu.appendChild(divider)
      }
    }

    const detailsAction = document.createElement('a')
    detailsAction.classList = 'dropdown-item handCursor'
    detailsAction.innerHTML = 'View details'
    detailsAction.addEventListener('click', function () {
      showExhibitComponentInfo(thisId, groupUUID)
    }, false)
    dropdownMenu.appendChild(detailsAction)
  }

  remove () {
    // Remove the component from its ComponentGroup
    for (const group of this.groups) {
      getExhibitComponentGroup(group).removeComponent(this.id)
    }

    // Remove the component from the exhibitComponents list
    const thisInstance = this
    constConfig.exhibitComponents = $.grep(constConfig.exhibitComponents, function (el, idx) { return el.id === thisInstance.id }, true)

    // Cancel the pollingFunction
    clearInterval(this.pollingFunction)

    // Rebuild the interface
    rebuildComponentInterface()
  }

  setGroups (groups) {
    // Adjust the component's groups and rebuild the interface if needed.

    if (groups.length === 0) groups = ['Default']

    // First, remove the component from any groups it is no longer in
    for (const group of this.groups) {
      if (groups.includes(group) === false) getExhibitComponentGroup(group).removeComponent(this.id)
    }

    // Then, add component to any groups it was not in before
    for (const group of groups) {
      if (this.groups.includes(group) === false) {
        let componentGroup = getExhibitComponentGroup(group)
        if (componentGroup == null) {
          // If this is the first component in the group, create the group first.
          componentGroup = new ExhibitComponentGroup(group)
          constConfig.componentGroups.push(componentGroup)
        }
        componentGroup.addComponent(this)
      }
    }
    this.groups = groups
    rebuildComponentInterface()
  }

  setPermissions (permissions) {
    // Set the compnent's permisions and then rebuild the action list

    this.permissions = permissions
  }

  setStatus (status, maintenanceStatus) {
    // Set the component's status and change the GUI to reflect the change.

    const cleanId = this.id.replaceAll(' ', '_')

    this.status = constConfig.STATUS[status]
    this.maintenanceStatus = constConfig.MAINTANANCE_STATUS[maintenanceStatus]

    for (const group of this.groups) {
      // Make sure this is a group we can actually see
      if (constUsers.checkUserPermission('components', 'view', group) === false) return

      // Update the GUI based on which view mode we're in
      const statusFieldEl = document.getElementById(cleanId + '_' + group + '_StatusField')
      if (statusFieldEl == null) return // This is a hidden static component

      let btnClass
      if (document.getElementById('componentStatusModeRealtimeCheckbox').checked === true) {
      // Real-time status mode
        statusFieldEl.innerHTML = this.status.name
        btnClass = this.status.colorClass
      } else {
      // Maintenance status mode
        statusFieldEl.innerHTML = this.maintenanceStatus.name
        btnClass = this.maintenanceStatus.colorClass
      }

      // Strip all existing classes, then add the new one
      $('#' + cleanId + '_' + group + '_MainButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
      $('#' + cleanId + '_' + group + '_DropdownButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
    }
  }

  updateFromServer (update) {
    // Use a dictionary of values from Control Server to update this component.

    this.setStatus(update.status, update.maintenance_status)

    if ('uuid' in update) {
      this.uuid = update.uuid
    }
    if ('groups' in update) {
      this.setGroups(update.groups)
    }
    if ('ip_address' in update) {
      this.ip_address = update.ip_address
    }
    if ('permissions' in update) {
      if (JSON.stringify(this.permissions) !== JSON.stringify(update.permissions)) {
        this.setPermissions(update.permissions)
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

  constructor (uuid, id, groups) {
    super(uuid, id, groups)

    this.type = 'exhibit_component'
    this.helperAddress = null
    this.state = {}
    this.constellationAppId = ''
    this.platformDetails = {}
  }

  getHelperURL () {
    // Return the url for the helper of this component.

    return this.helperAddress
  }

  remove (deleteConfigurtion = true) {
    if (this.status === constConfig.STATUS.STATIC) {
      // Remove the component from the static system configuration

      if (deleteConfigurtion === true) {
        // First, get the current static configuration
        constTools.makeServerRequest({
          method: 'GET',
          endpoint: '/system/static/getConfiguration'
        })
          .then((result) => {
            let staticConfig = result.configuration
            // Next, remove this element
            const thisID = this.id
            staticConfig = staticConfig.filter(function (obj) {
              return obj.id !== thisID
            })

            // Finally, send the configuration back for writing
            constTools.makeServerRequest({
              method: 'POST',
              endpoint: '/system/static/updateConfiguration',
              params: {
                configuration: staticConfig
              }
            })
          })
      }

      super.remove()
    }
  }

  updateFromServer (update) {
    // Extend parent update to include exhibit component-specific items

    super.updateFromServer(update)

    if ('autoplay_audio' in update) {
      this.autoplay_audio = update.autoplay_audio
    }
    if ('constellation_app_id' in update) {
      this.constellationAppId = update.constellation_app_id
    }
    if ('definition' in update) {
      this.definition = update.definition
    }
    if ('helperAddress' in update) {
      this.helperAddress = update.helperAddress
    }
    if ('platform_details' in update) {
      this.platformDetails = update.platform_details
    }
  }
}

export class WakeOnLANComponent extends BaseComponent {
  // A component representings a Wake on LAN device

  constructor (uuid, id, groups, macAddress) {
    super(uuid, id, groups)

    this.type = 'wol_component'
    this.mac_address = macAddress
    this.constellationAppId = 'wol_only'
  }
}

class Projector extends BaseComponent {
  // A component representing a projector

  constructor (uuid, id, groups) {
    super(uuid, id, groups)

    this.type = 'projector'
    this.constellationAppId = 'projector'
    this.password = ''
    this.protocol = 'pjlink'
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
    if ('password' in update) this.password = update.password
    if ('protocol' in update) this.protocol = update.protocol
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

    // First, make sure we have permission to view this group.
    if (constUsers.checkUserPermission('components', 'view', this.group) === false) return

    let permission = 'view'
    if (constUsers.checkUserPermission('components', 'edit', this.group) === true) {
      permission = 'edit'
    }

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
    const displayRefresh = 'block'

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
    btnGroup.classList = 'btn-group w-100'
    col.appendChild(btnGroup)

    const mainButton = document.createElement('button')
    mainButton.classList = 'btn btn-secondary w-100 btn-lg'
    mainButton.setAttribute('type', 'button')
    mainButton.innerHTML = constGroup.getGroupName(this.group)
    btnGroup.appendChild(mainButton)

    if (permission === 'edit') {
      mainButton.classList.add('rounded-end')

      const dropdownButton = document.createElement('button')
      dropdownButton.classList = 'btn btn-secondary dropdown-toggle dropdown-toggle-split'
      dropdownButton.setAttribute('type', 'button')
      dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
      dropdownButton.setAttribute('aria-haspopup', 'true')
      dropdownButton.setAttribute('aria-expanded', 'false')
      btnGroup.appendChild(dropdownButton)

      const srHint = document.createElement('span')
      srHint.classList = 'visually-hidden'
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
    }

    const componentList = document.createElement('div')
    componentList.classList = 'row'
    componentList.setAttribute('id', thisGroup.replaceAll(' ', '_') + 'ComponentList')
    if (numToDisplay > 7) {
      componentList.classList.add('row-cols-2', 'row-cols-sm-3', 'row-cols-md-4')
    } else {
      componentList.classList.add('row-cols-2', 'row-cols-sm-3', 'row-cols-md-2')
    }

    col.appendChild(componentList)

    document.getElementById('componentGroupsRow').appendChild(col)
    this.components.forEach((component) => {
      componentList.appendChild(component.buildHTML(this.group))
    })
  }
}

export function createComponentFromUpdate (update) {
  // Use an update dictionary to create a new component

  // Make sure this component doesn't already exist
  const obj = getExhibitComponent(update.id)
  if (obj != null) return

  // First, make sure the groups exist
  for (const group of update.groups) {
    let matchingGroup = getExhibitComponentGroup(group)

    if (matchingGroup == null) {
      matchingGroup = new ExhibitComponentGroup(group)
      constConfig.componentGroups.push(matchingGroup)
    }
  }

  // Then create a new component
  let newComponent
  if (update.class === 'exhibitComponent') {
    newComponent = new ExhibitComponent(update.uuid, update.id, update.groups)
  } else if (update.class === 'wolComponent') {
    newComponent = new WakeOnLANComponent(update.uuid, update.id, update.groups, update.mac_address)
  } else if (update.class === 'projector') {
    newComponent = new Projector(update.uuid, update.id, update.groups)
  }

  newComponent.buildHTML()
  constConfig.exhibitComponents.push(newComponent)

  // Add the component to the right groups
  for (const group of update.groups) {
    getExhibitComponentGroup(group).addComponent(newComponent)
  }

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

function setComponentInfoStatusMessage (msg) {
  // Set the given string as the status message and show it.

  if (msg.trim() === '') {
    clearComponentInfoStatusMessage()
    return
  }

  const el = document.getElementById('componentInfoStatusMessage')

  el.innerHTML = msg
  el.style.display = 'block'
}

function clearComponentInfoStatusMessage () {
  // Hide the status message

  const el = document.getElementById('componentInfoStatusMessage')

  el.style.display = 'none'
}

function componentCannotConnect () {
  // Configure the componentInfoModal for a failed connection.

  setComponentInfoStatusMessage('Cannot connect to component')

  // Hide the tabs
  document.getElementById('componentInfoModalTabList').style.display = 'none'
  document.getElementById('componentInfoModalTabContainer').style.display = 'none'
  document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
}

function componentGoodConnection (screenshot = true) {
  // Configure the componentInfoModal for a good connection

  clearComponentInfoStatusMessage()
  // Show the tabs
  document.getElementById('componentInfoModalTabList').style.display = 'flex'
  document.getElementById('componentInfoModalTabContainer').style.display = 'block'
  if (screenshot) document.getElementById('componentInfoModalViewScreenshot').style.display = 'block'
}

function showExhibitComponentInfo (id, groupUUID) {
  // This sets up the componentInfoModal with the info from the selected
  // component and shows it on the screen.

  // Check permission
  let permission
  if (constUsers.checkUserPermission('components', 'edit', groupUUID) === true) {
    permission = 'edit'
    document.getElementById('componentInfoModalRemoveComponentButton').style.display = 'block'
    document.getElementById('componentInfoModalSettingsTabButton').style.display = 'block'
  } else if (constUsers.checkUserPermission('components', 'view', groupUUID) === true) {
    permission = 'view'
    document.getElementById('componentInfoModalRemoveComponentButton').style.display = 'none'
    document.getElementById('componentInfoModalSettingsTabButton').style.display = 'none'
  } else {
    // No permission to view
    return
  }

  let maintenancePermission
  if (constUsers.checkUserPermission('maintenance', 'edit', groupUUID) === true) {
    maintenancePermission = 'edit'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'block'
  } else if (constUsers.checkUserPermission('maintenance', 'view', groupUUID) === true) {
    maintenancePermission = 'view'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'block'
  } else {
    maintenancePermission = 'none'
    document.getElementById('componentInfoModalMaintenanceTabButton').style.display = 'none'
  }

  const obj = getExhibitComponent(id)

  $('#componentInfoModal').data('id', id)
  document.getElementById('componentInfoModal').setAttribute('data-uuid', obj.uuid)

  document.getElementById('componentInfoModalTitle').innerHTML = id

  // Set up the upper-right dropdown menu with helpful details
  document.getElementById('constellationComponentIdButton').innerHTML = convertAppIDtoDisplayName(obj.constellationAppId)

  if (obj.ip_address != null && obj.ip_address !== '') {
    document.getElementById('componentInfoModalIPAddress').innerHTML = obj.ip_address
    document.getElementById('componentInfoModalIPAddressGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalIPAddressGroup').style.display = 'none'
  }
  if (obj.ip_address != null &&
      constTools.extractIPAddress(obj.helperAddress) != null &&
      obj.ip_address !== constTools.extractIPAddress(obj.helperAddress)
  ) {
    document.getElementById('componentInfoModalHelperIPAddress').innerHTML = constTools.extractIPAddress(obj.helperAddress)
    document.getElementById('componentInfoModalHelperIPAddressGroup').style.display = 'block'
    // Cannot take screenshots of components with a remote helper
    document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
  } else {
    document.getElementById('componentInfoModalHelperIPAddressGroup').style.display = 'none'
  }

  if ('platformDetails' in obj) {
    if ('operating_system' in obj.platformDetails) {
      document.getElementById('componentInfoModalOperatingSystem').innerHTML = obj.platformDetails.operating_system.replace('OS X', 'macOS')
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    }
    if ('browser' in obj.platformDetails && obj.platformDetails.browser !== 'null null') {
      document.getElementById('componentInfoModalBrowser').innerHTML = obj.platformDetails.browser
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'block'
    } else {
      document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
    }
  } else {
    document.getElementById('componentInfoModalOperatingSystemGroup').style.display = 'none'
    document.getElementById('componentInfoModalBrowserGroup').style.display = 'none'
  }
  if ('protocol' in obj && obj.protocol != null) {
    const protocolNames = {
      pjlink: 'PJLink'
    }
    document.getElementById('componentInfoModalProtocol').innerHTML = protocolNames[obj.protocol]
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalProtocolGroup').style.display = 'none'
  }
  if (obj.latency != null) {
    document.getElementById('componentInfoModalLatency').innerHTML = String(obj.latency) + ' ms'
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalLatencyGroup').style.display = 'none'
  }
  if (obj.lastContactDateTime != null) {
    document.getElementById('componentInfoModalLastContact').innerHTML = constTools.formatDateTimeDifference(new Date(), new Date(obj.lastContactDateTime))
    document.getElementById('componentInfoModalLastContactGroup').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalLastContactGroup').style.display = 'none'
  }

  // Add any available description
  if (obj.description === '') {
    document.getElementById('componentInfoModalDescription').style.display = 'none'
    document.getElementById('componentInfoModalDescriptionInput').value = ''
    document.getElementById('componentInfoModalExhibitDescriptionInput').value = ''
  } else {
    document.getElementById('componentInfoModalDescription').innerHTML = obj.description
    document.getElementById('componentInfoModalDescription').style.display = 'block'

    // For exhibit components
    document.getElementById('componentInfoModalExhibitDescriptionInput').value = obj.description
    // For everything else
    document.getElementById('componentInfoModalDescriptionInput').value = obj.description
  }

  // Show/hide warnings and checkboxes as appropriate
  $('#componentInfoModalThumbnailCheckbox').prop('checked', true)
  $('#componentSaveConfirmationButton').hide()
  clearComponentInfoStatusMessage()

  document.getElementById('componentInfoModalViewScreenshot').style.display = 'none'
  document.getElementById('componentInfoModalSettingsPermissionsPane').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettings').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettings').style.display = 'none'

  $('#componentInfoModaProejctorTabButton').hide()
  $('#componentInfoModalModelGroup').hide()
  document.getElementById('componentInfoModalProjectorSettings').style.display = 'none'

  // Populate maintenance details
  constMaint.setComponentInfoModalMaintenanceStatus(id)

  // Definition tab
  document.getElementById('definitionTabAppFilterSelect').value = 'all'
  document.getElementById('definitionTabThumbnailsCheckbox').checked = true
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'none'
  if (permission === 'edit') {
    document.getElementById('componentInfoModalNewDefinitionButton').style.display = 'block'
  } else {
    document.getElementById('componentInfoModalNewDefinitionButton').style.display = 'none'
  }

  // Settings tab
  document.getElementById('componentInfoModalFullSettingsButton').style.display = 'none'
  document.getElementById('componentInfoModalDefinitionsTabButton').style.display = 'none'

  $('#componentInfoModalDMXTabButton').hide()
  $('#contentUploadSystemStatsView').hide()

  // Based on the component type, configure the various tabs and panes
  if (obj.type === 'exhibit_component') {
    if (obj.status !== constConfig.STATUS.STATIC) {
      // This is an active component
      configureComponentInfoModalForExhibitComponent(obj, permission)
    } else {
      // This is a static component
      configureComponentInfoModalForStatic(obj, permission, maintenancePermission)
    }
  } else if (obj.type === 'projector') {
    configureComponentInfoModalForProjector(obj)
  } else if (obj.type === 'wol_component') {
    configureComponentInfoModalForWakeOnLAN(obj)
  }

  // Must be after all the settings are configured
  $('[data-bs-toggle="tooltip"]').tooltip()
  $('#componentInfoModalSettingsSaveButton').hide()
  document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'none'

  // Make the modal visible
  $('#componentInfoModal').modal('show')
}

function configureComponentInfoModalForExhibitComponent (obj, permission) {
  // Set up the componentInfoModal to show an exhibit component

  // Configure the settings page with the current settings
  document.getElementById('componentInfoModalBasicSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalBasicSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of constConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }

  $('#componentInfoModalSettingsAppName').val(obj.constellationAppId)
  $('#componentInfoModalFullSettingsButton').prop('href', obj.helperAddress + '?showSettings=true')
  $('#componentInfoModalSettingsAutoplayAudio').val(String(obj.permissions.audio))
  $('#componentInfoModalSettingsAllowRefresh').val(String(obj.permissions.refresh))
  $('#componentInfoModalSettingsAllowRestart').val(String(obj.permissions.restart))
  $('#componentInfoModalSettingsAllowShutdown').val(String(obj.permissions.shutdown))
  $('#componentInfoModalSettingsAllowSleep').val(String(obj.permissions.sleep))

  document.getElementById('componentInfoModalSettingsPermissionsPane').style.display = 'flex'
  document.getElementById('componentInfoModalFullSettingsButton').style.display = 'inline-block'
  document.getElementById('componentInfoModalDefinitionsTabButton').style.display = 'block'

  // Description
  document.getElementById('componentInfoModalDescriptionInput').style.display = 'none'
  document.getElementById('componentInfoModalDescriptionInputLabel').style.display = 'none'
  document.getElementById('componentInfoModalExhibitDescriptionInput').style.display = 'block'

  // Warnings
  document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'none'

  $('#componentInfoModalDefinitionsTabButton').tab('show')

  // This component may be accessible over the network.
  updateComponentInfoModalFromHelper(obj.id, permission)
  configureNewDefinitionOptions(obj)

  // Fetch any DMX lighting scenes and show the tab if necessary
  constTools.makeRequest({
    method: 'GET',
    url: obj.getHelperURL(),
    endpoint: '/DMX/getScenes'
  })
    .then((result) => {
      constDMX.populateDMXScenesForInfoModal(result.groups, obj.getHelperURL())
      document.getElementById('componentInfoModalDMXTabButton').style.display = 'block'
    })
    .catch((error) => {
      document.getElementById('componentInfoModalDMXTabButton').style.display = 'none'
      console.log(error)
    })

  document.getElementById('componentInfoModalViewScreenshot').style.display = 'block'
}

function configureComponentInfoModalForProjector (obj) {
  // Set up the projector status pane of the componentInfoModal with the info
  // from the selected projector

  $('#componentInfoModaProejctorTabButton').show()
  $('#componentInfoModaProejctorTabButton').tab('show')

  // // Projector status pane

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

  // Projetor settings
  document.getElementById('componentInfoModalProjectorSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalProjectorSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of constConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }

  document.getElementById('componentInfoModalProjectorSettingsIPAddress').value = obj.ip_address
  document.getElementById('componentInfoModalProjectorSettingsPassword').value = obj.password
  document.getElementById('componentInfoModalProjectorSettings').style.display = 'block'
  document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'none'
  document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'none'
}

function configureComponentInfoModalForStatic (obj, componentPermission, maintenancePermission) {
  // Configure componentInfoModal to show a static component

  // Check permissions and show the right tab
  if ((componentPermission !== 'edit') && (maintenancePermission === 'none')) {
    // Nothing to show
    document.getElementById('componentInfoModalTabList').style.display = 'none'
    document.getElementById('componentInfoModalTabContainer').style.display = 'none'
    setComponentInfoStatusMessage('Nothing to show')
  } else {
    // Something to show
    document.getElementById('componentInfoModalTabList').style.display = 'flex'
    document.getElementById('componentInfoModalTabContainer').style.display = 'block'
    clearComponentInfoStatusMessage()

    if (maintenancePermission !== 'none') {
      $('#componentInfoModalMaintenanceTabButton').tab('show')
    } else {
      $('#componentInfoModalSettingsTabButton').tab('show')
    }
  }

  document.getElementById('componentInfoModalStaticSettings').style.display = 'block'
  document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'none'

  document.getElementById('componentInfoModalStaticSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalStaticSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of constConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }
}

function configureComponentInfoModalForWakeOnLAN (obj) {
  // Configure componentInfoModal to show a Wake on LAN component

  document.getElementById('componentInfoModalWakeOnLANSettings').style.display = 'block'
  document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'none'
  document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'none'

  document.getElementById('componentInfoModalWakeOnLANSettingsID').value = obj.id

  const groupSelect = document.getElementById('componentInfoModalWakeOnLANSettingsGroup')
  groupSelect.innerHTML = ''
  const defaultOption = new Option('Default', 'Default')
  if (obj.groups.includes('Default')) defaultOption.selected = true
  groupSelect.appendChild(defaultOption)
  for (const group of constConfig.groups) {
    const option = new Option(group.name, group.uuid)
    if (obj.groups.includes(group.uuid)) {
      option.selected = true
    }
    groupSelect.appendChild(option)
  }

  document.getElementById('componentInfoModalWakeOnLANSettingsMAC').value = obj.mac_address
  document.getElementById('componentInfoModalWakeOnLANSettingsIPAddress').value = obj.ip_address
}

function configureNewDefinitionOptions (obj) {
  // Use the given IP address to configure the URLs for creating new definitions.

  Array.from(document.querySelectorAll('.defintion-new-option')).forEach((el) => {
    const app = el.getAttribute('data-app')
    if (app === 'word_cloud_input') {
      el.href = obj.getHelperURL() + '/word_cloud/setup_input.html'
    } else if (app === 'word_cloud_viewer') {
      el.href = obj.getHelperURL() + '/word_cloud/setup_viewer.html'
    } else {
      el.href = obj.getHelperURL() + '/' + app + '/setup.html'
    }
  })
}

export function updateProjectorFromInfoModal () {
  // Collect details from the component info modal and update the proejctor

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalProjectorSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalProjectorSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    ip_address: document.getElementById('componentInfoModalProjectorSettingsIPAddress').value.trim(),
    password: document.getElementById('componentInfoModalProjectorSettingsPassword').value.trim(),
    description: document.getElementById('componentInfoModalDescriptionInput').value.trim(),
    uuid
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsGroupWarning').style.display = 'none'
  }
  if (update.ip_address === '') {
    document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalProjectorSettingsIPWarning').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/projector/' + uuid + '/edit',
    params: update
  })
    .then((response) => {
      if (response.success === true) {
        document.getElementById('componentInfoModalTitle').innerHTML = update.id
        document.getElementById('componentInfoModalProjectorSettingsSaveButton').style.display = 'none'
      }
    })
}

export function updateStaticComponentFromInfoModal () {
  // Collect details from the component info modal and update the static component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalStaticSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalStaticSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    description: document.getElementById('componentInfoModalDescriptionInput').value.trim()
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalStaticSettingsIDWarning').style.display = 'none'
  }
  if (update.groups.length === 0) {
    document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalStaticSettingsGroupWarning').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/static/' + uuid + '/edit',
    params: update
  })
    .then(() => {
      document.getElementById('componentInfoModalStaticSettingsSaveButton').style.display = 'none'
      document.getElementById('componentInfoModalTitle').innerHTML = document.getElementById('componentInfoModalStaticSettingsID').value.trim()
      rebuildComponentInterface()
    })
}

export function updateWakeOnLANComponentFromInfoModal () {
  // Collect details from the component info modal and update the Wake on LAN component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalWakeOnLANSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalWakeOnLANSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    mac_address: document.getElementById('componentInfoModalWakeOnLANSettingsMAC').value.trim(),
    ip_address: document.getElementById('componentInfoModalWakeOnLANSettingsIPAddress').value.trim(),
    description: document.getElementById('componentInfoModalDescriptionInput').value.trim()
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsGroupWarning').style.display = 'none'
  }

  if (update.mac_address.replaceAll(':', '').replaceAll('-', '').length !== 12) {
    document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalWakeOnLANSettingsMACWarning').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/WOL/' + uuid + '/edit',
    params: update
  })
    .then(() => {
      document.getElementById('componentInfoModalWakeOnLANSettingsSaveButton').style.display = 'none'
      document.getElementById('componentInfoModalTitle').innerHTML = document.getElementById('componentInfoModalWakeOnLANSettingsID').value.trim()
      rebuildComponentInterface()
    })
}

export function convertAppIDtoDisplayName (appName) {
  // Convert app names to their display text

  let displayName = 'Unknown Component'
  if (appName !== '') {
    const constellationAppIdDisplayNames = {
      dmx_control: 'DMX Control',
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
  titleCol.classList = 'col-8 bg-primary text-white'
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
    stateCol.classList += ' bg-success text-white'
  } else {
    stateCol.innerHTML = 'Off'
    stateCol.classList += ' bg-info text-dark'
  }
  row1.appendChild(stateCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const hoursCol = document.createElement('div')
  hoursCol.classList = 'col-12 bg-secondary py-1 text-center text-white'
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

function populateComponentDefinitionList (definitions, thumbnails, permission) {
  // Take a dictionary of definitions and convert it to GUI elements.

  const component = getExhibitComponent($('#componentInfoModal').data('id'))

  $('#componentInfoModalDefinitionList').empty()

  const sortedByName = Object.keys(definitions).sort((a, b) => {
    try {
      const aName = definitions[a].name.toLowerCase()
      const bName = definitions[b].name.toLowerCase()
      if (aName > bName) return 1
      if (aName < bName) return -1
    } catch {

    }
    return 0
  })
  sortedByName.forEach((uuid) => {
    if ((uuid.slice(0, 9) === '__preview') || uuid.trim() === '') return

    const definition = definitions[uuid]

    const col = document.createElement('div')
    col.setAttribute('id', 'definitionButton_' + uuid)
    col.classList = 'col-6 col-sm-4 mt-2 handCursor definition-entry'
    $(col).data('definition', definition)
    col.setAttribute('data-app', definition.app)

    const row = document.createElement('div')
    row.classList = 'row px-2'
    col.appendChild(row)

    const btnGroupCol = document.createElement('div')
    btnGroupCol.classList = 'col-12 px-0 mx-0'
    row.appendChild(btnGroupCol)

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100'
    btnGroupCol.appendChild(btnGroup)

    const name = document.createElement('button')
    name.setAttribute('id', 'definitionButtonName_' + uuid)
    name.classList = 'btn btn-primary definition-name w-75'
    name.style.borderBottomLeftRadius = '0'
    if (component.definition === definition.uuid) {
      name.classList.remove('btn-primary')
      name.classList.add('btn-success')
    }
    if (permission === 'edit') {
      name.addEventListener('click', () => {
        handleDefinitionItemSelection(uuid)
      })
    }

    name.style.fontSize = '18px'
    name.innerHTML = definition.name
    btnGroup.appendChild(name)

    const dropdownBtn = document.createElement('button')
    dropdownBtn.classList = 'btn btn-primary dropdown-toggle dropdown-toggle-split definition-dropdown'
    dropdownBtn.setAttribute('id', 'definitionButtonDropdown_' + uuid)
    dropdownBtn.style.borderBottomRightRadius = '0'
    dropdownBtn.setAttribute('data-bs-toggle', 'dropdown')
    dropdownBtn.setAttribute('aria-haspopup', 'true')
    dropdownBtn.setAttribute('aria-expanded', 'false')
    dropdownBtn.innerHTML = '<span class="visually-hidden">Toggle Dropdown</span>'
    if (component.definition === definition.uuid) {
      dropdownBtn.classList.remove('btn-primary')
      dropdownBtn.classList.add('btn-success')
    }
    btnGroup.appendChild(dropdownBtn)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    let html = `
    <a class="dropdown-item" href="${component.getHelperURL() + '/' + definition.app + '.html?standalone=true&definition=' + uuid}" target="_blank">Preview</a>
    `
    if (permission === 'edit') {
      html += `
      <a class="dropdown-item" href="${component.getHelperURL() + '/' + definition.app + '/setup.html?definition=' + uuid}" target="_blank">Edit</a>
      `
    }
    dropdownMenu.innerHTML = html
    btnGroup.appendChild(dropdownMenu)

    if (thumbnails.includes(uuid + '.mp4')) {
      const thumbCol = document.createElement('div')
      thumbCol.classList = 'col-12 bg-secondary pt-2 definition-thumbnail'
      if (permission === 'edit') {
        thumbCol.addEventListener('click', () => {
          handleDefinitionItemSelection(uuid)
        })
      }

      row.append(thumbCol)

      const thumb = document.createElement('video')
      thumb.style.height = '100px'
      thumb.style.width = '100%'
      thumb.style.objectFit = 'contain'
      thumb.setAttribute('autoplay', true)
      thumb.muted = 'true'
      thumb.setAttribute('loop', 'true')
      thumb.setAttribute('playsinline', 'true')
      thumb.setAttribute('webkit-playsinline', 'true')
      thumb.setAttribute('disablePictureInPicture', 'true')
      thumb.src = component.getHelperURL() + '/thumbnails/' + uuid + '.mp4'
      thumbCol.appendChild(thumb)
    } else if (thumbnails.includes(uuid + '.jpg')) {
      const thumbCol = document.createElement('div')
      thumbCol.classList = 'col-12 bg-secondary pt-2 definition-thumbnail'
      if (permission === 'edit') {
        thumbCol.addEventListener('click', () => {
          handleDefinitionItemSelection(uuid)
        })
      }
      row.append(thumbCol)

      const thumb = document.createElement('img')
      thumb.style.height = '100px'
      thumb.style.width = '100%'
      thumb.style.objectFit = 'contain'
      thumb.src = component.getHelperURL() + '/thumbnails/' + uuid + '.jpg'
      thumbCol.appendChild(thumb)
    }

    const app = document.createElement('div')
    app.classList = 'col-12 bg-secondary text-dark rounded-bottom pb-1'
    app.setAttribute('id', 'definitionButtonApp_' + uuid)
    app.innerHTML = convertAppIDtoDisplayName(definition.app)
    if (permission === 'edit') {
      app.addEventListener('click', () => {
        handleDefinitionItemSelection(uuid)
      })
    }

    row.appendChild(app)

    $('#componentInfoModalDefinitionList').append(col)
  })
}

function handleDefinitionItemSelection (uuid) {
  // Called when a user clicks on the definition in the componentInfoModal.

  $('.definition-entry').removeClass('definition-selected')
  $('.definition-name').removeClass('btn-success')
  $('.definition-name').addClass('btn-primary')
  $('.definition-dropdown').removeClass('btn-success')
  $('.definition-dropdown').addClass('btn-primary')
  $('#definitionButton_' + uuid).addClass('definition-selected')
  $('#definitionButtonName_' + uuid).addClass('btn-success')
  $('#definitionButtonDropdown_' + uuid).addClass('btn-success')
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'block'
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
  document.getElementById('componentInfoModalDefinitionSaveButton').style.display = 'none'
}

function updateComponentInfoModalFromHelper (id, permission) {
  // Ask the given helper to send an update and use it to update the interface.

  const obj = getExhibitComponent(id)

  const url = obj.getHelperURL()
  if (url == null) {
    // We don't have enough information to contact the helper
    componentCannotConnect()

    // Make the modal visible
    $('#componentInfoModal').modal('show')
    return
  }

  setComponentInfoStatusMessage('Connecting to component...')
  constTools.makeRequest({
    method: 'GET',
    url,
    endpoint: '/getAvailableContent',
    timeout: 3000
  })
    .then((availableContent) => {
      // Good connection, so show the interface elements
      componentGoodConnection()

      // Create entries for available definitions
      if (availableContent.definitions != null) {
        populateComponentDefinitionList(availableContent.definitions, availableContent.thumbnails, permission)
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
    })
    .catch(() => {
      componentCannotConnect()
    })
}

export function onDefinitionTabThumbnailsCheckboxChange () {
  // Show/hide the definition thumbnails

  const defList = document.getElementById('componentInfoModalDefinitionList')
  const checkState = document.getElementById('definitionTabThumbnailsCheckbox').checked

  Array.from(defList.querySelectorAll('.definition-thumbnail')).forEach((entry) => {
    if (checkState === true) {
      entry.style.display = 'block'
    } else {
      entry.style.display = 'none'
    }
  })
}

export function filterDefinitionListByApp () {
  // Hide the definition widgets for any app not matching the specified one.

  const appToShow = document.getElementById('definitionTabAppFilterSelect').value
  const defList = document.getElementById('componentInfoModalDefinitionList')

  Array.from(defList.querySelectorAll('.definition-entry')).forEach((entry) => {
    const thisApp = entry.getAttribute('data-app')
    if ((thisApp === appToShow) || (appToShow === 'all')) {
      entry.style.display = 'block'
    } else {
      entry.style.display = 'none'
    }
  })
}

export function submitComponentBasicSettingsChange () {
  // Update the id, group, and description of an exhibit component

  const uuid = document.getElementById('componentInfoModal').getAttribute('data-uuid')

  const groupSelect = document.getElementById('componentInfoModalBasicSettingsGroup')
  const selectedGroups = groupSelect.selectedOptions
  const selectedGroupUUIDs = Array.from(selectedGroups).map(({ value }) => value)

  const update = {
    id: document.getElementById('componentInfoModalBasicSettingsID').value.trim(),
    groups: selectedGroupUUIDs,
    description: document.getElementById('componentInfoModalExhibitDescriptionInput').value.trim(),
    uuid
  }

  const descriptionEl = document.getElementById('componentInfoModalDescription')
  if (update.description !== '') {
    descriptionEl.innerHTML = update.description
    descriptionEl.style.display = 'block'
  } else {
    descriptionEl.style.display = 'none'
  }

  // Check that fields are properly filled out
  if (update.id === '') {
    document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalBasicSettingsIDWarning').style.display = 'none'
  }
  if (update.group === '') {
    document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'block'
    return
  } else {
    document.getElementById('componentInfoModalBasicSettingsGroupWarning').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/' + uuid + '/edit',
    params: update
  })
    .then((response) => {
      if (response.success === true) {
        document.getElementById('componentInfoModalTitle').innerHTML = update.id
        document.getElementById('componentInfoModalBasicSettingsSaveButton').style.display = 'none'
      }
    })
}

export function submitComponentSettingsChange () {
  // Collect the current settings and send them to the component's helper for saving.

  const obj = getExhibitComponent($('#componentInfoModalTitle').html())

  // Update component settings, if allowed
  const settingsAvailable = document.getElementById('componentInfoModalSettingsPermissionsPane').style.display === 'flex'
  if (settingsAvailable === true) {
    const settings = {
      permissions: {
        audio: constTools.stringToBool($('#componentInfoModalSettingsAutoplayAudio').val()),
        refresh: constTools.stringToBool($('#componentInfoModalSettingsAllowRefresh').val()),
        restart: constTools.stringToBool($('#componentInfoModalSettingsAllowRestart').val()),
        shutdown: constTools.stringToBool($('#componentInfoModalSettingsAllowShutdown').val()),
        sleep: constTools.stringToBool($('#componentInfoModalSettingsAllowSleep').val())
      }
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
  }

  // Update component description
  const description = document.getElementById('componentInfoModalDescriptionInput').value.trim()
  const descriptionEl = document.getElementById('componentInfoModalDescription')
  // submitComponentDescriptionChange(obj.id, {
  //   description,
  //   id: obj.id
  // })
  descriptionEl.innerHTML = description
  if (description !== '') {
    descriptionEl.style.display = 'block'
  } else {
    descriptionEl.style.display = 'none'
  }
}

export function getExhibitComponent (id) {
  // Function to search the exhibitComponents list for a given id

  const result = constConfig.exhibitComponents.find(obj => {
    return obj.id === id
  })
  return result
}

export function checkForRemovedComponents (update) {
  // Check constConfig.exhibitComponents and remove any components not in `update`

  const updateIDs = []
  update.forEach((component) => {
    updateIDs.push(component.id)
  })

  constConfig.exhibitComponents.forEach((component) => {
    if (updateIDs.includes(component.id) === false) {
      component.remove(false) // Remove from interface, but not the config
    }
  })
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
    } else if (obj.type === 'wol_component') {
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

export function showAddStaticComponentsModal () {
  // Prepare the modal for adding static components and show it.

  // Reset values
  document.getElementById('addStaticComponentModalIDField').value = ''
  document.getElementById('addStaticComponentModalGroupField').value = ''

  // Hide warnings
  document.getElementById('addStaticComponentModalIDError').style.display = 'none'
  document.getElementById('addStaticComponentModalGroupError').style.display = 'none'

  $('#addStaticComponentModal').modal('show')
}

export function submitStaticComponentAdditionFromModal () {
  // Collect the ID and group from the modal and add it to the static configuration

  // Make sure the fields are properly completed
  const group = document.getElementById('addStaticComponentModalGroupField').value.trim()
  const id = document.getElementById('addStaticComponentModalIDField').value.trim()
  if (id === '') {
    document.getElementById('addStaticComponentModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addStaticComponentModalIDError').style.display = 'none'
  }
  if (group === '') {
    document.getElementById('addStaticComponentModalGroupError').style.display = 'block'
    return
  } else {
    document.getElementById('addStaticComponentModalGroupError').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/static/create',
    params: { id, group }
  })
    .then((response) => {
      $('#addStaticComponentModal').modal('hide')
    })
}

export function showAddWakeOnLANModal () {
  // Prepare the modal for adding wake on LAN and show it.

  // Reset values
  document.getElementById('addWakeOnLANModalIDField').value = ''
  document.getElementById('addWakeOnLANModalGroupField').value = ''
  document.getElementById('addWakeOnLANModalIPField').value = ''
  document.getElementById('addWakeOnLANModalMACField').value = ''

  // Hide warnings
  document.getElementById('addWakeOnLANModalIDError').style.display = 'none'
  document.getElementById('addWakeOnLANModalGroupError').style.display = 'none'
  document.getElementById('addWakeOnLANModalMACError').style.display = 'none'
  document.getElementById('addWakeOnLANModalBadMACError').style.display = 'none'

  $('#addWakeOnLANModal').modal('show')
}

export function submitWakeOnLANAdditionFromModal () {
  // Collect details from the modal and add it to the Wake on LAN configuration

  // Check that the fields are properly filled out
  const group = document.getElementById('addWakeOnLANModalGroupField').value.trim()
  const id = document.getElementById('addWakeOnLANModalIDField').value.trim()
  const ipAddress = document.getElementById('addWakeOnLANModalIPField').value.trim()
  const macAddress = document.getElementById('addWakeOnLANModalMACField').value.trim()

  if (id === '') {
    document.getElementById('addWakeOnLANModalIDError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalIDError').style.display = 'none'
  }
  if (group === '') {
    document.getElementById('addWakeOnLANModalGroupError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalGroupError').style.display = 'none'
  }
  if (macAddress === '') {
    document.getElementById('addWakeOnLANModalMACError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalMACError').style.display = 'none'
  }
  const shortMAC = macAddress.replaceAll(':', '').replaceAll('-', '')
  if (shortMAC.length !== 12) {
    document.getElementById('addWakeOnLANModalBadMACError').style.display = 'block'
    return
  } else {
    document.getElementById('addWakeOnLANModalBadMACError').style.display = 'none'
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/component/WOL/create',
    params: {
      group,
      id,
      ip_address: ipAddress,
      mac_address: macAddress
    }
  })
    .then((response) => {
      $('#addWakeOnLANModal').modal('hide')
    })
}
