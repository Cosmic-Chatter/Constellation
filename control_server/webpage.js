/* global serverIP, showdown */

import constConfig from './config.js'
import * as constTools from './constellation_tools.js'
import * as constExhibit from './constellation_exhibit.js'
import * as constTracker from './constellation_tracker.js'

// let currentExhibit = ''
// const exhibitComponents = []
// const componentGroups = []
// const errorDict = {} // Will hold errors to display
const markdownConverter = new showdown.Converter()
markdownConverter.setFlavor('github')
let scheduleUpdateTime = 0
// let serverSoftwareUpdateAvailable = false
let issueList = []
let assignableStaff = []

class ExhibitComponentGroup {
  constructor (type) {
    this.type = type
    this.components = []
    this.buildHTML()
  }

  addComponent (component) {
    this.components.push(component)
    this.sortComponentList()

    // When we reach 8 components, rebuild the interface so that this group
    // expands to double width
    if (this.components.length === 8) {
      constExhibit.rebuildComponentInterface()
    }
  }

  sortComponentList () {
    // Sort the component list by ID and then rebuild the HTML
    // representation in order

    if (this.components.length > 1) {
      // This line does the sorting
      // this.components.sort((a, b) => (a.id > b.id) ? 1 : ((b.id > a.id) ? -1 : 0))
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

      document.getElementById(this.type + 'ComponentList').innerHTML = ''
      for (let i = 0; i < this.components.length; i++) {
        this.components[i].buildHTML()
      }
    } else {
      this.components[0].buildHTML()
    }
  }

  removeComponent (id) {
    // Remove a component based on its id

    this.components = $.grep(this.components, function (el, idx) { return el.id === id }, true)

    // If the group now has seven components, make sure we're using the small
    // size rendering now by rebuilding the interface
    if (this.components.length === 7) {
      constExhibit.rebuildComponentInterface()
    }
  }

