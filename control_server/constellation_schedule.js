import constConfig from './config.js'
import * as constExhibit from './constellation_exhibit.js'
import * as constTools from './constellation_tools.js'

export function deleteSchedule (name) {
  // Send a message to the control server asking to delete the schedule
  // file with the given name. The name should not include ".ini"

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/deleteSchedule',
    params: { name }
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        populateSchedule(response)
      }
    })
}

export function scheduleConvertToDateSpecific (date, dayName) {
  // Send a message to the control server, asking to create a date-specific
  // schedule out of the given day name

  const requestDict = {
    date,
    convert_from: dayName
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/convert',
    params: requestDict
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        populateSchedule(response)
      }
    })
}

export function populateSchedule (schedule) {
  // Take a provided schedule and build the interface to show it.

  document.getElementById('scheduleContainer').innerHTML = ''
  $('#dateSpecificScheduleAlert').hide()

  // Record the timestamp when this schedule was generated
  constConfig.scheduleUpdateTime = schedule.updateTime
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

      // Create the plain-language description of the action
      if (['power_off', 'power_on', 'refresh_page', 'restart', 'set_app', 'set_content'].includes(action)) {
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
    case 'set_app':
      return 'Set app for'
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
  } else if (target.startsWith('__group_')) {
    return 'all ' + target.slice(7)
  } else if (target.startsWith('__id_')) {
    return target.slice(5)
  } else if (target.endsWith('.exhibit')) {
    return target.slice(0, -8)
  }
}

function setScheduleActionTargetSelectorPopulateOptions (optionsToAdd) {
  // Helper function for setScheduleActionTargetSelector that populates the target selector with the right options.

  const targetSelector = $('#scheduleTargetSelector')

  if (optionsToAdd.includes("All")) {
    targetSelector.append(new Option('All', '__all'))
  }
  if (optionsToAdd.includes("Groups")) {
    const sep = new Option('Groups', null)
    sep.setAttribute('disabled', true)
    targetSelector.append(sep)
    constConfig.componentGroups.forEach((item) => {
      targetSelector.append(new Option(item.group, '__group_' + item.group))
    })
  }
  if (optionsToAdd.includes("ExhibitComponents") || optionsToAdd.includes("Projectors")) {
    const sep = new Option('IDs', null)
    sep.setAttribute('disabled', true)
    targetSelector.append(sep)

    if (optionsToAdd.includes("ExhibitComponents")) {
      constConfig.exhibitComponents.forEach((item) => {
        if (item.type === 'exhibit_component' && item.constellationAppId !== 'static_component') {
          targetSelector.append(new Option(item.id, '__id_' + item.id))
        }
      })
    }
    if (optionsToAdd.includes("Projectors")) {
      constConfig.exhibitComponents.forEach((item) => {
        if (item.type === 'projector') {
          targetSelector.append(new Option(item.id, '__id_' + item.id))
        }
      })
    }
  }
}

export function setScheduleActionTargetSelector () {
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
  } else if (['power_on', 'power_off', 'refresh_page', 'restart', 'set_app', 'set_content'].includes(action)) {
    // Fill the target selector with the list of groups and ids, plus an option for all.
    targetSelector.empty()


    if (['power_on', 'power_off'].includes(action)) {
      setScheduleActionTargetSelectorPopulateOptions(["All", "Groups", "ExhibitComponents", "Projectors"])
    } else if (['refresh_page', 'restart'].includes(action)) {
      setScheduleActionTargetSelectorPopulateOptions(["All", "Groups", "ExhibitComponents"])
    } else if (['set_app', 'set_content'].includes(action)) {
      setScheduleActionTargetSelectorPopulateOptions(["ExhibitComponents"])
    }
    targetSelector.show()
    $('#scheduleTargetSelectorLabel').show()
    // For certain ations, we want to then populare the value selector
    if (['set_app', 'set_content'].includes(action)) {
      setScheduleActionValueSelector()
    } else {
      $('#scheduleValueSelector').hide()
      $('#scheduleValueSelectorLabel').hide()
    }
  } else {
    targetSelector.hide()
    $('#scheduleTargetSelectorLabel').hide()
    targetSelector.val(null)
    $('#scheduleValueSelector').hide()
    $('#scheduleValueSelectorLabel').hide()
  }
}

