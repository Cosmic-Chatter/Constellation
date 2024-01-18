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
        if ($('#manageFutureDateModal').hasClass('show')) {
          populateFutureDatesList()
          document.getElementById('manageFutureDateCalendarInput').value = ''
          populateFutureDateCalendarInput()
        }
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

  const allowEdit = constTools.checkPermission('schedule', 'edit')

  // Record the timestamp when this schedule was generated
  constConfig.scheduleUpdateTime = schedule.updateTime
  const sched = schedule.schedule
  const dateOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }

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
    dayContainer.classList = `col-12 col-sm-6 col-xl-4 pb-3 border ${scheduleClass}`

    const row = document.createElement('div')
    row.classList = 'row'
    dayContainer.appendChild(row)

    const dayNameCol = document.createElement('div')
    dayNameCol.classList = 'col-10 border-bottom py-2'
    row.appendChild(dayNameCol)

    // Parse the date into a string
    const dateSplit = day.date.split('-')
    const date = new Date(parseInt(dateSplit[0]), parseInt(dateSplit[1]) - 1, parseInt(dateSplit[2]))
    const dateStr = date.toLocaleDateString(undefined, dateOptions)

    const dayNameSpan = document.createElement('span')
    dayNameSpan.style.fontSize = '24px'
    dayNameSpan.innerHTML = dateStr
    dayNameCol.appendChild(dayNameSpan)

    const menuCol = document.createElement('div')
    menuCol.classList = 'col-2 border-bottom py-2 d-flex flex-column justify-content-center'
    row.appendChild(menuCol)

    const dropdownDiv = document.createElement('div')
    dropdownDiv.classList = 'dropdown text-end'
    menuCol.appendChild(dropdownDiv)

    const dropdownButton = document.createElement('button')
    dropdownButton.classList = 'btn btn-sm btn-outline-secondary dropdown-toggle'
    dropdownButton.setAttribute('type', 'button')
    dropdownButton.setAttribute('data-bs-toggle', 'dropdown')
    dropdownButton.setAttribute('aria-expanded', 'false')
    dropdownDiv.appendChild(dropdownButton)

    const dropdownMenu = document.createElement('ul')
    dropdownMenu.classList = 'dropdown-menu'
    dropdownDiv.appendChild(dropdownMenu)

    const csvLi = document.createElement('li')
    dropdownMenu.appendChild(csvLi)

    const csv = document.createElement('button')
    csv.classList = 'dropdown-item'
    csv.innerHTML = 'Download as CSV'
    csv.addEventListener('click', () => {
      downloadScheduleAsCSV(scheduleName)
    })
    csvLi.appendChild(csv)

    const jsonLi = document.createElement('li')
    dropdownMenu.appendChild(jsonLi)

    const json = document.createElement('button')
    json.classList = 'dropdown-item'
    json.innerHTML = 'Download as JSON'
    json.addEventListener('click', () => {
      downloadScheduleAsJSON(scheduleName)
    })
    jsonLi.appendChild(json)

    if (allowEdit) {
      const editButtonCol = document.createElement('div')
      editButtonCol.classList = 'col-12 col-md-6 mt-2'
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
      convertButtonCol.classList = 'col-12 col-md-6 mt-2'
      convertButtonCol.style.display = convertState
      row.appendChild(convertButtonCol)

      const convertButton = document.createElement('button')
      convertButton.classList = 'btn btn-warning w-100'
      convertButton.setAttribute('type', 'button')
      convertButton.innerHTML = 'Convert to date-specific'
      convertButton.addEventListener('click', function () {
        scheduleConvertToDateSpecific(day.date, day.dayName)
      })
      convertButtonCol.appendChild(convertButton)

      const deleteButtonCol = document.createElement('div')
      deleteButtonCol.classList = 'col-12 col-md-6 mt-2'
      deleteButtonCol.style.display = deleteState
      row.appendChild(deleteButtonCol)

      const deleteButton = document.createElement('button')
      deleteButton.classList = 'btn btn-danger w-100'
      deleteButton.setAttribute('type', 'button')
      deleteButton.innerHTML = 'Delete date-specific'
      deleteButton.setAttribute('data-bs-toggle', 'popover')
      deleteButton.setAttribute('title', 'Are you sure?')
      deleteButton.setAttribute('data-bs-content', `<a id="Popover${day.date}" class='btn btn-danger w-100 schedule-delete'>Confirm</a>`)
      deleteButton.setAttribute('data-bs-trigger', 'focus')
      deleteButton.setAttribute('data-bs-html', 'true')
      // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
      deleteButton.addEventListener('click', function () { deleteButton.focus() })
      deleteButtonCol.appendChild(deleteButton)
      $(deleteButton).popover()
    }

    $('#scheduleContainer').append(dayContainer)

    // Loop through the schedule elements and add a row for each
    const scheduleIDs = Object.keys(day.schedule)

    scheduleIDs.forEach((scheduleID) => {
      dayContainer.appendChild(createScheduleEntryHTML(day.schedule[scheduleID], scheduleID, scheduleName, day.source))
    })
    // Sort the elements by time
    const events = $(dayContainer).children('.eventListing')
    events.sort(function (a, b) {
      return $(a).data('time_in_seconds') - $(b).data('time_in_seconds')
    })
    $(dayContainer).append(events)
  })

  $('#Schedule_next_event').html(populateScheduleDescriptionHelper(schedule.nextEvent, true))
}