  buildHTML () {
    // Function to build the HTML representation of this group
    // and add it to the componentGroupsRow

    let onCmdName = ''
    let offCmdName = ''
    const thisType = this.type
    if (this.type === 'PROJECTOR') {
      onCmdName = 'Wake all projectors'
      offCmdName = 'Sleep all projectors'
    } else {
      onCmdName = 'Wake all displays'
      offCmdName = 'Sleep all displays'
    }
    let displayRefresh = 'block'
    if (['PROJECTOR', 'WAKE_ON_LAN'].includes(this.type) === true) {
      displayRefresh = 'none'
    }

    // Allow groups with lots of components to display with double width
    let classString
    if (this.components.length > 7) {
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
  }
}

function onUploadContentChange () {
  // When we select a file for uploading, check against the existing files
  // (as defined by their buttons) and warn if we will overwrite. Also
  // check if the filename contains an =, which is not allowed

  // Show the upload button (we may hide it later)
  $('#contentUploadSubmitButton').show()

  const fileInput = $('#componentContentUpload')[0]

  // Check for filename collision and = sign in filename
  const currentFiles = $('.componentContentButton').map(function () { return $(this).find('span').html() }).toArray()
  let collision = false
  let equals = false
  for (let i = 0; i < fileInput.files.length; i++) {
    const file = fileInput.files[i]
    if (currentFiles.includes(file.name)) {
      collision = true
    }
    if (file.name.includes('=')) {
      equals = true
    }
  }
  // Format button text
  if (fileInput.files.length === 1) {
    $('#componentContentUploadfilename').html('File: ' + fileInput.files[0].name)
  } else {
    $('#componentContentUploadfilename').html('Files: ' + fileInput.files[0].name + ` + ${fileInput.files.length - 1} more`)
  }
  if (collision) {
    $('#uploadOverwriteWarning').show()
  } else {
    $('#uploadOverwriteWarning').hide()
  }
  if (equals) {
    $('#contentUploadEqualSignWarning').show()
    $('#contentUploadSubmitButton').hide()
  } else {
    $('#contentUploadEqualSignWarning').hide()
  }
}

function uploadComponentContentFile () {
  const fileInput = $('#componentContentUpload')[0]
  if (fileInput.files[0] != null) {
    const id = $('#componentInfoModalTitle').html().trim()

    const component = constExhibit.getExhibitComponent(id)

    $('#contentUploadSubmitButton').prop('disabled', true)
    $('#contentUploadSubmitButton').html('Working...')

    const file = fileInput.files[0]
    const formData = new FormData()
    formData.append('exhibit', getCurrentExhibitName())
    formData.append('filename', file.name)
    formData.append('mimetype', file.type)
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    if (component.helperAddress != null) {
      xhr.open('POST', component.helperAddress, true)
    } else {
      xhr.open('POST', `http://${component.ip}:${component.helperPort}`, true)
    }
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 422) {
        uploadComponentContentFileFastAPI()
      }
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          constExhibit.queueCommand(id, 'reloadDefaults')
          constExhibit.showExhibitComponentInfo('')
        }
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        $('#contentUploadProgressBar').width(String(percentComplete) + '%')
        if (percentComplete > 0) {
          $('#contentUploadProgressBarContainer').show()
        } else if (percentComplete === 100) {
          $('#contentUploadProgressBarContainer').hide()
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function uploadComponentContentFileFastAPI () {
  // Handle uploading files to the FastAPI-based system helper
  const fileInput = $('#componentContentUpload')[0]

  if (fileInput.files[0] != null) {
    const id = $('#componentInfoModalTitle').html().trim()

    const component = constExhibit.getExhibitComponent(id)

    $('#contentUploadSubmitButton').prop('disabled', true)
    $('#contentUploadSubmitButton').html('Working...')

    const formData = new FormData()

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    // formData.append('filenames', filenames)
    // formData.append('files', files)
    console.log(formData)

    const xhr = new XMLHttpRequest()
    if (component.helperAddress != null) {
      xhr.open('POST', component.helperAddress + '/uploadContent', true)
    } else {
      xhr.open('POST', `http://${component.ip}:${component.helperPort}` + '/uploadContent', true)
    }
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          constExhibit.queueCommand(id, 'reloadDefaults')
          constExhibit.showExhibitComponentInfo('')
        }
      } else if (this.status === 422) {
        console.log(JSON.parse(this.responseText))
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        $('#contentUploadProgressBar').width(String(percentComplete) + '%')
        if (percentComplete > 0) {
          $('#contentUploadProgressBarContainer').show()
        } else if (percentComplete === 100) {
          $('#contentUploadProgressBarContainer').hide()
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function submitComponentContentChange () {
  // Collect the new information from the componentInfoModal and pass it
  // back to the server to be changed.

  const id = $('#componentInfoModalTitle').html().trim()
  const selectedButtons = $('.componentContentButton.btn-primary').find('span')
  // const component = constExhibit.getExhibitComponent(id)
  const contentList = []
  for (let i = 0; i < selectedButtons.length; i++) {
    const content = selectedButtons[i].innerHTML.trim()
    contentList.push(content)
  }

  sendComponentContentChangeRequest(id, contentList)
  askForUpdate()

  // Hide the modal
  $('#componentInfoModal').modal('hide')
}

function sendComponentContentChangeRequest (id, content) {
  // Send a request to the server to initiate a content change

  const requestString = JSON.stringify({
    class: 'webpage',
    action: 'setComponentContent',
    id,
    content
  })
  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.send(requestString)
}

function updateComponentFromServer (component) {
  // Read the dictionary of component information from the control server
  // and use it to set up the component

  const obj = constExhibit.getExhibitComponent(component.id)
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
    let group = constExhibit.getExhibitComponentGroup(component.type)
    if (group == null) {
      group = new ExhibitComponentGroup(component.type)
      constConfig.componentGroups.push(group)
    }

    // Then create a new component
    const newComponent = new constExhibit.ExhibitComponent(component.id, component.type)
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

function setCurrentExhibitName (name) {
  constConfig.currentExhibit = name
  document.getElementById('exhibitNameField').innerHTML = name

  // Don't change the value of the exhibit selector if we're currently
  // looking at the change confirmation modal, as this will result in
  // submitting the incorrect value
  if ($('#changeExhibitModal').hasClass('show') === false) {
    $('#exhibitSelect').val(name)
  }
}

function getCurrentExhibitName () {
  return (document.getElementById('exhibitNameField').innerHTML)
}

function updateAvailableExhibits (exhibitList) {
  for (let i = 0; i < exhibitList.length; i++) {
    // Check if exhibit already exists as an option. If not, add it
    if ($(`#exhibitSelect option[value='${exhibitList[i]}']`).length === 0) {
      $('#exhibitSelect').append(new Option(exhibitList[i], exhibitList[i]))
      $('#exhibitDeleteSelector').append(new Option(exhibitList[i], exhibitList[i]))
    }
  }
  $('#exhibitSelect').children().toArray().forEach((item, i) => {
    if (!exhibitList.includes(item.value)) {
      // Remove item from exhibit selecetor
      $(item).remove()

      // Remove item from exhibit delete selector
      $(`#exhibitDeleteSelector option[value="${item.value}"]`).remove()
    }
  })
  checkDeleteSelection()
}

function changeExhibit (warningShown) {
  // Send a command to the control server to change the current exhibit

  if (warningShown === false) {
    $('#changeExhibitModal').modal('show')
  } else {
    $('#changeExhibitModal').modal('hide')

    const requestDict = {
      class: 'webpage',
      action: 'setExhibit',
      name: $('#exhibitSelect').val()
    }
    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('POST', serverIP, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.send(JSON.stringify(requestDict))

    askForUpdate()
  }
}

function reloadConfiguration () {
  // This function will send a message to the server asking it to reload
  // the current exhibit configuration file and update all the components

  const requestDict = {
    class: 'webpage',
    action: 'reloadConfiguration'
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const response = JSON.parse(this.responseText)

      if ('success' in response) {
        if (response.success === true) {
          $('#reloadConfigurationButton').html('Success!')
          setTimeout(function () { $('#reloadConfigurationButton').html('Reload Config') }, 2000)
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function sendGroupCommand (group, cmd) {
  // Iterate through the components in the given group and queue the command
  // for each

  group = constExhibit.getExhibitComponentGroup(group)

  for (let i = 0; i < group.components.length; i++) {
    constExhibit.queueCommand(group.components[i].id, cmd)
  }
}

function deleteSchedule (name) {
  // Send a message to the control server asking to delete the schedule
  // file with the given name. The name should not include ".ini"

  const requestDict = {
    name
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 3000
  xhr.open('POST', serverIP + '/schedule/deleteSchedule', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        if (update.class === 'schedule') {
          populateSchedule(update)
        }
      }
    }
  }
  xhr.send(requestString)
}

function scheduleConvertToDateSpecific (date, dayName) {
  // Send a message to the control server, asking to create a date-specific
  // schedule out of the given day name

  const requestDict = {
    date,
    from: dayName
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 3000
  xhr.open('POST', serverIP + 'schedule/convert', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        if (update.class === 'schedule') {
          populateSchedule(update)
        }
      }
    }
  }
  xhr.send(requestString)
}

function populateSchedule (schedule) {
  // Take a provided schedule and build the interface to show it.

  document.getElementById('scheduleContainer').innerHTML = ''
  $('#dateSpecificScheduleAlert').hide()

  // Record the timestamp when this schedule was generated
  scheduleUpdateTime = schedule.updateTime
  const sched = schedule.schedule

  sched.forEach((day) => {
    // Apply a background color to date-specific schedules so that we
    // know that they are special
    let scheduleClass
    let addItemText
    let convertState
    let deleteState
    let scheduleName
    if (day.source === 'date-specific') {
      scheduleClass = 'schedule-date-specific'
      addItemText = 'Add date-specific action'
      $('#dateSpecificScheduleAlert').show()
      convertState = 'none'
      deleteState = 'block'
      scheduleName = day.date
    } else {
      scheduleClass = ''
      addItemText = 'Add recurring action'
      convertState = 'block'
      deleteState = 'none'
      scheduleName = day.dayName.toLowerCase()
    }

    const dayContainer = document.createElement('div')
    dayContainer.classList = `col-12 col-sm-6 col-lg-4 mt-3 pt-3 pb-3 ${scheduleClass}`

    const row = document.createElement('div')
    row.classList = 'row'
    dayContainer.appendChild(row)

    const dayNameCol = document.createElement('div')
    dayNameCol.classList = 'col-6 col-sm-12 col-md-6'
    row.appendChild(dayNameCol)

    const dayNameSpan = document.createElement('span')
    dayNameSpan.style.fontSize = '35px'
    dayNameSpan.innerHTML = day.dayName
    dayNameCol.appendChild(dayNameSpan)

    const dateCol = document.createElement('div')
    dateCol.classList = 'col-6 col-sm-12 col-md-6 my-auto'
    dateCol.style.textAlign = 'right'
    row.appendChild(dateCol)

    const dateSpan = document.createElement('strong')
    dateSpan.innerHTML = day.date
    dateCol.appendChild(dateSpan)

    const editButtonCol = document.createElement('div')
    editButtonCol.classList = 'col-12 col-lg-6 mt-2'
    row.appendChild(editButtonCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-primary w-100'
    editButton.setAttribute('type', 'button')
    editButton.innerHTML = addItemText
    editButton.addEventListener('click', function () {
      scheduleConfigureEditModal(scheduleName, day.source)
    })
    editButtonCol.appendChild(editButton)

    const convertButtonCol = document.createElement('div')
    convertButtonCol.classList = 'col-12 col-lg-6 mt-2'
    convertButtonCol.style.display = convertState
    row.appendChild(convertButtonCol)

    const convertButton = document.createElement('button')
    convertButton.classList = 'btn btn-warning w-100'
    convertButton.setAttribute('type', 'button')
    convertButton.innerHTML = 'Convert to date-specific schedule'
    convertButton.addEventListener('click', function () {
      scheduleConvertToDateSpecific(day.date, day.dayName)
    })
    convertButtonCol.appendChild(convertButton)

    const deleteButtonCol = document.createElement('div')
    deleteButtonCol.classList = 'col-12 col-lg-6 mt-2'
    deleteButtonCol.style.display = deleteState
    row.appendChild(deleteButtonCol)

    const deleteButton = document.createElement('button')
    deleteButton.classList = 'btn btn-danger w-100'
    deleteButton.setAttribute('type', 'button')
    deleteButton.innerHTML = 'Delete date-specific schedule'
    deleteButton.addEventListener('click', function () {
      deleteSchedule(day.date)
    })
    deleteButtonCol.appendChild(deleteButton)

    $('#scheduleContainer').append(dayContainer)

    // Loop through the schedule elements and add a row for each
    const scheduleIDs = Object.keys(day.schedule)

    scheduleIDs.forEach((scheduleID) => {
      const item = day.schedule[scheduleID]
      let description = null
      const action = item.action
      const target = item.target
      const value = item.value

      if (['power_off', 'power_on', 'refresh_page', 'restart', 'set_content'].includes(action)) {
        description = populateScheduleDescriptionHelper([item], false)
      } else if (action === 'set_exhibit') {
        description = `Set exhibit: ${target}`
      }

      if (description != null) {
        const eventRow = document.createElement('div')
        eventRow.classList = 'row mt-2 eventListing'
        $(eventRow).data('time_in_seconds', item.time_in_seconds)
        dayContainer.appendChild(eventRow)

        const eventTimeCol = document.createElement('div')
        eventTimeCol.classList = 'col-4 mr-0 pr-0'
        eventRow.appendChild(eventTimeCol)

        const eventTimeContainer = document.createElement('div')
        eventTimeContainer.classList = 'rounded-left text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 pl-1'
        eventTimeCol.appendChild(eventTimeContainer)

        const eventTime = document.createElement('div')
        eventTime.classList = 'align-self-center justify-content-center'
        eventTime.innerHTML = item.time
        eventTimeContainer.appendChild(eventTime)

        const eventDescriptionCol = document.createElement('div')
        eventDescriptionCol.classList = 'col-5 mx-0 px-0'
        eventRow.appendChild(eventDescriptionCol)

        const eventDescriptionOuterContainer = document.createElement('div')
        eventDescriptionOuterContainer.classList = 'text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 pr-1'
        eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

        const eventDescriptionInnerContainer = document.createElement('div')
        eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
        eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

        const eventDescription = document.createElement('center')
        eventDescription.innerHTML = description
        eventDescriptionOuterContainer.appendChild(eventDescription)

        const eventEditButtonCol = document.createElement('div')
        eventEditButtonCol.classList = 'col-3 ml-0 pl-0'
        eventRow.appendChild(eventEditButtonCol)

        const eventEditButton = document.createElement('button')
        eventEditButton.classList = 'btn-info w-100 h-100 rounded-right'
        eventEditButton.setAttribute('type', 'button')
        eventEditButton.style.borderStyle = 'solid'
        eventEditButton.style.border = '0px'
        eventEditButton.innerHTML = 'Edit'
        eventEditButton.addEventListener('click', function () {
          console.log(item)
          scheduleConfigureEditModal(scheduleName, day.source, false, scheduleID, item.time, action, target, value)
        })
        eventEditButtonCol.appendChild(eventEditButton)
      }
    })
    // Sort the elements by time
    const events = $(dayContainer).children('.eventListing')
    events.sort(function (a, b) {
      return $(a).data('time_in_seconds') - $(b).data('time_in_seconds')
    })
    $(dayContainer).append(events)
    // html += "</div>";
    // $("#scheduleContainer").append(html);
  })

  $('#Schedule_next_event').html(populateScheduleDescriptionHelper(schedule.nextEvent, true))
}

function populateScheduleDescriptionHelper (eventList, includeTime) {
  // Helper function to create text strings that describe the upcoming action(s)

  let description = ''

  if (eventList.length === 0) {
    return 'No more actions today'
  } else if (eventList.length === 1) {
    const event = eventList[0]
    description += scheduleActionToDescription(event.action) + ' '
    description += scheduleTargetToDescription(event.target)
  } else {
    const action = eventList[0].action
    let allSame = true
    eventList.forEach((event) => {
      if (event.action !== action) {
        allSame = false
      }
    })
    if (allSame) {
      description += scheduleActionToDescription(action) + ' multiple'
    } else {
      description = 'Multiple actions'
    }
  }
  if (includeTime) {
    description += ' at ' + eventList[0].time
  }

  return description
}

function scheduleActionToDescription (action) {
  // Convert actions such as "power_on" to English text like "Power on"

  switch (action) {
    case 'power_off':
      return 'Power off'
    case 'power_on':
      return 'Power on'
    case 'refresh_page':
      return 'Refresh'
    case 'restart':
      return 'Restart'
    case 'set_content':
      return 'Set content for'
    case 'set_exhibit':
      return 'Set exhibit'
    default:
      return action
  }
}

function scheduleTargetToDescription (target) {
  // Convert targets such as "__id_TEST1" to English words like "TEST1"

  if (target === '__all') {
    return 'all components'
  } else if (target.startsWith('__type_')) {
    return 'all ' + target.slice(7)
  } else if (target.startsWith('__id_')) {
    return target.slice(5)
  }
}

function setScheduleActionTargetSelector () {
  // Helper function to show/hide the select element for picking the target
  // of an action when appropriate

  const action = $('#scheduleActionSelector').val()
  const targetSelector = $('#scheduleTargetSelector')

  if (action === 'set_exhibit') {
    // Fill the target selector with a list of available exhiits
    targetSelector.empty()
    const availableExhibits = $.makeArray($('#exhibitSelect option'))
    availableExhibits.forEach((item) => {
      targetSelector.append(new Option(item.value, item.value))
    })
    targetSelector.show()
    $('#scheduleTargetSelectorLabel').show()
  } else if (['power_on', 'power_off', 'refresh_page', 'restart', 'set_content'].includes(action)) {
    // Fill the target selector with the list of types and ids, plus an option for all.
    targetSelector.empty()
    if (['power_on', 'power_off', 'refresh_page', 'restart'].includes(action)) {
      targetSelector.append(new Option('All', '__all'))
      const sep = new Option('Types', null)
      sep.setAttribute('disabled', true)
      targetSelector.append(sep)
      constConfig.componentGroups.forEach((item) => {
        targetSelector.append(new Option(item.type, '__type_' + item.type))
      })
    }
    const sep = new Option('IDs', null)
    sep.setAttribute('disabled', true)
    targetSelector.append(sep)
    constConfig.exhibitComponents.forEach((item) => {
      if (item.constellationAppId !== 'static_component') {
        targetSelector.append(new Option(item.id, '__id_' + item.id))
      }
    })
    targetSelector.show()
    $('#scheduleTargetSelectorLabel').show()
    setScheduleActionValueSelector()
  } else {
    targetSelector.hide()
    $('#scheduleTargetSelectorLabel').hide()
    targetSelector.val(null)
  }
}

function setScheduleActionValueSelector () {
  // Helper function to show/hide the select element for picking the value
  // of an action when appropriate

  const action = $('#scheduleActionSelector').val()
  const target = $('#scheduleTargetSelector').val()
  const valueSelector = $('#scheduleValueSelector')
  valueSelector.empty()

  if (action === 'set_content') {
    const component = constExhibit.getExhibitComponent(target.slice(5))

    // Send a request to the helper for the available content
    const requestString = JSON.stringify({ action: 'getAvailableContent' })

    const xhr = new XMLHttpRequest()
    if (component.helperAddress != null) {
      xhr.open('POST', component.helperAddress, true)
    } else {
      xhr.open('POST', `http://${component.ip}:${component.helperPort}`, true)
    }
    xhr.timeout = 1000 // 1 seconds
    // xhr.ontimeout = showFailureMessage;
    // xhr.onerror = showFailureMessage;
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return

      if (this.status === 200) {
        const response = JSON.parse(this.responseText)
        response.all_exhibits.forEach((item) => {
          valueSelector.append(new Option(item, item))
        })
        // In the case of editing an action, preselect any existing values
        valueSelector.val($('#scheduleEditModal').data('currentValue'))
        valueSelector.show()
        $('#scheduleValueSelectorLabel').show()
      }
    }
    xhr.send(requestString)
  }
}

function scheduleConfigureEditModal (scheduleName,
  type,
  isAddition = true,
  currentScheduleID = null,
  currentTime = null,
  currentAction = null,
  currentTarget = null,
  currentValue = null) {
  // Function to set up and then show the modal that enables editing a
  // scheduled event or adding a new one

  // If currentScheduleID == null, we are adding a new schedule item, so create a unique
  // ID from the current time.
  if (currentScheduleID == null) {
    currentScheduleID = String(new Date().getTime())
  }

  // Hide elements that aren't always visible
  $('#scheduleTargetSelector').hide()
  $('#scheduleTargetSelectorLabel').hide()
  $('#scheduleValueSelector').hide()
  $('#scheduleValueSelectorLabel').hide()
  $('#scheduleEditErrorAlert').hide()

  // Tag the modal with a bunch of data that we can read if needed when
  // submitting the change
  $('#scheduleEditModal').data('scheduleName', scheduleName)
  $('#scheduleEditModal').data('scheduleID', currentScheduleID)
  $('#scheduleEditModal').data('isAddition', isAddition)
  $('#scheduleEditModal').data('currentTime', currentTime)
  $('#scheduleEditModal').data('currentAction', currentAction)
  $('#scheduleEditModal').data('currentTarget', currentTarget)
  $('#scheduleEditModal').data('currentValue', currentValue)

  // Set the modal title
  if (isAddition) {
    $('#scheduleEditModalTitle').html('Add action')
  } else {
    $('#scheduleEditModalTitle').html('Edit action')
  }

  // Set the scope notice so that users know what their change will affect
  switch (type) {
    case 'date-specific':
      $('#scheduleEditScopeAlert').html(`This change will only affect ${scheduleName}`)
      break
    case 'day-specific':
      $('#scheduleEditScopeAlert').html(`This change will affect all ${scheduleName.charAt(0).toUpperCase() + scheduleName.slice(1)}s`)
      break
    default:
      break
  }

  // If we're editing an existing action, pre-fill the current options
  if (isAddition === false) {
    $('#scheduleActionTimeInput').val(currentTime)
    $('#scheduleActionSelector').val(currentAction)

    if (currentTarget != null) {
      setScheduleActionTargetSelector()
      $('#scheduleTargetSelector').val(currentTarget)
      $('#scheduleTargetSelector').show()
      $('#scheduleTargetSelectorLabel').show()
    }
  } else {
    $('#scheduleActionTimeInput').val(null)
    $('#scheduleActionSelector').val(null)
    $('#scheduleTargetSelector').val(null)
  }

  $('#scheduleEditModal').modal('show')
}

function sendScheduleUpdateFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to the control server asking to add the given action

  const scheduleName = $('#scheduleEditModal').data('scheduleName')
  const time = $('#scheduleActionTimeInput').val().trim()
  const action = $('#scheduleActionSelector').val()
  const target = $('#scheduleTargetSelector').val()
  const value = $('#scheduleValueSelector').val()
  const isAddition = $('#scheduleEditModal').data('isAddition')
  const scheduleID = $('#scheduleEditModal').data('scheduleID')

  if (time === '' || time == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy a time for the action').show()
    return
  } else if (action == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy an action').show()
    return
  } else if (action === 'set_exhibit' && target == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy an exhibit to set').show()
    return
  } else if (['power_on', 'power_off', 'refresh_page', 'restart', 'set_content'].includes(action) && target == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy a target for this action').show()
    return
  } else if (action === 'set_content' && value == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy a value for this action').show()
    return
  }

  const requestDict = {
    name: scheduleName,
    timeToSet: time,
    actionToSet: action,
    targetToSet: target,
    valueToSet: value,
    scheduleID,
    isAddition
  }

  if (isAddition === false) {
    requestDict.timeToReplace = $('#scheduleEditModal').data('currentTime')
    requestDict.scheduleID = scheduleID
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 3000
  xhr.open('POST', serverIP + '/schedule/update', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        if ('success' in update) {
          if (update.success === true) {
            if (update.class === 'schedule') {
              $('#scheduleEditModal').modal('hide')
              populateSchedule(update)
            }
          } else {
            $('#scheduleEditErrorAlert').html(update.reason).show()
          }
        }
      }
    }
  }
  xhr.send(requestString)
}

function scheduleDeleteActionFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to the control server asking to delete the given action

  const scheduleName = $('#scheduleEditModal').data('scheduleName')
  const scheduleID = $('#scheduleEditModal').data('scheduleID')

  console.log('Delete:', scheduleName, scheduleID)

  const requestDict = {
    from: scheduleName,
    scheduleID
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 3000
  xhr.open('POST', serverIP + '/schedule/deleteAction', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        if (update.class === 'schedule') {
          $('#scheduleEditModal').modal('hide')
          populateSchedule(update)
        }
      }
    }
  }
  xhr.send(requestString)
}

function askForScheduleRefresh () {
  // Send a message to the control server asking it to reload the schedule
  // from disk

  $('#refreshScheduleButton').html('Refreshing...')

  const xhr = new XMLHttpRequest()
  xhr.timeout = 3000
  xhr.open('GET', serverIP + '/schedule/refresh', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () {
    $('#refreshScheduleButton').html('Timed out!')
    const temp = function () {
      $('#refreshScheduleButton').html('Refresh schedule')
    }
    setTimeout(temp, 2000)
  }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        if (update.class === 'schedule') {
          populateSchedule(update)
        }
        $('#refreshScheduleButton').html('Success!')
        const temp = function () {
          $('#refreshScheduleButton').html('Refresh schedule')
        }
        setTimeout(temp, 2000)
      }
    }
  }
  xhr.send()
}

function showIssueEditModal (issueType, target) {
  // Show the modal and configure for either "new" or "edit"

  // Make sure we have all the current components listed as objections for
  // the issueRelatedComponentsSelector
  for (let i = 0; i < constConfig.exhibitComponents.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueRelatedComponentsSelector option[value='${constConfig.exhibitComponents[i].id}']`).length === 0) {
      $('#issueRelatedComponentsSelector').append(new Option(constConfig.exhibitComponents[i].id, constConfig.exhibitComponents[i].id))
    }
  }

  // Make sure we have all the assignable staff listed as options for
  // issueAssignedToSelector
  for (let i = 0; i < assignableStaff.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueAssignedToSelector option[value='${assignableStaff[i]}']`).length === 0) {
      $('#issueAssignedToSelector').append(new Option(assignableStaff[i], assignableStaff[i]))
    }
  }

