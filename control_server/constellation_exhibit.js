import constConfig from './config.js'
import * as constTools from './constellation_tools.js'
import * as constMaint from './constellation_maintenance.js'

export class ExhibitComponent {
  constructor (id, type) {
    this.id = id
    this.type = type
    this.content = null
    this.ip = '' // Default; will be replaced when component pings in
    this.helperPort = 8000 // Default; will be replaced when component pings in
    this.helperAddress = null // Full address to the helper
    this.state = {}
    this.status = constConfig.STATUS.OFFLINE
    this.lastContactDateTime = null
    this.allowed_actions = []
    this.AnyDeskID = ''
    this.constellationAppId = ''
    this.platformDetails = {}
  }

  getURL () {
    // Return the url for the helper of this component.

    let url
    if (this.helperAddress != null) {
      url = this.helperAddress
    } else if (this.ip != null && this.helperPort != null) {
      url = `http://${this.ip}:${this.helperPort}`
    } else {
      url = null
    }
    return url
  }

  remove () {
    // Remove the component from its ComponentGroup
    getExhibitComponentGroup(this.type).removeComponent(this.id)
    // Remove the component from the exhibitComponents list
    const thisInstance = this
    constConfig.exhibitComponents = $.grep(constConfig.exhibitComponents, function (el, idx) { return el.id === thisInstance.id }, true)
    // Cancel the pollingFunction
    clearInterval(this.pollingFunction)
    // Rebuild the interface
    rebuildComponentInterface()
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
    if (getExhibitComponentGroup(this.type).components.length > 7) {
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
      showExhibitComponentInfo(thisId)
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

    $('#' + this.type + 'ComponentList').append(col)
  }
}

export class ExhibitComponentGroup {
  constructor (type) {
    this.type = type
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
    const thisType = this.type
    if (this.type === 'PROJECTOR') {
      onCmdName = 'power_on'
      offCmdName = 'sleepDisplay'
    } else {
      onCmdName = 'wakeDisplay'
      offCmdName = 'sleepDisplay'
    }
    let displayRefresh = 'block'
    if (['PROJECTOR', 'WAKE_ON_LAN'].includes(this.type) === true) {
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
    mainButton.innerHTML = this.type
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
      sendGroupCommand(thisType, 'refresh_page')
    }, false)
    dropdownMenu.appendChild(refreshOption)

    const wakeOption = document.createElement('a')
    wakeOption.classList = 'dropdown-item handCursor'
    wakeOption.innerHTML = 'Wake all components'
    wakeOption.addEventListener('click', function () {
      sendGroupCommand(thisType, onCmdName)
    }, false)
    dropdownMenu.appendChild(wakeOption)

    const sleepOption = document.createElement('a')
    sleepOption.classList = 'dropdown-item handCursor'
    sleepOption.innerHTML = 'Sleep all components'
    sleepOption.addEventListener('click', function () {
      sendGroupCommand(thisType, offCmdName)
    }, false)
    dropdownMenu.appendChild(sleepOption)

    const componentList = document.createElement('div')
    componentList.classList = 'row'
    componentList.setAttribute('id', thisType + 'ComponentList')
    col.appendChild(componentList)

    $('#componentGroupsRow').append(col)

    this.components.forEach((component) => {
      component.buildHTML()
    })
  }
}