export function setScheduleActionValueSelector () {
  // Helper function to show/hide the select element for picking the value
  // of an action when appropriate

  const action = $('#scheduleActionSelector').val()
  const target = $('#scheduleTargetSelector').val()
  const valueSelector = $('#scheduleValueSelector')
  valueSelector.empty()

  if (action === 'set_content') {
    const component = constExhibit.getExhibitComponent(target.slice(5))

    constTools.makeRequest({
      method: 'GET',
      url: component.helperAddress,
      endpoint: '/getAvailableContent'
    })
      .then((response) => {
        response.all_exhibits.forEach((item) => {
          valueSelector.append(new Option(item, item))
        })
      })
  } else if (action === 'set_app') {
    const appDict = {
      infostation: 'InfoStation',
      media_browser: 'Media Browser',
      media_player: 'Media Player',
      timelapse_viewer: 'Timelapse Viewer',
      voting_kiosk: 'Voting Kiosk',
      word_cloud_input: 'Word Cloud Input',
      word_cloud_viewer: 'Word Cloud Viewer'
    }

    Object.keys(appDict).forEach((key) => {
      valueSelector.append(new Option(appDict[key], key))
    })
  }

  // In the case of editing an action, preselect any existing values
  valueSelector.val($('#scheduleEditModal').data('currentValue'))
  valueSelector.show()
  $('#scheduleValueSelectorLabel').show()
}

export function scheduleConfigureEditModal (scheduleName,
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

export function sendScheduleUpdateFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to the control server asking to add the given action

  const scheduleName = $('#scheduleEditModal').data('scheduleName')
  const time = $('#scheduleActionTimeInput').val().trim()
  const action = $('#scheduleActionSelector').val()
  const target = $('#scheduleTargetSelector').val()
  const value = $('#scheduleValueSelector').val()
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
    time_to_set: time,
    action_to_set: action,
    target_to_set: target,
    value_to_set: value,
    schedule_id: scheduleID
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/update',
    params: requestDict
  })
    .then((update) => {
      if ('success' in update) {
        if (update.success === true) {
          $('#scheduleEditModal').modal('hide')
          populateSchedule(update)
        } else {
          $('#scheduleEditErrorAlert').html(update.reason).show()
        }
      }
    })
}

export function scheduleDeleteActionFromModal () {
  // Gather necessary info from the schedule editing modal and send a
  // message to the control server asking to delete the given action

  const scheduleName = $('#scheduleEditModal').data('scheduleName')
  const scheduleID = $('#scheduleEditModal').data('scheduleID')

  console.log('Delete:', scheduleName, scheduleID)

  const requestDict = {
    schedule_name: scheduleName,
    schedule_id: scheduleID
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/deleteAction',
    params: requestDict
  })
    .then((update) => {
      if ('success' in update && update.success === true) {
        $('#scheduleEditModal').modal('hide')
        populateSchedule(update)
      }
    })
}

export function askForScheduleRefresh () {
  // Send a message to the control server asking it to reload the schedule
  // from disk

  $('#refreshScheduleButton').html('Refreshing...')

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/refresh'
  })
    .then((update) => {
      if (update.class === 'schedule') {
        populateSchedule(update)
      }
      $('#refreshScheduleButton').html('Success!')
      const temp = function () {
        $('#refreshScheduleButton').html('Refresh schedule')
      }
      setTimeout(temp, 2000)
    })
    .catch(() => {
      $('#refreshScheduleButton').html('Timed out!')
      const temp = function () {
        $('#refreshScheduleButton').html('Refresh schedule')
      }
      setTimeout(temp, 2000)
    })
}