function createScheduleEntryHTML (item, scheduleID, scheduleName, scheduleType, allowEdit = constTools.checkPermission('schedule', 'edit')) {
  // Take a dictionary of properties and build an HTML representation of the schedule entry.

  let description = null
  const action = item.action
  const target = item.target
  const value = item.value

  // Create the plain-language description of the action
  if (['power_off', 'power_on', 'refresh_page', 'restart', 'set_definition', 'set_dmx_scene'].includes(action)) {
    description = populateScheduleDescriptionHelper([item], false)
  } else if (action === 'set_exhibit') {
    description = `Set exhibit: ${target}`
  } else if (action === 'note') {
    description = item.value
  }

  if (description == null) return

  const eventRow = document.createElement('div')
  eventRow.classList = 'row mt-2 eventListing'
  $(eventRow).data('time_in_seconds', item.time_in_seconds)

  let eventDescriptionOuterContainer
  if (action === 'note') {
    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'me-0 pe-0 col-9'
    } else {
      eventDescriptionCol.classList = 'col-12'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-white bg-success w-100 h-100 justify-content-center d-flex py-1 pe-1 rounded-start'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.innerHTML = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  } else {
    const eventTimeCol = document.createElement('div')
    eventTimeCol.classList = 'col-4 me-0 pe-0'
    eventRow.appendChild(eventTimeCol)

    const eventTimeContainer = document.createElement('div')
    eventTimeContainer.classList = 'rounded-start text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 ps-1'
    eventTimeCol.appendChild(eventTimeContainer)

    const eventTime = document.createElement('div')
    eventTime.classList = 'align-self-center justify-content-center'
    eventTime.innerHTML = item.time
    eventTimeContainer.appendChild(eventTime)

    const eventDescriptionCol = document.createElement('div')
    if (allowEdit) {
      eventDescriptionCol.classList = 'mx-0 px-0 col-5'
    } else {
      eventDescriptionCol.classList += 'ms-0 ps-0 col-8'
    }
    eventRow.appendChild(eventDescriptionCol)

    eventDescriptionOuterContainer = document.createElement('div')
    eventDescriptionOuterContainer.classList = 'text-light bg-secondary w-100 h-100 justify-content-center d-flex py-1 pe-1'
    eventDescriptionCol.appendChild(eventDescriptionOuterContainer)

    const eventDescriptionInnerContainer = document.createElement('div')
    eventDescriptionInnerContainer.classList = 'align-self-center justify-content-center text-wrap'
    eventDescriptionOuterContainer.appendChild(eventDescriptionInnerContainer)

    const eventDescription = document.createElement('center')
    eventDescription.innerHTML = description
    eventDescriptionOuterContainer.appendChild(eventDescription)
  }

  if (allowEdit) {
    const eventEditButtonCol = document.createElement('div')
    eventEditButtonCol.classList = 'col-3 ms-0 ps-0'
    eventRow.appendChild(eventEditButtonCol)

    const eventEditButton = document.createElement('button')
    eventEditButton.classList = 'btn-info w-100 h-100 rounded-end'
    eventEditButton.setAttribute('type', 'button')
    eventEditButton.style.borderStyle = 'solid'
    eventEditButton.style.border = '0px'
    eventEditButton.innerHTML = 'Edit'
    eventEditButton.addEventListener('click', function () {
      scheduleConfigureEditModal(scheduleName, scheduleType.source, false, scheduleID, item.time, action, target, value)
    })
    eventEditButtonCol.appendChild(eventEditButton)
  } else {
    eventDescriptionOuterContainer.classList.add('rounded-end')
  }

  return eventRow
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
    case 'set_definition':
      return 'Set defintion for'
    case 'set_dmx_scene':
      return 'Set DMX scene for'
    case 'set_exhibit':
      return 'Set exhibit'
    default:
      return action
  }
}