export function updateComponentFromServer (component) {
  // Read the dictionary of component information from the control server
  // and use it to set up the component

  const obj = getExhibitComponent(component.id)
  if (obj != null) {
    // Update the object with the latest info from the server
    obj.setStatus(component.status)
    if ('content' in component) {
      obj.content = component.content
    }
    if ('ip_address' in component) {
      obj.ip = component.ip_address
    }
    if ('helperPort' in component) {
      obj.helperPort = component.helperPort
    }
    if ('helperAddress' in component) {
      obj.helperAddress = component.helperAddress
    }
    if ('allowed_actions' in component) {
      obj.allowed_actions = component.allowed_actions
    }
    if ('description' in component) {
      obj.description = component.description
    }
    if ('platform_details' in component) {
      obj.platformDetails = component.platform_details
    }
    if ('lastContactDateTime' in component) {
      obj.lastContactDateTime = component.lastContactDateTime
    }
    if ('AnyDeskID' in component) {
      obj.AnyDeskID = component.AnyDeskID
    }
    if ('autoplay_audio' in component) {
      obj.autoplay_audio = component.autoplay_audio
    }
    if ('image_duration' in component) {
      obj.image_duration = component.image_duration
    }
    if ('error' in component) {
      try {
        const newError = JSON.parse(component.error)
        constConfig.errorDict[obj.id] = newError
      } catch (e) {
        console.log("Error parsing 'error' field from ping. It should be a stringified JSON expression. Received:", component.error)
        console.log(e)
      }
      constTools.rebuildErrorList()
    }
  } else {
    // First, make sure the group matching this type exists
    let group = getExhibitComponentGroup(component.type)
    if (group == null) {
      group = new ExhibitComponentGroup(component.type)
      constConfig.componentGroups.push(group)
    }

    // Then create a new component
    const newComponent = new ExhibitComponent(component.id, component.type)
    newComponent.setStatus(component.status)
    if ('allowed_actions' in component) {
      newComponent.allowed_actions = component.allowed_actions
    }
    if ('constellation_app_id' in component) {
      newComponent.constellationAppId = component.constellation_app_id
    }
    if ('platform_details' in component) {
      newComponent.platformDetails = component.platform_details
    }
    newComponent.buildHTML()
    constConfig.exhibitComponents.push(newComponent)

    // Add the component to the right group
    group.addComponent(newComponent)

    // Finally, call this function again to populate the information
    updateComponentFromServer(component)
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

export function getExhibitComponentGroup (type) {
  // Function to search the exhibitComponents list for a given id

  const result = constConfig.componentGroups.find(obj => {
    return obj.type === type
  })
  return result
}

export function showExhibitComponentInfo (id) {
  // This sets up the componentInfoModal with the info from the selected
  // component and shows it on the screen.

  if (id === '') {
    id = $('#componentInfoModalTitle').html()
  }

  const obj = getExhibitComponent(id)

  $('#componentInfoModalTitle').html(id)

  $('#constellationComponentIdButton').html(convertAppIDtoDisplayName(obj.constellationAppId))
  if (obj.ip !== '') {
    $('#componentInfoModalIPAddress').html(obj.ip)
    $('#componentInfoModalIPAddressGroup').show()
  } else {
    $('#componentInfoModalIPAddressGroup').hide()
  }
  if (obj.ip !== constTools.extractIPAddress(obj.helperAddress)) {
    $('#componentInfoModalHelperIPAddress').html(constTools.extractIPAddress(obj.helperAddress))
    $('#componentInfoModalHelperIPAddressGroup').show()
  } else {
    $('#componentInfoModalHelperIPAddressGroup').hide()
  }
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
  if (obj.lastContactDateTime != null) {
    $('#componentInfoModalLastContact').html(constTools.formatDateTimeDifference(new Date(), new Date(obj.lastContactDateTime)))
    $('#componentInfoModalLastContactGroup').show()
  } else {
    $('#componentInfoModalLastContactGroup').hide()
  }
  if (obj.description === '') {
    $('#componentInfoModalDescription').hide()
  } else {
    $('#componentInfoModalDescription').html(obj.description)
    $('#componentInfoModalDescription').show()
  }
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

  // Must be after all the settings are configured
  toggleExhibitComponentInfoSettingWarnings()
  $('#componentInfoModalSettingsSaveButton').hide()
  // Hide settings for static components
  if (obj.status === constConfig.STATUS.STATIC) {
    $('#componentInfoModalSettingsTabButton').hide()
    $('#componentInfoModalContentTabButton').hide()
  } else {
    $('#componentInfoModalSettingsTabButton').show()
    $('#componentInfoModalContentTabButton').show()
  }

  if (obj.status !== constConfig.STATUS.STATIC) {
    // This component may be accessible over the network.
    updateComponentInfoModalFromHelper(obj.id)
  } else {
    // This static component will defintely have no content.
    $('#componentInfoConnectionStatusFailed').show()
    $('#componentInfoConnectionStatusInPrograss').hide()

    // Show the maintenance tab
    $('#componentInfoModalMaintenanceTabButton').tab('show')
  }

  // Make the modal visible
  $('#componentInfoModal').modal('show')
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
      sos_kiosk: 'SOS Kiosk',
      sos_screen_player: 'SOS Screen Player',
      static_component: 'Static component',
      timelapse_viewer: 'Timelapse Viewer',
      voting_kiosk: 'Voting Kiosk',
      word_cloud_input: 'Word Cloud Input',
      word_cloud_viewer: 'Word Cloud Viewer'
    }
    if (appName in constellationAppIdDisplayNames) {
      displayName = constellationAppIdDisplayNames[appName]
    }
  }

  return displayName
}