  // Clear file upload interface elements
  $('#issueMediaUploadFilename').html('Choose file')
  $('#issueMediaUploadEqualSignWarning').hide()
  $('#issueMediaUploadHEICWarning').hide()
  $('#issueMediaUploadSubmitButton').hide()
  $('#issueMediaUploadProgressBarContainer').hide()
  $('#issueMediaUpload').val(null)

  // Clone the cancel button to remove any lingering event listeners
  const oldElement = document.getElementById('issueEditCancelButton')
  const newElement = oldElement.cloneNode(true)
  oldElement.parentNode.replaceChild(newElement, oldElement)

  if (issueType === 'new') {
    // Clear inputs
    $('#issueTitleInput').val('')
    $('#issueDescriptionInput').val('')
    $('#issueAssignedToSelector').val(null)
    $('#issueRelatedComponentsSelector').val(null)

    $('#issueEditModal').data('type', 'new')
    $('#issueEditModalTitle').html('Create Issue')
    issueMediaUploadedFile(false)
  } else if (target != null) {
    $('#issueEditModal').data('type', 'edit')
    $('#issueEditModal').data('target', target)
    $('#issueEditModalTitle').html('Edit Issue')

    const targetIssue = getIssue(target)
    $('#issueTitleInput').val(targetIssue.issueName)
    $('#issueDescriptionInput').val(targetIssue.issueDescription)
    $('#issueAssignedToSelector').val(targetIssue.assignedTo)
    $('#issueRelatedComponentsSelector').val(targetIssue.relatedComponentIDs)
    if (targetIssue.media != null) {
      issueMediaUploadedFile(true, targetIssue.media)
    } else {
      issueMediaUploadedFile(false)
    }
  }

