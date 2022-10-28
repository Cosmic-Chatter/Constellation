/* global serverIP */

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

    if (this.type === 'PROJECTOR') {
      this.checkProjector()
      const thisInstance = this
      this.pollingFunction = setInterval(function () { thisInstance.checkProjector() }, 5000)
    }
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

  checkProjector () {
    // Function to ask the server to ping the projector
    const thisInstance = this
    const requestDict = {
      id: this.id
    }

    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('POST', serverIP + '/projector/getUpdate', true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return

      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

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
      }
    }
    xhr.send(JSON.stringify(requestDict))
  }

  setStatus (status) {
    this.status = constConfig.STATUS[status]
    $('#' + this.id + 'StatusField').html(this.status.name)

    const btnClass = this.status.colorClass
    // Strip all existing classes, then add the new one
    $('#' + this.id + 'MainButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
    $('#' + this.id + 'DropdownButton').removeClass('btn-primary btn-warning btn-danger btn-success btn-info').addClass(btnClass)
  }

  // getButtonColorClass () {
  //   // Get the Bootstrap class based on the current status

  //   switch (this.status) {
  //     case 'ACTIVE':
  //       return 'btn-primary'
  //     case 'ONLINE':
  //       return 'btn-success'
  //     case 'WAITING':
  //       return 'btn-warning'
  //     case 'UNKNOWN':
  //       return 'btn-warning'
  //     case 'STANDBY':
  //       return 'btn-info'
  //     case 'SYSTEM ON':
  //       return 'btn-info'
  //     case 'STATIC':
  //       return 'btn-secondary'
  //     default:
  //       return 'btn-danger'
  //   }
  // }

  buildHTML () {
    // Function to build the HTML representation of this component
    // and add it to the row of the parent group

    // If the element is static and the 'Show STATIC' checkbox is ticked, bail out
    if (this.status === constConfig.STATUS.STATIC && $('#componentsTabSettingsShowStatic').prop('checked') === false) {
      return
    }

    let onCmdName = ''
    let offCmdName = ''
    let offCmd = ''
    const displayName = this.id
    const thisId = this.id
    switch (this.type) {
      case 'PROJECTOR':
        onCmdName = 'Wake projector'
        offCmdName = 'Sleep projector'
        offCmd = 'sleepDisplay'
        break
      case 'WAKE_ON_LAN':
        onCmdName = 'Wake component'
        offCmdName = 'Sleep component'
        offCmd = 'shutdown'
        break
      default:
        onCmdName = 'Wake component'
        offCmdName = 'Shutdown component'
        offCmd = 'shutdown'
    }

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
        option.innerHTML = offCmdName
        cmd = offCmd
      } else if (action === 'power_on') {
        option.innerHTML = onCmdName
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

  if (obj.type === 'PROJECTOR') {
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
  } else { // This is a normal ExhibitComponent
    $('#componentInfoModalTitle').html(id)
    let constellationAppId = 'Unknown Component'
    if (obj.constellationAppId !== '') {
      const constellationAppIdDisplayNames = {
        heartbeat: 'HeartBeat',
        infostation: 'InfoStation',
        media_browser: 'Media Browser',
        media_player: 'Media Player',
        media_player_kiosk: 'Media Player Kiosk',
        sos_kiosk: 'SOS Kiosk',
        sos_screen_player: 'SOS Screen Player',
        static_component: 'Static component',
        timelapse_viewer: 'Timelapse Viewer',
        voting_kiosk: 'Voting Kiosk',
        word_cloud: 'Word Cloud'
      }
      if (obj.constellationAppId in constellationAppIdDisplayNames) {
        constellationAppId = constellationAppIdDisplayNames[obj.constellationAppId]
      }
    }
    $('#constellationComponentIdButton').html(constellationAppId)
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

    const showFailureMessage = function () {
      $('#componentInfoConnectionStatusFailed').show()
      $('#componentInfoConnectionStatusInPrograss').hide()
    }

    if (obj.status !== constConfig.STATUS.STATIC) {
      // This component may be accessible over the network.

      const requestString = JSON.stringify({ action: 'getAvailableContent' })
      const xhr = new XMLHttpRequest()

      if (obj.helperAddress != null) {
        xhr.open('POST', obj.helperAddress, true)
      } else if (obj.ip != null && obj.helperPort != null) {
        xhr.open('POST', `http://${obj.ip}:${obj.helperPort}`, true)
      } else {
        // We don't have enough information to contact the helper
        showFailureMessage()
        // Show the maintenance tab
        $('#componentInfoModalMaintenanceTabButton').tab('show')
        // Make the modal visible
        $('#componentInfoModal').modal('show')
        return
      }
      xhr.timeout = 10000 // 10 seconds
      xhr.ontimeout = showFailureMessage
      xhr.onerror = showFailureMessage
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.onreadystatechange = function () {
        if (this.readyState !== 4) return

        if (this.status === 200) {
          // Good connection, so show the interface elements
          $('#componentAvailableContentRow').show()
          $('#componentcontentUploadInterface').show()
          $('#componentInfoConnectingNotice').hide()

          const availableContent = JSON.parse(this.response)

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

          const populateContent = function (key, id, div) {
            // Get filenames listed under key in availableContent and add
            // the resulting buttons to the div given by div

            const activeContent = availableContent.active_content
            const contentList = availableContent[key].sort(function (a, b) { return a.localeCompare(b) })
            let thumbnailList = availableContent.thumbnails
            if (thumbnailList == null) {
              thumbnailList = []
            }
            let active

            for (let i = 0; i < contentList.length; i++) {
              if (activeContent.includes(contentList[i])) {
                active = 'btn-primary'
              } else {
                active = 'btn-secondary'
              }

              const container = document.createElement('div')
              container.classList = 'col-6 mt-1'

              const btnGroup = document.createElement('div')
              btnGroup.classList = 'btn-group w-100 h-100'
              container.appendChild(btnGroup)

              const button = document.createElement('button')
              const cleanFilename = contentList[i].split('.').join('').split(')').join('').split('(').join('').split(/[\\/]/).join('').replace(/\s/g, '')
              button.setAttribute('type', 'button')
              button.setAttribute('id', cleanFilename + 'Button')
              button.classList = `btn componentContentButton ${active}`
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
              dropdownButton.classList = `btn dropdown-toggle dropdown-toggle-split componentContentDropdownButton ${active}`
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
          }

          // Build buttons for each file in all exhibits
          populateContent('all_exhibits', id, 'componentAvailableContentList')

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
        }
      }
      xhr.send(requestString)
    } else {
      // This static component will defintely have no content.
      showFailureMessage()
      // Show the maintenance tab
      $('#componentInfoModalMaintenanceTabButton').tab('show')
    }

    // Make the modal visible
    $('#componentInfoModal').modal('show')
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
    const requestString = JSON.stringify({
      action: 'deleteFile',
      file: fileToDelete,
      fromExhibit: exhibit
    })

    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    if (obj.helperAddress != null) {
      xhr.open('POST', obj.helperAddress, true)
    } else {
      xhr.open('POST', `http://${obj.ip}:${obj.helperPort}`, true)
    }
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(requestString)
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          if (response.success === true) {
            model.modal('hide')
            showExhibitComponentInfo(id)
          }
        }
      }
    }
  }
}