function updateComponentInfoModalFromHelper (id) {
  // Ask the given helper to send an update and use it to update the interface.

  const obj = getExhibitComponent(id)

  const url = obj.getURL()
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
    container.classList = 'col-6 mt-1'

    // Check if this file type is supported by the current app
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
    button.innerHTML = `<span>${contentList[i]}</span>`

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

    const deleteFileButton = document.createElement('a')
    deleteFileButton.classList = 'dropdown-item text-danger'
    const file = contentList[i]
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
    media_player: ['jpeg', 'jpg', 'gif', 'tiff', 'tif', 'png', 'webp', 'heic', 'mpeg', 'mpeg4', 'mp4', 'webm', 'm4v', 'avi', 'mov', 'mkv', 'ogv'],
    media_player_kiosk: ['ini'],
    sos_kiosk: ['ini'],
    sos_screen_player: ['ini'],
    timelapse_viewer: ['ini'],
    voting_kiosk: ['ini'],
    word_cloud: ['ini']
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
    url: obj.getURL(),
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
      url: obj.getURL(),
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
  if (['shutdown', 'restart'].includes(cmd)) {
    // We send these commands directly to the helper
    constTools.makeRequest({
      method: 'GET',
      url: obj.getURL(),
      endpoint: '/' + cmd
    })
  } else {
    // We send these commands to the server to pass to the component itself
    let cmdPath = ''
    switch (obj.type) {
      case 'PROJECTOR':
        cmdPath = '/projector/queueCommand'
        break
      case 'WAKE_ON_LAN':
        cmdPath = '/exhibit/queueWOLCommand'
        break
      default:
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
  $('#manageStaticComponentsEditTypeInput').val(null)
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

  const typeCol = document.createElement('div')
  typeCol.classList = 'col-12 bg-secondary py-1 px-1 text-center'
  typeCol.setAttribute('id', 'manageStaticComponentsType_' + cleanID)
  typeCol.style.borderBottomLeftRadius = '0.25rem'
  typeCol.style.borderBottomRightRadius = '0.25rem'
  typeCol.innerHTML = entry.type
  row2.appendChild(typeCol)
}

function populateManageStaticComponentsEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageStaticComponents_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageStaticComponentsEditIDInput').data('id', id)

  $('#manageStaticComponentsEditIDInput').val(details.id)
  $('#manageStaticComponentsEditTypeInput').val(details.type)
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

  const newType = $('#manageStaticComponentsEditTypeInput').val()
  if (newType != null && newType !== '') {
    $('#manageStaticComponentsType_' + id).html(newType)
    details.type = newType
  } else {
    $('#manageStaticComponentsType_' + id).html('STATIC')
    details.type = 'STATIC'
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
  $('#manageStaticComponentsEditTypeInput').val(null)
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