function scheduleTargetToDescription (targetList) {
  // Convert targets such as "__id_TEST1" to English words like "TEST1"

  if (targetList == null) return 'none'

  let target
  if (typeof targetList === 'string') {
    target = targetList
  } else {
    if (targetList.length > 1) {
      return 'multiple components'
    } else if (targetList.length === 1) {
      target = targetList[0]
    } else {
      return 'none'
    }
  }

  if (target === '__all') {
    return 'all components'
  } else if (target.startsWith('__group_')) {
    return 'all ' + target.slice(8)
  } else if (target.startsWith('__id_')) {
    return target.slice(5)
  } else if (target.endsWith('.exhibit')) {
    return target.slice(0, -8)
  } else return target
}

function setScheduleActionTargetSelectorPopulateOptions (optionsToAdd) {
  // Helper function for setScheduleActionTargetSelector that populates the target selector with the right options.

  const targetSelector = $('#scheduleTargetSelector')

  if (optionsToAdd.includes('All')) {
    targetSelector.append(new Option('All', '__all'))
  }
  if (optionsToAdd.includes('Groups')) {
    const sep = new Option('Groups', null)
    sep.setAttribute('disabled', true)
    targetSelector.append(sep)
    constConfig.componentGroups.forEach((item) => {
      targetSelector.append(new Option(item.group, '__group_' + item.group))
    })
  }
  if (optionsToAdd.includes('ExhibitComponents') || optionsToAdd.includes('Projectors')) {
    const sep = new Option('IDs', null)
    sep.setAttribute('disabled', true)
    targetSelector.append(sep)

    if (optionsToAdd.includes('ExhibitComponents')) {
      constConfig.exhibitComponents.forEach((item) => {
        if (item.type === 'exhibit_component' && item.constellationAppId !== 'static_component') {
          targetSelector.append(new Option(item.id, '__id_' + item.id))
        }
      })
    }
    if (optionsToAdd.includes('Projectors')) {
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
    targetSelector.attr('multiple', false)
    targetSelector.empty()
    const availableExhibits = $.makeArray($('#exhibitSelect option'))
    availableExhibits.forEach((item) => {
      targetSelector.append(new Option(item.value, item.value))
    })
    targetSelector.show()
    $('#scheduleTargetSelectorLabel').show()
    $('#scheduleNoteInput').hide()
  } else if (['power_on', 'power_off', 'refresh_page', 'restart', 'set_definition', 'set_dmx_scene'].includes(action)) {
    // Fill the target selector with the list of groups and ids, plus an option for all.
    targetSelector.empty()

    if (['power_on', 'power_off'].includes(action)) {
      targetSelector.attr('multiple', true)
      setScheduleActionTargetSelectorPopulateOptions(['All', 'Groups', 'ExhibitComponents', 'Projectors'])
    } else if (['refresh_page', 'restart'].includes(action)) {
      targetSelector.attr('multiple', true)
      setScheduleActionTargetSelectorPopulateOptions(['All', 'Groups', 'ExhibitComponents'])
    } else if (['set_definition', 'set_dmx_scene'].includes(action)) {
      targetSelector.attr('multiple', false)
      setScheduleActionTargetSelectorPopulateOptions(['ExhibitComponents'])
    }
    targetSelector.show()
    $('#scheduleTargetSelectorLabel').show()
    // For certain ations, we want to then populare the value selector
    if (['set_definition', 'set_dmx_scene'].includes(action)) {
      setScheduleActionValueSelector()
    } else {
      $('#scheduleValueSelector').hide()
      $('#scheduleValueSelectorLabel').hide()
    }
    $('#scheduleNoteInput').hide()
  } else if (action === 'note') {
    targetSelector.hide()
    $('#scheduleTargetSelectorLabel').hide()
    targetSelector.val(null)
    $('#scheduleValueSelector').hide()
    $('#scheduleValueSelectorLabel').hide()
    $('#scheduleNoteInput').show()
  } else {
    targetSelector.hide()
    $('#scheduleTargetSelectorLabel').hide()
    targetSelector.val(null)
    $('#scheduleValueSelector').hide()
    $('#scheduleValueSelectorLabel').hide()
    $('#scheduleNoteInput').hide()
  }
}

export function setScheduleActionValueSelector () {
  // Helper function to show/hide the select element for picking the value
  // of an action when appropriate

  const action = $('#scheduleActionSelector').val()
  const target = $('#scheduleTargetSelector').val()
  const valueSelector = $('#scheduleValueSelector')
  valueSelector.empty()

  if (['set_definition'].includes(action)) {
    let component
    try {
      component = constExhibit.getExhibitComponent(target.slice(5))
    } catch {
      return
    }

    constTools.makeRequest({
      method: 'GET',
      url: component.helperAddress,
      endpoint: '/getAvailableContent'
    })
      .then((response) => {
        if (action === 'set_definition') {
          // Convert the dictionary to an array, sorted by app ID
          const defList = Object.values(response.definitions).sort(function (a, b) {
            return (a.app < b.app) ? -1 : (a.app > b.app) ? 1 : 0
          })
          const seenApps = []
          defList.forEach((def) => {
            if (def.uuid.startsWith('__preview')) return
            if (seenApps.includes(def.app) === false) {
              seenApps.push(def.app)
              const header = new Option(constExhibit.convertAppIDtoDisplayName(def.app))
              header.setAttribute('disabled', true)
              valueSelector.append(header)
            }
            valueSelector.append(new Option(def.name, def.uuid))
          })
        }
        // In the case of editing an action, preselect any existing values
        valueSelector.val($('#scheduleEditModal').data('currentValue'))
        valueSelector.show()
        $('#scheduleValueSelectorLabel').show()
      })
  } else if (action === 'set_dmx_scene') {
    let component
    try {
      component = constExhibit.getExhibitComponent(target.slice(5))
    } catch {
      return
    }

    constTools.makeRequest({
      method: 'GET',
      url: component.helperAddress,
      endpoint: '/DMX/getScenes'
    })
      .then((response) => {
        if ('success' in response && response.success === true) {
          response.groups.forEach((group) => {
            const groupName = new Option(group.name, null)
            groupName.setAttribute('disabled', true)
            valueSelector.append(groupName)

            group.scenes.forEach((scene) => {
              valueSelector.append(new Option(scene.name, scene.uuid))
            })
          })
        }

        // In the case of editing an action, preselect any existing values
        valueSelector.val($('#scheduleEditModal').data('currentValue'))
        valueSelector.show()
        $('#scheduleValueSelectorLabel').show()
      })
  } else {
    valueSelector.hide()
    $('#scheduleValueSelectorLabel').hide()
  }
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

  // If currentScheduleID == null, we are adding a new schedule item, so create a unique ID
  if (currentScheduleID == null) {
    currentScheduleID = constTools.uuid()
  }

  // Hide elements that aren't always visible
  $('#scheduleTargetSelector').hide()
  $('#scheduleTargetSelectorLabel').hide()
  $('#scheduleValueSelector').hide()
  $('#scheduleValueSelectorLabel').hide()
  $('#scheduleEditErrorAlert').hide()
  $('#scheduleNoteInput').hide()
  $('#scheduleNoteInput').val('')

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

    if (currentAction === 'note') {
      $('#scheduleNoteInput').val(currentValue)
      $('#scheduleNoteInput').show()
    } else {
      if (currentTarget != null) {
        setScheduleActionTargetSelector()
        $('#scheduleTargetSelector').val(currentTarget)
        $('#scheduleTargetSelector').show()
        $('#scheduleTargetSelectorLabel').show()
      }
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
  let target = $('#scheduleTargetSelector').val()
  let value
  if (action === 'note') {
    value = $('#scheduleNoteInput').val()
    target = ''
    console.log(time, action, target)
  } else {
    value = $('#scheduleValueSelector').val()
  }
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
  } else if (['power_on', 'power_off', 'refresh_page', 'restart'].includes(action) && target == null) {
    $('#scheduleEditErrorAlert').html('You must specifiy a target for this action').show()
    return
  } else if (['set_deinition', 'set_dmx_scene'].includes(value) && value == null) {
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
          if ($('#manageFutureDateModal').hasClass('show')) {
            populateFutureDateCalendarInput()
          }
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
        if ($('#manageFutureDateModal').hasClass('show')) {
          populateFutureDateCalendarInput()
        }
      }
    })
}