export function rebuildComponentInterface () {
  // Clear the componentGroupsRow and rebuild it

  document.getElementById('componentGroupsRow').innerHTML = ''
  let i
  for (i = 0; i < constConfig.componentGroups.length; i++) {
    constConfig.componentGroups[i].buildHTML()
    constConfig.componentGroups[i].sortComponentList()
  }
  // for (i = 0; i < constConfig.exhibitComponents.length; i++) {
  //   constConfig.exhibitComponents[i].buildHTML()
  // }
}

export function queueCommand (id, cmd) {
  // Function to send a command to the control server that will then
  // be sent to the component the next time it pings the server

  const obj = getExhibitComponent(id)
  let requestDict, xhr
  if (['shutdown', 'restart'].includes(cmd)) {
    // We send these commands directly to the helper
    requestDict = { action: cmd }

    xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    if (obj.helperAddress != null) {
      xhr.open('POST', obj.helperAddress, true)
    } else {
      xhr.open('POST', `http://${obj.ip}:${obj.helperPort}`, true)
    }

    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(JSON.stringify(requestDict))
  } else {
    // We send these commands to the server to pass to the component itself
    let cmdType = ''
    let cmdPath = ''
    switch (obj.type) {
      case 'PROJECTOR':
        cmdType = 'queueProjectorCommand'
        cmdPath = '/projector/queueCommand'
        break
      case 'WAKE_ON_LAN':
        cmdType = 'queueWOLCommand'
        cmdPath = '/exhibit/queueWOLCommand'
        break
      default:
        cmdType = 'queueCommand'
        cmdPath = '/exhibit/queueCommand'
    }

    requestDict = {
      class: 'webpage',
      id,
      command: cmd,
      action: cmdType
    }

    xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('POST', serverIP + cmdPath, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(JSON.stringify(requestDict))
  }
}