  $('#issueEditModal').modal('show')
}

function onIssueMediaUploadChange () {
  // When a file is selected, check if it contains an equal sign (not allowed).
  // If not, display it

  $('#issueMediaUploadSubmitButton').show()
  // Show the upload button (we may hide it later)
  const fileInput = $('#issueMediaUpload')[0]
  $('#issueMediaUploadFilename').html('File: ' + fileInput.files[0].name)
  // Check for = in filename
  if (fileInput.files[0].name.includes('=')) {
    $('#issueMediaUploadEqualSignWarning').show()
    $('#issueMediaUploadSubmitButton').hide()
  } else {
    $('#issueMediaUploadEqualSignWarning').hide()
  }
  // Check for HEIC file
  if (fileInput.files[0].type === 'image/heic') {
    $('#issueMediaUploadHEICWarning').show()
    $('#issueMediaUploadSubmitButton').hide()
  } else {
    $('#issueMediaUploadHEICWarning').hide()
  }
}

function uploadIssueMediaFile () {
  const fileInput = $('#issueMediaUpload')[0]
  if (fileInput.files[0] != null) {
    $('#issueMediaUploadSubmitButton').prop('disabled', true)
    $('#issueMediaUploadSubmitButton').html('Working...')

    const file = fileInput.files[0]
    const formData = new FormData()
    formData.append('action', 'uploadIssueMedia')
    formData.append('filename', file.name)
    formData.append('mimetype', file.type)
    formData.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', serverIP, true)
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          if (response.success === true) {
            issueMediaUploadedFile(true, response.filename)
            // If we cancel without saving, need to delete this file.
            document.getElementById('issueEditCancelButton').addEventListener('click', function () {
              issueMediaDelete(response.filename)
            })
          } else {
            issueMediaUploadedFile(false)
          }
        }
        $('#issueMediaUploadSubmitButton').prop('disabled', false)
        $('#issueMediaUploadSubmitButton').html('Upload')
        $('#issueMediaUploadProgressBarContainer').hide()
        $('#issueMediaUploadSubmitButton').hide()
        $('#issueMediaUploadFilename').html('Choose file')
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        $('#issueMediaUploadProgressBar').width(String(percentComplete) + '%')
        if (percentComplete > 0) {
          $('#issueMediaUploadProgressBarContainer').show()
        } else if (percentComplete === 100) {
          $('#issueMediaUploadProgressBarContainer').hide()
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function issueMediaView (filename) {
  // Open the media file given by filename in a new browser tab

  // First, determine if we have a picture or a video
  const imgTypes = ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'tiff', 'webp']
  const vidTypes = ['mp4', 'mov', 'webm']

  let fileType = null
  imgTypes.forEach((ext) => {
    if (filename.toLowerCase().endsWith(ext)) {
      fileType = 'image'
    }
  })
  vidTypes.forEach((ext) => {
    if (filename.toLowerCase().endsWith(ext)) {
      fileType = 'video'
    }
  })

  let html = null
  if (fileType === 'image') {
    html = `
          <html>
            <head>
              <title>${filename}</title>
              <style>
                @media (orientation: landscape) {
                  .zoomedOut{
                    display: block;
                    height: 100%;
                    margin: auto;
                    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                    cursor: zoom-in;
                    -webkit-user-select: none;
                  }
                }
                @media (orientation: portrait) {
                  .zoomedOut{
                    display: block;
                    width: 100%;
                    margin: auto;
                    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                    cursor: zoom-in;
                    -webkit-user-select: none;
                  }
                }

                .zoomedIn{
                  display: block;
                  margin: auto;
                  padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                  cursor: zoom-out;
                  -webkit-user-select: none;
                }
              </style>
            </head>
            <body style="margin: 0px">
              <img id="image" class='zoomedOut' src="issues/media/${filename}" onclick="toggleZoom()">
            </body>
            <script>

              function toggleZoom() {
                document.getElementById("image").classList.toggle('zoomedIn');
                document.getElementById("image").classList.toggle('zoomedOut');
              }
            </script>
          </html>
    `
  } else if (fileType === 'video') {
    html = `
          <html>
            <head>
              <title>${filename}</title>
              <style>
                @media (orientation: landscape) {
                  .zoomedOut{
                    display: block;
                    height: 100%;
                    margin: auto;
                    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                    -webkit-user-select: none;
                  }
                }
                @media (orientation: portrait) {
                  .zoomedOut{
                    display: block;
                    width: 100%;
                    margin: auto;
                    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
                    -webkit-user-select: none;
                  }
                }
              </style>
            </head>
            <body style="margin: 0px">
              <video class='zoomedOut' controls>
                <source src="issues/media/${filename}">
                This file is not playing.
              </video>
            </body>
            <script>
            </script>
          </html>
    `
  }

  if (html != null) {
    const imageWindow = window.open('', '_blank')
    imageWindow.document.write(html)
  }
}

function issueMediaUploadedFile (fileExists, filename = null) {
  // Configure the file upload/view interface depending on whether a file has
  // been uploaded.

  $('#issueMediaViewFromModal').data('filename', filename)

  if (fileExists) {
    $('#issueMediaUploadCol').hide()
    $('#issueMediaViewCol').show()
    $('#issueMediaModalLabel').html('Uploaded image')
  } else {
    $('#issueMediaModalLabel').html('Add image')
    $('#issueMediaUploadCol').show()
    $('#issueMediaViewCol').hide()
  }
}

function issueMediaDelete (filename) {
  // Send a message to the control server, asking for the file to be deleted.

  const requestDict = {
    class: 'webpage',
    action: 'issueMediaDelete',
    filename: $('#issueMediaViewFromModal').data('filename')
  }
  // If this is an existing issue, we need to say what the issue id is
  const issueType = $('#issueEditModal').data('type')
  if (issueType === 'edit') {
    requestDict.id = $('#issueEditModal').data('target')
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result) {
          if (result.success === true) {
            issueMediaUploadedFile(false)
          }
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function submitIssueFromModal () {
  // Take the inputs from the modal, check that we have everything we need,
  // and submit it to the server.

  const issueDict = {}
  issueDict.issueName = $('#issueTitleInput').val()
  issueDict.issueDescription = $('#issueDescriptionInput').val()
  issueDict.relatedComponentIDs = $('#issueRelatedComponentsSelector').val()
  issueDict.assignedTo = $('#issueAssignedToSelector').val()
  issueDict.priority = $('#issuePrioritySelector').val()
  if ($('#issueMediaViewFromModal').data('filename') != null) {
    issueDict.media = $('#issueMediaViewFromModal').data('filename')
  }

  let error = false
  if (issueDict.issueName === '') {
    console.log('Need issue name')
    error = true
  }
  // if (issueDict.issueDescription === "") {
  //   console.log("Need issue description");
  //   error = true;
  // }

  if (error === false) {
    const issueType = $('#issueEditModal').data('type')
    let action
    if (issueType === 'new') {
      action = 'createIssue'
    } else {
      issueDict.id = $('#issueEditModal').data('target')
      action = 'editIssue'
    }
    $('#issueEditModal').modal('hide')
    const requestDict = {
      class: 'webpage',
      action,
      details: issueDict
    }
    const xhr = new XMLHttpRequest()
    xhr.timeout = 2000
    xhr.open('POST', serverIP, true)
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return

      if (this.status === 200) {
        if (this.responseText !== '') {
          const result = JSON.parse(this.responseText)
          if ('success' in result && result.success === true) {
            getIssueList()
          }
        }
      }
    }
    xhr.send(JSON.stringify(requestDict))
  }
}

function getIssueList () {
  const requestDict = {
    class: 'webpage',
    action: 'getIssueList'
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const response = JSON.parse(this.responseText)
        if ('success' in response) {
          if (response.success === true) {
            rebuildIssueList(response.issueList)
          } else {
            console.log('Error retrieving issueList: ', response.reason)
          }
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function getIssue (id) {
  // Function to search the issueList for a given id

  const result = issueList.find(obj => {
    return obj.id === id
  })

  return result
}

function deleteIssue (id) {
  // Ask the control server to remove the specified issue

  const requestDict = {
    class: 'webpage',
    action: 'deleteIssue',
    id
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          getIssueList()
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function populateTrackerDataSelect (data) {
  // Take a list of data filenames and populate the TrackerDataSelect

  const trackerDataSelect = $('#trackerDataSelect')
  trackerDataSelect.empty()

  data.sort().forEach(item => {
    const name = item.split('.').slice(0, -1).join('.')
    const html = `<option value="${name}">${name}</option>`
    trackerDataSelect.append(html)
  })
}

function downloadTrackerData () {
  // Ask the server to send the data for the currently selected tracker as a CSV
  // and initiate a download.

  const name = $('#trackerDataSelect').val()

  const requestDict = {
    class: 'tracker',
    action: 'downloadTrackerData',
    name
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          // Convert the text to a file and initiate download
          const fileBlob = new Blob([result.csv], {
            type: 'text/plain'
          })
          const a = document.createElement('a')
          a.href = window.URL.createObjectURL(fileBlob)
          a.download = name + '.csv'
          a.click()
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function showDeleteTrackerDataModal () {
  // Show a modal confirming the request to delete a specific dataset. To be sure
  // populate the modal with data for a test.

  const name = $('#trackerDataSelect').val()
  $('#deleteTrackerDataModalDeletedName').html(name)
  $('#deleteTrackerDataModalDeletedInput').val('')
  $('#deleteTrackerDataModalSpellingError').hide()
  $('#deleteTrackerDataModal').modal('show')
}

function deleteTrackerDataFromModal () {
  // Check inputed answer and confirm it is correct. If so, ask for the data to
  // be deleted.

  const name = $('#deleteTrackerDataModalDeletedName').html()
  const input = $('#deleteTrackerDataModalDeletedInput').val()

  if (name === input) {
    deleteTrackerData()
  } else {
    $('#deleteTrackerDataModalSpellingError').show()
  }
}

function deleteTrackerData () {
  // Send a message to the server asking it to delete the data for the currently
  // selected template

  const name = $('#trackerDataSelect').val()

  const requestDict = {
    class: 'tracker',
    action: 'clearTrackerData',
    name
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          $('#deleteTrackerDataModal').modal('hide')
          constTracker.getAvailableTrackerData(populateTrackerDataSelect)
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function launchTracker () {
  // Open the tracker in a new tab with the currently selected layout

  const name = $('#trackerTemplateSelect').val()

  let url = serverIP + '/tracker.html'
  if (name != null) {
    url += '?layout=' + name
  }
  window.open(url, '_blank').focus()
}

function createTrackerTemplate (name = '') {
  // Ask the server to create a template with the name provided in the text entry
  // field.

  if (name === '') {
    name = $('#createTrackerTemplateName').val()
  }
  console.log(name)
  const requestDict = {
    class: 'tracker',
    action: 'createTemplate',
    name,
    template: {}
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          $('#createTrackerTemplateName').val('')
          constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function deleteTrackerTemplate (name = '') {
  // Ask the server to delete the specified tracker template

  if (name === '') {
    name = $('#trackerTemplateSelect').val()
  }

  const requestDict = {
    class: 'tracker',
    action: 'deleteTemplate',
    name
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
          $('#deleteTrackerTemplateModal').modal('hide')
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function rebuildIssueList (issues) {
  // Take an array of issue dictionaries and build the GUI representation.

  // Gather the settings for the various filters
  const filterPriority = $('#issueListFilterPrioritySelect').val()
  const filterAssignedTo = $('#issueListFilterAssignedToSelect').val()

  $('#issuesRow').empty()

  issues.forEach((issue, i) => {
    // Check against the filters
    if (filterPriority !== 'all' && filterPriority !== issue.priority) {
      return
    }
    if (
      (filterAssignedTo !== 'all' && filterAssignedTo !== 'unassigned' && !issue.assignedTo.includes(filterAssignedTo)) ||
      (filterAssignedTo === 'unassigned' && issue.assignedTo.length > 0)
    ) return

    const col = document.createElement('div')
    col.setAttribute('class', 'col-12 col-sm-6 col-lg-4 mt-2')

    const card = document.createElement('div')
    // Color the border based on the priority
    let borderColor
    if (issue.priority === 'low') {
      borderColor = 'border-primary'
    } else if (issue.priority === 'medium') {
      borderColor = 'border-warning'
    } else {
      borderColor = 'border-danger'
    }
    card.setAttribute('class', `card h-100 border ${borderColor}`)
    col.appendChild(card)

    const body = document.createElement('div')
    body.setAttribute('class', 'card-body')
    card.appendChild(body)

    const title = document.createElement('H5')
    title.setAttribute('class', 'card-title')
    title.innerHTML = issue.issueName
    body.appendChild(title)

    issue.relatedComponentIDs.forEach((id, i) => {
      const tag = document.createElement('span')
      tag.setAttribute('class', 'badge badge-secondary mr-1')
      tag.innerHTML = id
      body.appendChild(tag)
    })

    issue.assignedTo.forEach((name, i) => {
      const tag = document.createElement('span')
      tag.setAttribute('class', 'badge badge-success mr-1')
      tag.innerHTML = name
      body.appendChild(tag)
    })

    const desc = document.createElement('p')
    desc.setAttribute('class', 'card-text')
    desc.style.whiteSpace = 'pre-wrap' // To preserve new lines
    desc.innerHTML = issue.issueDescription
    body.appendChild(desc)

    if (issue.media != null) {
      const mediaBut = document.createElement('button')
      mediaBut.setAttribute('class', 'btn btn-primary mr-1 mt-1')
      mediaBut.innerHTML = 'View image'
      mediaBut.addEventListener('click', function () {
        issueMediaView(issue.media)
      }, false)
      body.appendChild(mediaBut)
    }

    const editBut = document.createElement('button')
    editBut.setAttribute('class', 'btn btn-info mr-1 mt-1')
    editBut.innerHTML = 'Edit'
    editBut.addEventListener('click', function () {
      showIssueEditModal('edit', issue.id)
    })
    body.appendChild(editBut)

    const deleteBut = document.createElement('button')
    deleteBut.setAttribute('type', 'button')
    deleteBut.setAttribute('class', 'btn btn-danger mt-1')
    deleteBut.setAttribute('data-toggle', 'popover')
    deleteBut.setAttribute('title', 'Are you sure?')
    deleteBut.setAttribute('data-content', `<a id="Popover${issue.id}" class='btn btn-danger w-100' onclick="deleteIssue('${issue.id}')">Confirm</a>`)
    deleteBut.setAttribute('data-trigger', 'focus')
    deleteBut.setAttribute('data-html', 'true')
    $(document).on('click', `#Popover${issue.id}`, function () {
      deleteIssue(issue.id)
    })
    deleteBut.addEventListener('click', function () { deleteBut.focus() })
    deleteBut.innerHTML = 'Delete'
    body.appendChild(deleteBut)
    $(deleteBut).popover()

    $('#issuesRow').append(col)
  })
}

function submitComponentMaintenanceStatusChange (type = 'component') {
  // Take details from the maintenance tab of the componentInfoModal and send
  // a message to the server updating the given component.

  let id, status, notes
  if (type === 'component') {
    id = $('#componentInfoModalTitle').html()
    status = $('#componentInfoModalMaintenanceStatusSelector').val()
    notes = $('#componentInfoModalMaintenanceNote').val()
  } else if (type === 'projector') {
    //
  }

  const requestDict = {
    id,
    status,
    notes
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP + '/maintenance/updateStatus', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          $('#componentInfoModalMaintenanceSaveButton').hide()
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function refreshMaintenanceRecords () {
  // Ask the server to send all the maintenance records and then rebuild the
  // maintanence overview from those data.

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('GET', serverIP + '/maintenance/getAllStatuses', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)

        $('#MaintenanceOverviewOnFloorWorkingPane').empty()
        $('#MaintenanceOverviewOnFloorNotWorkingPane').empty()
        $('#MaintenanceOverviewOffFloorWorkingPane').empty()
        $('#MaintenanceOverviewOffFloorNotWorkingPane').empty()

        result.records.forEach((record, i) => {
          const col = document.createElement('div')
          col.setAttribute('class', 'col-12 col-lg-6 mt-2')

          const card = document.createElement('div')
          card.setAttribute('class', 'card h-100 bg-secondary text-white')
          col.appendChild(card)

          const body = document.createElement('div')
          body.setAttribute('class', 'card-body')
          card.appendChild(body)

          const title = document.createElement('H5')
          title.setAttribute('class', 'card-title')
          title.innerHTML = record.id
          body.appendChild(title)

          const progress = document.createElement('div')
          progress.setAttribute('class', 'progress')
          progress.style.height = '25px'
          const working = document.createElement('div')
          working.setAttribute('class', 'progress-bar bg-success')
          working.setAttribute('role', 'progressbar')
          working.style.width = String(record.working_pct) + '%'
          working.title = 'Working: ' + String(record.working_pct) + '%'
          working.innerHTML = 'Working'
          const notWorking = document.createElement('div')
          notWorking.setAttribute('class', 'progress-bar bg-danger')
          notWorking.setAttribute('role', 'progressbar')
          notWorking.style.width = String(record.not_working_pct) + '%'
          notWorking.title = 'Not working: ' + String(record.not_working_pct) + '%'
          notWorking.innerHTML = 'Not working'
          progress.appendChild(working)
          progress.appendChild(notWorking)
          body.appendChild(progress)

          const notes = document.createElement('p')
          notes.setAttribute('class', 'card-text mt-2')
          notes.innerHTML = record.notes
          body.appendChild(notes)

          let parentPane
          switch (record.status) {
            case 'On floor, working':
              parentPane = 'MaintenanceOverviewOnFloorWorkingPane'
              break
            case 'On floor, not working':
              parentPane = 'MaintenanceOverviewOnFloorNotWorkingPane'
              break
            case 'Off floor, working':
              parentPane = 'MaintenanceOverviewOffFloorWorkingPane'
              break
            case 'Off floor, not working':
              parentPane = 'MaintenanceOverviewOffFloorNotWorkingPane'
              break
            default:
              console.log(record.status)
              parentPane = 'MaintenanceOverviewOffFloorNotWorkingPane'
          }
          $('#' + parentPane).append(col)
        })
      }
    }
  }
  xhr.send()
}

function askForUpdate () {
  // Send a message to the control server asking for the latest component
  // updates

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('GET', serverIP + '/system/getUpdate', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.ontimeout = function () { console.log('Website update timed out') }
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const update = JSON.parse(this.responseText)
        let numComps = 0
        let numOnline = 0
        for (let i = 0; i < update.length; i++) {
          const component = update[String(i)]
          if ('class' in component) {
            if (component.class === 'exhibitComponent') {
              numComps += 1
              if ((component.status === constConfig.STATUS.ONLINE) || (component.status === constConfig.STATUS.STANDBY) || (component.status === constConfig.STATUS['SYSTEM ON']) || (component.status === constConfig.STATUS.STATIC)) {
                numOnline += 1
              }
              updateComponentFromServer(component)
            } else if (component.class === 'gallery') {
              setCurrentExhibitName(component.currentExhibit)
              updateAvailableExhibits(component.availableExhibits)
              if ('galleryName' in component) {
                $('#galleryNameField').html(component.galleryName)
                document.title = component.galleryName
              }
              if ('updateAvailable' in component) {
                if (component.updateAvailable === 'true') {
                  constConfig.serverSoftwareUpdateAvailable = true
                  constTools.rebuildErrorList()
                }
              }
            } else if (component.class === 'schedule') {
              if (scheduleUpdateTime !== component.updateTime) {
                populateSchedule(component)
              }
            } else if (component.class === 'issues') {
              // Check for the time of the most recent update. If it is more
              // recent than our existing date, rebuild the issue list
              const currentLastDate = Math.max.apply(Math, issueList.map(function (o) { return new Date(o.lastUpdateDate) }))
              // let updatedDate = Math.max.apply(Math, component.issueList.map(function(o) { return new Date(o.lastUpdateDate); }));
              const updatedDate = new Date(component.lastUpdateDate)
              if (!arraysEqual(assignableStaff, component.assignable_staff)) {
                assignableStaff = component.assignable_staff
                // Populate the filter
                $('#issueListFilterAssignedToSelect').empty()
                $('#issueListFilterAssignedToSelect').append(new Option('All', 'all'))
                $('#issueListFilterAssignedToSelect').append(new Option('Unassigned', 'unassigned'))
                for (let i = 0; i < assignableStaff.length; i++) {
                  $('#issueListFilterAssignedToSelect').append(new Option(assignableStaff[i], assignableStaff[i]))
                }
              }
              if (updatedDate > currentLastDate) {
                issueList = component.issueList
                rebuildIssueList(issueList)
              }
            }
          }
        }
        // Set the favicon to reflect the aggregate status
        if (numOnline === numComps) {
          $("link[rel='icon']").attr('href', 'icon/green.ico')
        } else if (numOnline === 0) {
          $("link[rel='icon']").attr('href', 'icon/red.ico')
        } else {
          $("link[rel='icon']").attr('href', 'icon/yellow.ico')
        }
        constExhibit.rebuildComponentInterface()
      }
    }
  }
  xhr.send()
}

function populateHelpTab () {
  // Ask the server to send the latest README, convert the Markdown to
  // HTML, and add it to the Help tab.

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('GET', serverIP + '/system/getHelpText', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const result = JSON.parse(this.responseText)
      if (result.success === true) {
        const formattedText = markdownConverter.makeHtml(result.text)
        $('#helpTextDiv').html(formattedText)
      } else {
        $('#helpTextDiv').html('Help text not available.')
      }
    }
  }
  xhr.send()
}

function showEditGalleryConfigModal () {
  // Populate the galleryEditModal with information from galleryConfiguration.ini and show the modal.

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('GET', serverIP + '/system/getConfigurationRawText', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          // Must show first so that we can calculate the heights appropriately.
          $('#editGalleryConfigModal').modal('show')
          populateEditGalleryConfigModal(result.configuration)
        }
      }
    }
  }
  xhr.send()
}

function populateEditGalleryConfigModal (configText) {
  // Take the provided text and set up the edit modal

  $('#editGalleryConfigTextArea').val(configText)
  $('#galleryConfigEditModalErrorMessage').hide()

  // Calculate what the height of the text area should be an update it.
  const colHeight = $('#editGalleryConfigTextArea').parent().parent().height()
  const headerHeight = $('#editGalleryConfigTextArea').parent().siblings('h3').height()
  const lineHeight = parseFloat($('#editGalleryConfigTextArea').css('lineHeight'))
  const rows = Math.floor((colHeight - headerHeight) / lineHeight - 1)
  $('#editGalleryConfigTextArea').attr('rows', rows)
}

function submitGalleryConfigChangeFromModal () {
  // Take the updated contents of the text input and send it to Control Server.
  // Control Server will perform a number of checks, which this function needs to
  // handle and return to the user.

  const requestDict = {
    configuration: $('#editGalleryConfigTextArea').val()
  }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP + '/system/updateConfigurationRawText', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
        if ('success' in result && result.success === true) {
          $('#editGalleryConfigModal').modal('hide')
        } else {
          $('#galleryConfigEditModalErrorMessage').html(result.reason)
          $('#galleryConfigEditModalErrorMessage').show()
        }
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}

function populateTrackerTemplateSelect (definitionList) {
  // Get a list of the available tracker layout templates and populate the
  // selector

  const templateSelect = $('#trackerTemplateSelect')
  templateSelect.empty()

  definitionList.forEach(item => {
    const name = item.split('.').slice(0, -1).join('.')
    const html = `<option value="${name}">${name}</option>`
    templateSelect.append(html)
  })
}

function showEditTrackerTemplateModal () {
  // Retrieve the currently-selected layout and use it to configure the
  // editTrackerTemplateModal

  const layoutToLoad = $('#trackerTemplateSelect').val()
  const lamda = function (template) { _showEditTrackerTemplateModal(layoutToLoad, template) }
  constTracker.loadLayoutDefinition(layoutToLoad, lamda)
}

function _showEditTrackerTemplateModal (name, template) {
  // Set the provided template in the data attributes, reset all the fields,
  // and show the modal

  // Set default values
  $('#editTrackerTemplateNameInput').val('')
  $('#editTrackerTemplateLabelInput').val('')
  $('#editTrackerTemplateMultipleInputFalse').prop('checked', true)
  $('#editTrackerTemplateExclusiveInputFalse').prop('checked', true)
  $('#editTrackerTemplateSliderInputMin').val(1)
  $('#editTrackerTemplateSliderInputMax').val(100)
  $('#editTrackerTemplateSliderInputStep').val(1)
  $('#editTrackerTemplateSliderInputStart').val(50)
  $('#editTrackerTemplateLinesInput').val(5)
  $('#editTrackerTemplateModalTitle').html('Edit template: ' + name)

  $('#editTrackerTemplateModal').data('template', template)
  $('#editTrackerTemplateModal').data('templateName', name)

  populateEditTrackerTemplateCurrentLayout()
  configureEditTrackerTemplateModal(Object.keys(template)[0])
  $('#editTrackerTemplateModal').modal('show')
}

function configureEditTrackerTemplateModal (key) {
  // Read the layout for the given key and set the appropriate divs visible to
  // support editing it.

  $('.editTrackerTemplateInputGroup').hide()
  if (key == null) {
    $('#editTrackerTemplateNameInputGroup').hide()
    $('#editTrackerTemplateLabelInputGroup').hide()
    $('#editTrackerTemplateModalDeleteWidgetButton').hide()
    return
  } else {
    $('#editTrackerTemplateNameInputGroup').show()
    $('#editTrackerTemplateLabelInputGroup').show()
    $('#editTrackerTemplateModalDeleteWidgetButton').show()
  }

  const template = $('#editTrackerTemplateModal').data('template')[key]

  $('#editTrackerTemplateModal').data('currentWidget', key)
  $('.editTrackerTemplateInputGroup').hide()

  $('#editTrackerTemplateNameInput').val(key)
  $('#editTrackerTemplateLabelInput').val(template.label)

  if (['counter', 'number'].includes(template.type)) {
    // Only name and label
  } else if (template.type === 'dropdown') {
    $('#editTrackerTemplateOptionsInput').val(template.options)
    $('#editTrackerTemplateOptionsInputGroup').show()
    if (template.multiple === 'true') {
      $('#editTrackerTemplateMultipleInputTrue').prop('checked', true)
    } else {
      $('#editTrackerTemplateMultipleInputFalse').prop('checked', true)
    }
    $('#editTrackerTemplateMultipleInputGroup').show()
  } else if (template.type === 'slider') {
    $('#editTrackerTemplateSliderInputMin').val(template.min || 1)
    $('#editTrackerTemplateSliderInputMax').val(template.max || 100)
    $('#editTrackerTemplateSliderInputStep').val(template.step || 1)
    $('#editTrackerTemplateSliderInputStart').val(template.start || 50)
    $('#editTrackerTemplateSliderInputGroup').show()
  } else if (template.type === 'text') {
    $('#editTrackerTemplateLinesInput').val(template.lines || 5)
    $('#editTrackerTemplateLinesInputGroup').show()
  } else if (template.type === 'timer') {
    if (template.exclusive === 'true') {
      $('#editTrackerTemplateExclusiveInputTrue').prop('checked', true)
    } else {
      $('#editTrackerTemplateExclusiveInputFalse').prop('checked', true)
    }
    $('#editTrackerTemplateExclusiveInputGroup').show()
  }
}

function populateEditTrackerTemplateCurrentLayout () {
  // Take the current template dictionary and render a set of buttons

  const template = $('#editTrackerTemplateModal').data('template')
  // const numItems = Object.keys(template).length

  $('#editTrackerTemplateModalCurrentLayout').empty()
  Object.keys(template).forEach((key, i) => {
    const col = document.createElement('div')
    col.classList = 'col-12 col-md-6 col-lg-4 mt-2 w-100'

    const widget = document.createElement('div')
    widget.classList = 'mx-1'
    const row1 = document.createElement('div')
    row1.classList = 'row'
    widget.appendChild(row1)
    const nameCol = document.createElement('div')
    nameCol.classList = 'col-12 bg-secondary rounded-top'
    row1.appendChild(nameCol)
    const name = document.createElement('div')
    name.classList = ' text-light w-100 text-center font-weight-bold'
    name.innerHTML = key
    nameCol.appendChild(name)
    const row2 = document.createElement('div')
    row2.classList = 'row'
    widget.appendChild(row2)

    const editCol = document.createElement('div')
    editCol.classList = 'col-6 mx-0 px-0'
    row2.appendChild(editCol)
    const edit = document.createElement('div')
    edit.classList = 'text-light bg-info w-100 h-100 justify-content-center d-flex pl-1'
    edit.style.borderBottomLeftRadius = '0.25rem'
    edit.innerHTML = 'Edit'
    edit.style.cursor = 'pointer'
    edit.addEventListener('click', function () { configureEditTrackerTemplateModal(key) })
    editCol.appendChild(edit)

    const leftCol = document.createElement('div')
    leftCol.classList = 'col-3 mx-0 px-0'
    row2.appendChild(leftCol)
    const left = document.createElement('div')
    left.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex'
    left.innerHTML = '◀'
    left.style.cursor = 'pointer'

    left.addEventListener('click', function () { editTrackerTemplateModalMoveWidget(key, -1) })
    leftCol.appendChild(left)

    const rightCol = document.createElement('div')
    rightCol.classList = 'col-3 mx-0 px-0'
    row2.appendChild(rightCol)
    const right = document.createElement('div')
    right.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex pr-1'
    right.style.borderBottomRightRadius = '0.25rem'
    right.innerHTML = '▶'
    right.style.cursor = 'pointer'
    right.addEventListener('click', function () { editTrackerTemplateModalMoveWidget(key, 1) })
    rightCol.appendChild(right)

    col.appendChild(widget)
    $('#editTrackerTemplateModalCurrentLayout').append(col)
  })
}

function editTrackerTemplateModalMoveWidget (key, dir) {
  // Reorder the dictionary of widgets, moving the given key the specified number
  // of places

  if (dir === 0) {
    populateEditTrackerTemplateCurrentLayout()
    return
  }

  const template = $('#editTrackerTemplateModal').data('template')
  const keys = Object.keys(template)
  const loc = keys.indexOf(key)
  let newLoc = loc + dir
  newLoc = Math.max(newLoc, 0)
  newLoc = Math.min(newLoc, keys.length - 1)

  // Iterate through the keys, inserting key into its new place
  const newArray = []
  keys.forEach((item, i) => {
    if (dir < 0) {
      if (i === newLoc) {
        newArray.push(key)
      }
    }
    if (item !== key) {
      newArray.push(item)
    }
    if (dir > 0) {
      if (item !== key) {
        newArray.push(item)
      }
      if (i === newLoc) {
        newArray.push(key)
      }
    }
  })

  // Build a new dictionary with the new order
  const newDict = {}
  newArray.forEach((item, i) => {
    newDict[item] = template[item]
  })

  // Update the data attribute with the new dictionary
  $('#editTrackerTemplateModal').data('template', newDict)
  populateEditTrackerTemplateCurrentLayout()
}

function editTrackerTemplateModalAddWidget (name, type) {
  // Create a new widget with the given name and add it to the template.
  // If the name already exists, append a number

  const template = $('#editTrackerTemplateModal').data('template')
  const names = Object.keys(template)

  // Check if name exists
  let i = 2
  let workingName = name
  while (true) {
    if (names.includes(workingName)) {
      workingName = name + ' ' + String(i)
      i++
    } else {
      name = workingName
      break
    }
  }

  template[name] = { type }
  $('#editTrackerTemplateModal').data('template', template)
  configureEditTrackerTemplateModal(name)
  editTrackerTemplateModalUpdateFromInput()
  populateEditTrackerTemplateCurrentLayout()
}

function editTrackerTemplateModalDeleteWidget () {
  // Delete the given widget and shift focus to the neighboring one

  const template = $('#editTrackerTemplateModal').data('template')
  const currentWidgetName = $('#editTrackerTemplateModal').data('currentWidget')
  const originalPosition = Object.keys(template).indexOf(currentWidgetName)

  delete template[currentWidgetName]
  $('#editTrackerTemplateModal').data('template', template)
  const newPosition = Math.max(0, originalPosition - 1)
  const newCurrentWidget = Object.keys(template)[newPosition]
  $('#editTrackerTemplateModal').data('currentWidget', newCurrentWidget)

  configureEditTrackerTemplateModal(newCurrentWidget)
  populateEditTrackerTemplateCurrentLayout()
}

function editTrackerTemplateModalUpdateFromInput () {
  // Fired when a change is made to a widget property. Write the new data into
  // the template

  const template = $('#editTrackerTemplateModal').data('template')
  const originalWidgetName = $('#editTrackerTemplateModal').data('currentWidget')
  const originalPosition = Object.keys(template).indexOf(originalWidgetName)
  const currentWidget = template[originalWidgetName]

  const currentWidgetName = $('#editTrackerTemplateNameInput').val()

  currentWidget.label = $('#editTrackerTemplateLabelInput').val()
  if (['counter', 'number'].includes(currentWidget.type)) {
    // Only name and label
  } else if (currentWidget.type === 'dropdown') {
    currentWidget.options = $('#editTrackerTemplateOptionsInput').val()
    currentWidget.multiple = String($('#editTrackerTemplateMultipleInputTrue').prop('checked'))
  } else if (currentWidget.type === 'slider') {
    currentWidget.min = $('#editTrackerTemplateSliderInputMin').val()
    currentWidget.max = $('#editTrackerTemplateSliderInputMax').val()
    currentWidget.step = $('#editTrackerTemplateSliderInputStep').val()
    currentWidget.start = $('#editTrackerTemplateSliderInputStart').val()
  } else if (currentWidget.type === 'text') {
    currentWidget.lines = $('#editTrackerTemplateLinesInput').val()
  } else if (currentWidget.type === 'timer') {
    currentWidget.exclusive = String($('#editTrackerTemplateExclusiveInputTrue').prop('checked'))
  }
  delete template[originalWidgetName]
  template[currentWidgetName] = currentWidget
  $('#editTrackerTemplateModal').data('currentWidget', currentWidgetName)

  $('#editTrackerTemplateModal').data('template', template)
  $('#editTrackerTemplateModal').data('currentWidget', currentWidget.name)
  // We have changed the name and need to move it back to the right place
  editTrackerTemplateModalMoveWidget(currentWidgetName, originalPosition - Object.keys(template).length + 1)
}

function editTrackerTemplateModalSubmitChanges () {
  // Send a message to the server with the updated template

  const template = $('#editTrackerTemplateModal').data('template')
  const templateName = $('#editTrackerTemplateModal').data('templateName')

  const requestDict = {
    class: 'tracker',
    action: 'createTemplate',
    name: templateName,
    template
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const response = JSON.parse(this.responseText)
        if ('success' in response && response.success === true) {
          $('#editTrackerTemplateModal').modal('hide')
        }
      }
    }
  }
  xhr.send(requestString)
}

function parseQueryString () {
  // Read the query string to determine what options to set

  const queryString = decodeURIComponent(window.location.search)

  const searchParams = new URLSearchParams(queryString)

  if (searchParams.has('hideComponents')) {
    $('#nav-components-tab').hide()
  }
  if (searchParams.has('hideSchedule')) {
    $('#nav-schedule-tab').hide()
  }
  if (searchParams.has('hideIssues')) {
    $('#nav-issues-tab').hide()
  }
  if (searchParams.has('hideSettings')) {
    $('#nav-settings-tab').hide()
  }
  if (searchParams.has('hideHelp')) {
    $('#nav-help-tab').hide()
  }
  if (searchParams.has('hideSTATIC')) {
    $('#componentsTabSettingsShowStatic').prop('checked', false)
  }
}

function createExhibit (name, cloneFrom) {
  // Ask the control server to create a new exhibit with the given name.
  // set cloneFrom = null if we are making a new exhibit from scratch.
  // set cloneFrom to the name of an existing exhibit to copy that exhibit

  const requestDict = {
    class: 'webpage',
    action: 'createExhibit',
    name
  }

  if (cloneFrom != null && cloneFrom !== '') {
    requestDict.cloneFrom = cloneFrom
  }
  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    // if (this.readyState !== 4) return

    // if (this.status === 200) {
    //   if (this.responseText !== '') {
    //   }
    // }
  }
  xhr.send(requestString)
}

function deleteExhibit (name) {
  // Ask the control server to delete the exhibit with the given name.

  const requestDict = {
    class: 'webpage',
    action: 'deleteExhibit',
    name
  }
  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', serverIP, true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    // if (this.readyState !== 4) return

    // if (this.status === 200) {
    //   if (this.responseText !== '') {
    //   }
    // }
  }
  xhr.send(requestString)
}

function checkDeleteSelection () {
  // Make sure the selected option is not hte current one.

  if ($('#exhibitSelect').val() === $('#exhibitDeleteSelector').val()) {
    $('#exhibitDeleteSelectorButton').prop('disabled', true)
    $('#exhibitDeleteSelectorWarning').show()
  } else {
    $('#exhibitDeleteSelectorButton').prop('disabled', false)
    $('#exhibitDeleteSelectorWarning').hide()
  }
}

function showExhibitDeleteModal () {
  $('#deleteExhibitModal').modal('show')
}

function deleteExhibitFromModal () {
  // Take the info from the selector and delete the correct exhibit

  deleteExhibit($('#exhibitDeleteSelector').val())
  $('#deleteExhibitModal').modal('hide')
}

function arraysEqual (a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// Bind event listeners

// Components tab
// =========================
$('#componentsTabSettingsShowStatic').change(function () {
  // Modify the search params to soft-save the change
  const urlParams = new URLSearchParams(window.location.search)
  if ($('#componentsTabSettingsShowStatic').prop('checked') === true) {
    urlParams.delete('hideSTATIC')
  } else {
    urlParams.set('hideSTATIC', 'true')
  }
  window.history.replaceState('', '', '?' + urlParams)

  // Rebuild the interface with the new option
  constExhibit.rebuildComponentInterface()
})
// Component info modal
$('#componentSaveConfirmationButton').click(submitComponentContentChange)
$('#contentUploadSubmitButton').click(uploadComponentContentFile)
$('#componentInfoModalMaintenanceSaveButton').click(function () {
  submitComponentMaintenanceStatusChange('component')
})
$('#componentContentUpload').change(onUploadContentChange)
$('#componentInfoModalMaintenanceStatusSelector').change(function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})
$('#componentInfoModalThumbnailCheckbox').change(function () {
  const checked = $('#componentInfoModalThumbnailCheckbox').prop('checked')
  if (checked) {
    $('.contentThumbnail').show()
  } else {
    $('.contentThumbnail').hide()
  }
})
// Schedule tab
// =========================
$('#scheduleEditDeleteActionButton').click(scheduleDeleteActionFromModal)
$('#scheduleEditSubmitButton').click(sendScheduleUpdateFromModal)
$('#refreshScheduleButton').click(askForScheduleRefresh)
$('#scheduleActionSelector').change(setScheduleActionTargetSelector)
$('#scheduleTargetSelector').change(setScheduleActionValueSelector)

// Issues tab
// =========================
$('#issueMediaViewFromModal').click(function () {
  issueMediaView($('#issueMediaViewFromModal').data('filename'))
})
$('#issueMediaDeleteButton').click(function () {
  issueMediaDelete($('#issueMediaViewFromModal').data('filename'))
})
$('#issueMediaUploadSubmitButton').click(uploadIssueMediaFile)
$('#issueMediaUpload').change(onIssueMediaUploadChange)
$('#issueEditSubmitButton').click(submitIssueFromModal)
$('#createIssueButton').click(function () {
  showIssueEditModal('new')
})
$('#issueListFilterPrioritySelect').change(function () {
  rebuildIssueList(issueList)
})
$('#issueListFilterAssignedToSelect').change(function () {
  rebuildIssueList(issueList)
})
$('#refreshMaintenanceRecordsBUtton').click(refreshMaintenanceRecords)
$('#componentInfoModalMaintenanceNote').on('input', function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})
// Settings tab
// =========================
$('#exhibitSelect').change(function () {
  changeExhibit(false)
})
$('#exhibitDeleteSelector').change(checkDeleteSelection)
$('#createExhibitButton').click(function () {
  createExhibit($('#createExhibitNameInput').val(), null)
  $('#createExhibitNameInput').val('')
})
$('#cloneExhibitButton').click(function () {
  createExhibit($('#createExhibitNameInput').val(), $('#exhibitSelect').val())
  $('#createExhibitNameInput').val('')
})
$('#exhibitChangeConfirmationButton').click(function () {
  changeExhibit(true)
})
$('#deleteExhibitButton').click(deleteExhibitFromModal)
$('#submitGalleryConfigChangeFromModalButton').click(submitGalleryConfigChangeFromModal)
$('#showEditGalleryConfigModalButton').click(showEditGalleryConfigModal)
$('#reloadConfigurationButton').click(reloadConfiguration)
$('#exhibitDeleteSelectorButton').click(showExhibitDeleteModal)
// Tracker
$('#createTrackerTemplateButton').click(function () {
  createTrackerTemplate()
})
$('#launchTrackerButton').click(launchTracker)
$('#showEditTrackerTemplateButton').click(showEditTrackerTemplateModal)
$('#deleteTrackerTemplateButton').click(function () {
  $('#deleteTrackerTemplateModal').modal('show')
})
$('#deleteTrackerTemplateFromModalButton').click(function () {
  deleteTrackerTemplate()
})
$('#getAvailableTrackerDataButton').click(function () {
  constTracker.getAvailableTrackerData(populateTrackerDataSelect)
})
$('#downloadTrackerDataButton').click(downloadTrackerData)
$('#showDeleteTrackerDataModalButton').click(showDeleteTrackerDataModal)
$('#deleteTrackerDataFromModalButton').click(deleteTrackerDataFromModal)
$('#editTrackerTemplateModalAddCounterButton').click(function () {
  editTrackerTemplateModalAddWidget('New Counter', 'counter')
})
$('#editTrackerTemplateModalAddDropdownButton').click(function () {
  editTrackerTemplateModalAddWidget('New Dropdown', 'dropdown')
})
$('#editTrackerTemplateModalAddNumberButton').click(function () {
  editTrackerTemplateModalAddWidget('New Number', 'number')
})
$('#editTrackerTemplateModalAddSliderButton').click(function () {
  editTrackerTemplateModalAddWidget('New Slider', 'slider')
})
$('#editTrackerTemplateModalAddTextButton').click(function () {
  editTrackerTemplateModalAddWidget('New Text', 'text')
})
$('#editTrackerTemplateModalAddTimerButton').click(function () {
  editTrackerTemplateModalAddWidget('New Timer', 'timer')
})
$('#editTrackerTemplateModalDeleteWidgetButton').click(editTrackerTemplateModalDeleteWidget)
$('#editTrackerTemplateModalSubmitChangesButton').click(editTrackerTemplateModalSubmitChanges)
$('.editTrackerTemplateInputField').on('input', editTrackerTemplateModalUpdateFromInput)

askForUpdate()
setInterval(askForUpdate, 5000)
populateHelpTab()
refreshMaintenanceRecords()
parseQueryString()
constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