export function showManageFutureDateModal () {
  // Prepare the modal and show it.

  const allowEdit = constTools.checkPermission('schedule', 'edit')

  // Clear any existing entries
  document.getElementById('manageFutureDateEntryList').innerHTML = ''
  document.getElementById('manageFutureDateCalendarInput').value = ''
  populateFutureDatesList()
  document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
  document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'

  if (allowEdit) {
    document.getElementById('manageFutureDateModal').querySelector('.modal-title').innerHTML = 'Manage a future date'
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
    document.getElementById('manageFutureDateEntryList').classList.add('mt-3')
  } else {
    document.getElementById('manageFutureDateModal').querySelector('.modal-title').innerHTML = 'View a future date'
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'none'
    document.getElementById('manageFutureDateCalendarInput').style.display = 'none'
    document.getElementById('manageFutureDateEntryList').classList.remove('mt-3')
  }

  $('#manageFutureDateModal').modal('show')
}

function populateFutureDatesList () {
  // Get a list of upcoming dates with special schedules and build GUI elements for them.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/availableDateSpecificSchedules'
  })
    .then((result) => {
      if (result.success === true) {
        const availableDatesList = document.getElementById('manageFutureDateAvailableSchedulesList')
        availableDatesList.innerHTML = ''
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }

        result.schedules.sort((date1, date2) => {
          return new Date(date1) - new Date(date2)
        }).forEach((date) => {
          const button = document.createElement('button')
          button.classList = 'btn btn-info mt-2 w-100 futureEventDateButton'
          button.setAttribute('id', 'futureDateButton_' + date)

          // Build the date string
          const dateObj = new Date(date + 'T00:00')
          button.innerHTML = dateObj.toLocaleDateString(undefined, options)

          button.addEventListener('click', (event) => {
            document.getElementById('manageFutureDateCalendarInput').value = date
            populateFutureDateCalendarInput()

            // Highlight the button
            Array.from(availableDatesList.querySelectorAll('.futureEventDateButton')).forEach((el) => {
              el.classList.replace('btn-success', 'btn-info')
            })
            event.target.classList.replace('btn-info', 'btn-success')
          })

          availableDatesList.appendChild(button)
        })
      }
    })
}

export function populateFutureDateCalendarInput () {
  // Called when the user selects a date on the manageFutureDateModal

  const allowEdit = constTools.checkPermission('schedule', 'edit')

  const date = document.getElementById('manageFutureDateCalendarInput').value
  const scheduleList = document.getElementById('manageFutureDateEntryList')
  scheduleList.innerHTML = ''
  const availableDatesList = document.getElementById('manageFutureDateAvailableSchedulesList')

  Array.from(availableDatesList.querySelectorAll('.futureEventDateButton')).forEach((el) => {
    el.classList.replace('btn-success', 'btn-info')
  })

  if (date === '') {
    document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
    document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
    document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'
    return
  }

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + date + '/get'
  })
    .then((day) => {
      if (day.success === false) {
        document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'block'
        document.getElementById('manageFutureDateAddActionButton').style.display = 'none'
        document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'none'
        return
      } else {
        document.getElementById('manageFutureDateCreateScheduleButtonContainer').style.display = 'none'
        if (allowEdit) {
          document.getElementById('manageFutureDateAddActionButton').style.display = 'block'
          document.getElementById('manageFutureDateDeleteScheduleButton').style.display = 'block'
        }

        // Find the appropriate button and highlight it
        document.getElementById('futureDateButton_' + date).classList.replace('btn-info', 'btn-success')
      }

      // Loop through the schedule elements and add a row for each
      const scheduleIDs = Object.keys(day.schedule)

      scheduleIDs.forEach((scheduleID) => {
        scheduleList.appendChild(createScheduleEntryHTML(day.schedule[scheduleID], scheduleID, date, 'date-specific'))

        // Sort the elements by time
        const events = $(scheduleList).children('.eventListing')
        events.sort(function (a, b) {
          return $(a).data('time_in_seconds') - $(b).data('time_in_seconds')
        })
        $(scheduleList).append(events)
      })
    })
}

export function convertFutureScheduleFromModal () {
  // Take the current date from the input and convert it to a date-specific schedule.

  const date = document.getElementById('manageFutureDateCalendarInput').value
  if (date === '') return

  const dateObj = new Date(date + 'T00:00')
  const dayOfWeek = dateObj.toLocaleDateString(undefined, { weekday: 'long' })

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/schedule/convert',
    params: {
      date,
      convert_from: dayOfWeek
    }
  })
    .then((result) => {
      populateFutureDatesList()
    })
}

function downloadScheduleAsCSV (name) {
  // Get the given schedule as a CSV from Control Server and download for the user.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + name + '/getCSV'
  })
    .then((result) => {
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
    })
}

function downloadScheduleAsJSON (name) {
  // Get the given schedule as JSON from Control Server and download for the user.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + name + '/getJSONString'
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        // Convert the text to a file and initiate download
        const fileBlob = new Blob([result.json], {
          type: 'text/plain'
        })
        const a = document.createElement('a')
        a.href = window.URL.createObjectURL(fileBlob)
        a.download = name + '.json'
        a.click()
      }
    })
}

export function onScheduleFromFileModalFileInputChange (event) {
  // Called when a user selects a file for upload from the scheduleFromFileModal.

  const file = event.target.files[0]

  document.getElementById('scheduleFromFileModalFileInputLabel').innerHTML = file.name
}

export function createScheduleFromFile () {
  // Use details from scheduleFromCSVModal to create a new schedule.

  const fileInput = document.getElementById('scheduleFromFileModalFileInput')
  if (fileInput.files.length === 0) return

  const fileReader = new FileReader()
  fileReader.onload = (result) => {
    previewCSVSchedule(result.target.result)
  }
  fileReader.readAsText(fileInput.files[0], 'UTF-8')
}

async function previewCSVSchedule (csv) {
  // Build an HTML representation of the uploaded schedule

  const result = constTools.csvToJSON(csv)
  const schedule = result.json

  // Convert any comma-separated values into arrays
  const scheduleDict = {}
  for (const entry of schedule) {
    // First, convert the given time into seconds from midnight
    entry.time_in_seconds = await _getSecondsFromMidnight(entry.time)

    if (entry.action === 'note') {
      // Notes may have commas that are okay.
      scheduleDict[constTools.uuid()] = entry
      continue
    }
    for (const key of ['target', 'value']) {
      if ((entry[key] == null) || (entry[key].includes(',') === false)) continue
      entry[key] = entry[key].split(',').map(function (item) {
        return item.trim()
      })
    }
    scheduleDict[constTools.uuid()] = entry
  }

  const newScheduleEl = document.getElementById('scheduleFromFileNewSchedule')
  const type = document.getElementById('scheduleFromFileKindSelect').value
  newScheduleEl.innerHTML = ''

  // Loop through the schedule elements and add a row for each
  const scheduleIDs = Object.keys(scheduleDict)

  scheduleIDs.forEach((scheduleID) => {
    newScheduleEl.appendChild(createScheduleEntryHTML(scheduleDict[scheduleID], scheduleID, type, 'day-specific', false))

    // Sort the elements by time
    const events = $(newScheduleEl).children('.eventListing')
    events.sort(function (a, b) {
      return $(a).data('time_in_seconds') - $(b).data('time_in_seconds')
    })
    $(newScheduleEl).append(events)
  })
}

async function _getSecondsFromMidnight (timeString) {
  return new Promise(function (resolve, reject) {
    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/schedule/getSecondsFromMidnight',
      params: { time_str: String(timeString) }
    })
      .then((response) => {
        resolve(parseFloat(response.seconds))
      })
  })
}

export function onCreateScheduleFromFileTypeSelect () {
  // Called when the user selects a schedule from the dropdown

  const type = document.getElementById('scheduleFromFileKindSelect').value
  const currentScheduleEl = document.getElementById('scheduleFromFileCurrentSchedule')

  if (type === 'date-specific') {
    document.getElementById('scheduleFromFileDateSelect').style.display = 'block'
    return
  }
  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/schedule/' + type + '/get'
  })
    .then((response) => {
      if (response.success === true) {
        currentScheduleEl.innerHTML = ''
        // Loop through the schedule elements and add a row for each
        const scheduleIDs = Object.keys(response.schedule)

        scheduleIDs.forEach((scheduleID) => {
          currentScheduleEl.appendChild(createScheduleEntryHTML(response.schedule[scheduleID], scheduleID, type, 'day-specific', false))

          // Sort the elements by time
          const events = $(currentScheduleEl).children('.eventListing')
          events.sort(function (a, b) {
            return $(a).data('time_in_seconds') - $(b).data('time_in_seconds')
          })
          $(currentScheduleEl).append(events)
        })
      }
    })
}
