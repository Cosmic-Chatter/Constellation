/* global showdown */

import constConfig from './config.js'
import * as constExhibit from './constellation_exhibit.js'
import * as constIssues from './constellation_issues.js'
import * as constMaintenance from './constellation_maintenance.js'
import * as constProjector from './constellation_projector.js'
import * as constSchedule from './constellation_schedule.js'
import * as constTools from './constellation_tools.js'
import * as constTracker from './constellation_tracker.js'

function showManageExhibitsModal () {
  // Configure the manageExhibitsModal and show it.

  document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').checked = true
  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/exhibit/getAvailable'
  })
    .then((result) => {
      populateManageExhibitsExhibitList(result.available_exhibits)
      $('#manageExhibitsModal').modal('show')
    })
}

function populateManageExhibitsExhibitList (exhibits) {
  // Take a list of exhibits and create a GUI representation for each

  const exhibitRow = document.getElementById('manageExhibitsModalExhibitList')
  exhibitRow.innerHTML = ''

  exhibits.forEach((exhibit) => {
    const col = document.createElement('div')
    col.classList = 'col-12 mt-2'
    exhibitRow.appendChild(col)

    const button = document.createElement('button')
    button.classList = 'btn btn-info w-100 manageExhibitListButton'
    button.innerHTML = exhibit
    button.addEventListener('click', (event) => {
      Array.from(exhibitRow.querySelectorAll('.manageExhibitListButton')).forEach((el) => {
        el.classList.replace('btn-success', 'btn-info')
      })
      event.target.classList.replace('btn-info', 'btn-success')
      populateManageExhibitsExhibitContent(exhibit)
    })
    col.appendChild(button)
  })
}

function populateManageExhibitsExhibitContent (exhibit) {
  // Create a GUI representation of the given exhibit that shows the defintion for each component.

  const contentList = document.getElementById('manageExhibitsModalExhibitContentList')
  contentList.innerHTML = ''
  document.getElementById('manageExhibitModalExhibitNameInput').value = exhibit

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/getDetails',
    params: { name: exhibit }
  })
    .then((result) => {
      result.exhibit.forEach((component) => {
        const col = document.createElement('div')
        col.classList = 'col-6 mt-2'
        contentList.appendChild(col)

        const row = document.createElement('div')
        row.classList = 'row px-1'
        col.appendChild(row)

        const header = document.createElement('div')
        header.classList = 'col-12 bg-primary rounded-top text-light py-1'
        header.innerHTML = component.id
        row.appendChild(header)

        const body = document.createElement('div')
        body.classList = 'col-12 bg-secondary rounded-bottom py-2'
        row.appendChild(body)

        const bodyRow = document.createElement('div')
        bodyRow.classList = 'row gy-2'
        body.appendChild(bodyRow)

        const componentObj = constExhibit.getExhibitComponent(component.id)

        if (componentObj != null) {
          // This component is active

          const definitionPreviewCol = document.createElement('div')
          definitionPreviewCol.classList = 'col-12 exhibit-thumbnail'
          bodyRow.appendChild(definitionPreviewCol)

          const definitionPreviewImage = document.createElement('img')
          definitionPreviewImage.style.width = '100%'
          definitionPreviewImage.style.height = '100px'
          definitionPreviewImage.style.objectFit = 'contain'
          definitionPreviewCol.appendChild(definitionPreviewImage)

          const definitionPreviewVideo = document.createElement('video')
          definitionPreviewVideo.setAttribute('autoplay', true)
          definitionPreviewVideo.muted = 'true'
          definitionPreviewVideo.setAttribute('loop', 'true')
          definitionPreviewVideo.setAttribute('playsinline', 'true')
          definitionPreviewVideo.setAttribute('webkit-playsinline', 'true')
          definitionPreviewVideo.setAttribute('disablePictureInPicture', 'true')
          definitionPreviewVideo.style.width = '100%'
          definitionPreviewVideo.style.height = '100px'
          definitionPreviewVideo.style.objectFit = 'contain'
          definitionPreviewCol.appendChild(definitionPreviewVideo)

          const definitionSelectCol = document.createElement('div')
          definitionSelectCol.classList = 'col-12'
          bodyRow.appendChild(definitionSelectCol)

          const definitionSelect = document.createElement('select')
          definitionSelect.classList = 'form-select'
          definitionSelectCol.appendChild(definitionSelect)

          constTools.makeRequest({
            method: 'GET',
            url: componentObj.getHelperURL(),
            endpoint: '/getAvailableContent'
          })
            .then((availableContent) => {
              // Build an option for each definition
              const appDict = constTools.sortDefinitionsByApp(availableContent.definitions)
              Object.keys(appDict).sort().forEach((app) => {
                const header = new Option(constExhibit.convertAppIDtoDisplayName(app))
                header.setAttribute('disabled', true)
                definitionSelect.appendChild(header)

                appDict[app].forEach((def) => {
                  const option = new Option(def.name, def.uuid)
                  definitionSelect.appendChild(option)
                })
              })

              const changeThumb = function () {
                if (availableContent.thumbnails.includes(definitionSelect.value + '.mp4')) {
                  definitionPreviewVideo.src = componentObj.getHelperURL() + '/thumbnails/' + definitionSelect.value + '.mp4'
                  definitionPreviewVideo.play()
                  definitionPreviewImage.style.display = 'none'
                  definitionPreviewVideo.style.display = 'block'
                } else if (availableContent.thumbnails.includes(definitionSelect.value + '.jpg')) {
                  definitionPreviewImage.src = componentObj.getHelperURL() + '/thumbnails/' + definitionSelect.value + '.jpg'
                  definitionPreviewVideo.style.display = 'none'
                  definitionPreviewImage.style.display = 'block'
                } else {
                  definitionPreviewVideo.style.display = 'none'
                  definitionPreviewImage.style.display = 'none'
                }
              }

              definitionSelect.addEventListener('change', changeThumb)
              definitionSelect.value = component.definition
              changeThumb()
            })
        } else {
          // This component is inactive

          const badComponentCol = document.createElement('div')
          badComponentCol.classList = 'col-12 text-warning fst-italic text-center'
          badComponentCol.innerHTML = 'Component unavailable'
          bodyRow.appendChild(badComponentCol)
        }
      })
    })
}

function onManageExhibitModalThumbnailCheckboxChange () {
  // Get the value of the checkbox and show/hide the definition
  // tbumbnails as appropriate.

  const checked = document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').checked
  document.querySelectorAll('.exhibit-thumbnail').forEach((el) => {
    if (checked) {
      el.style.display = 'block'
    } else {
      el.style.display = 'none'
    }
  })
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

function updateAvailableExhibits (exhibitList) {
  // Rebuild the list of available exhibits on the settings tab

  const exhibitSelect = document.getElementById('exhibitSelect')
  const exhibitDeleteSelect = document.getElementById('exhibitDeleteSelector')
  exhibitSelect.innerHTML = ''
  exhibitDeleteSelect.innerHTML = ''

  const sortedExhibitList = exhibitList.sort((a, b) => {
    const aVal = a.toLowerCase()
    const bVal = b.toLowerCase()
    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
    return 0
  })
  sortedExhibitList.forEach((exhibit) => {
    exhibitSelect.appendChild(new Option(exhibit, exhibit))
    exhibitDeleteSelect.appendChild(new Option(exhibit, exhibit))
  })

  exhibitSelect.value = constConfig.currentExhibit
  checkDeleteSelection()
}

function changeExhibit (warningShown) {
  // Send a command to the control server to change the current exhibit

  if (warningShown === false) {
    $('#changeExhibitModal').modal('show')
  } else {
    $('#changeExhibitModal').modal('hide')

    const requestDict = {
      exhibit: {
        name: $('#exhibitSelect').val()
      }
    }

    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/exhibit/set',
      params: requestDict
    })
    // .then(askForUpdate)
  }
}

function populateTrackerDataSelect (data) {
  // Take a list of data filenames and populate the TrackerDataSelect

  const trackerDataSelect = $('#trackerDataSelect')
  trackerDataSelect.empty()

  const sortedList = data.sort((a, b) => {
    const aVal = a.toLowerCase()
    const bVal = b.toLowerCase()

    if (aVal > bVal) return 1
    if (aVal < bVal) return -1
    return 0
  })

  sortedList.forEach(item => {
    const name = item.split('.').slice(0, -1).join('.')
    const html = `<option value="${name}">${name}</option>`
    trackerDataSelect.append(html)
  })
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

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/deleteData',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#deleteTrackerDataModal').modal('hide')
        constTracker.getAvailableTrackerData(populateTrackerDataSelect)
      }
    })
}

function launchTracker () {
  // Open the tracker in a new tab with the currently selected layout

  const name = $('#trackerTemplateSelect').val()

  let url = constConfig.serverAddress + '/tracker.html'
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

  const requestDict = {
    name,
    template: {}
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/createTemplate',
    params: requestDict
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#createTrackerTemplateName').val('')
        constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
      }
    })
}

function deleteTrackerTemplate (name = '') {
  // Ask the server to delete the specified tracker template

  if (name === '') {
    name = $('#trackerTemplateSelect').val()
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/deleteTemplate',
    params: { name }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
        $('#deleteTrackerTemplateModal').modal('hide')
      }
    })
}

function parseUpdate (update) {
  // Take a dictionary of updates from Control Server and act on them.

  if ('gallery' in update) {
    setCurrentExhibitName(update.gallery.current_exhibit)
    updateAvailableExhibits(update.gallery.availableExhibits)

    if ('galleryName' in update.gallery) {
      $('#galleryNameField').html(update.gallery.galleryName)
      document.title = update.gallery.galleryName
    }

    if ('updateAvailable' in update.gallery) {
      if (update.gallery.updateAvailable === 'true') {
        const notification = {
          update_available: true,
          current_version: update.gallery.softwareVersion,
          available_version: update.gallery.softwareVersionAvailable
        }
        constConfig.errorDict.__control_server = {
          software_update: notification
        }
        constTools.rebuildNotificationList()
      }
    }
  }

  if ('issues' in update) {
    // Check for the time of the most recent update. If it is more
    // recent than our existing date, rebuild the issue list

    const currentLastDate = Math.max.apply(Math, constConfig.issueList.map(function (o) { return new Date(o.lastUpdateDate) }))
    const updatedDate = new Date(update.issues.lastUpdateDate)

    if (!constTools.arraysEqual(constConfig.assignableStaff, update.issues.assignable_staff)) {
      constConfig.assignableStaff = update.issues.assignable_staff
      // Populate the filter
      $('#issueListFilterAssignedToSelect').empty()
      $('#issueListFilterAssignedToSelect').append(new Option('All', 'all'))
      $('#issueListFilterAssignedToSelect').append(new Option('Unassigned', 'unassigned'))
      for (let i = 0; i < constConfig.assignableStaff.length; i++) {
        $('#issueListFilterAssignedToSelect').append(new Option(constConfig.assignableStaff[i], constConfig.assignableStaff[i]))
      }
    }
    if (updatedDate > currentLastDate) {
      constConfig.issueList = update.issues.issueList
      constIssues.rebuildIssueList()
    }
  }

  if ('schedule' in update) {
    if (constConfig.scheduleUpdateTime !== update.schedule.updateTime) {
      constSchedule.populateSchedule(update.schedule)
    }
  }

  if ('components' in update) {
    let numComps = 0
    let numOnline = 0
    let numStatic = 0

    update.components.forEach((component) => {
      numComps += 1
      if ((component.status === constConfig.STATUS.ONLINE.name) || (component.status === constConfig.STATUS.STANDBY.name) || (component.status === constConfig.STATUS['SYSTEM ON'].name) || (component.status === constConfig.STATUS.STATIC.name)) {
        numOnline += 1
      }
      if (component.status === constConfig.STATUS.STATIC.name) {
        numStatic += 1
      }
      constExhibit.updateComponentFromServer(component)
    })

    // Set the favicon to reflect the aggregate status
    if (numOnline === numComps) {
      $("link[rel='icon']").attr('href', 'icon/green.ico')
    } else if (numOnline === 0) {
      $("link[rel='icon']").attr('href', 'icon/red.ico')
    } else {
      $("link[rel='icon']").attr('href', 'icon/yellow.ico')
    }
    // If there are no static components, hide the "SHow STATIC" button
    if (numStatic === 0) {
      $('#componentsTabSettingsShowStatic').parent().parent().hide()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'none'
    } else {
      $('#componentsTabSettingsShowStatic').parent().parent().show()
      document.getElementById('componentsTabSettingsShowStaticDivider').parentElement.style.display = 'block'
    }
  }
}

// function askForUpdate () {
//   // Send a message to the control server asking for the latest component
//   // updates

//   constTools.makeServerRequest({
//     method: 'GET',
//     endpoint: '/system/getUpdate'
//   })
//     .then((update) => {
//       parseUpdate(update)
//     })
// }

function populateHelpTab () {
  // Ask the server to send the latest README, convert the Markdown to
  // HTML, and add it to the Help tab.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/getHelpText'
  })
    .then((result) => {
      if (result.success === true) {
        const markdownConverter = new showdown.Converter()
        markdownConverter.setFlavor('github')

        const formattedText = markdownConverter.makeHtml(result.text)
        $('#helpTextDiv').html(formattedText)
      } else {
        $('#helpTextDiv').html('Help text not available.')
      }
    })
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
    edit.classList = 'text-light bg-info w-100 h-100 justify-content-center d-flex ps-1'
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
    right.classList = 'text-light bg-primary w-100 h-100 justify-content-center d-flex pe-1'
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
    name: templateName,
    template
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/tracker/flexible-tracker/createTemplate',
    params: requestDict
  })
    .then((response) => {
      if ('success' in response && response.success === true) {
        $('#editTrackerTemplateModal').modal('hide')
      }
    })
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
  if (searchParams.has('showMaintStatus')) {
    document.getElementById('componentStatusModeMaintenanceCheckbox').checked = true
  }
}

function createExhibit (name, cloneFrom) {
  // Ask the control server to create a new exhibit with the given name.
  // set cloneFrom = null if we are making a new exhibit from scratch.
  // set cloneFrom to the name of an existing exhibit to copy that exhibit

  const requestDict = {
    exhibit: {
      name
    }
  }

  if (cloneFrom != null && cloneFrom !== '') {
    requestDict.clone_from = cloneFrom
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/create',
    params: requestDict
  })
}

function deleteExhibit (name) {
  // Ask the control server to delete the exhibit with the given name.

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/exhibit/delete',
    params: { exhibit: { name } }
  })
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

function showManageSettingsModal () {
  // Configure and show the showManageSettingsModal

  populateManageSettingsModal()

  $('#manageSettingsModalSaveButton').hide()
  $('#manageSettingsModalMissingIPWarning').hide()
  $('#manageSettingsModalRestartRequiredWarning').hide()
  $('#manageSettingsModal').modal('show')
}

function populateManageSettingsModal () {
  // Get the latest system settings from Control Server and build out the interface for changing them.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/system/getConfiguration'
  })
    .then((result) => {
      const config = result.configuration
      // Tag the modal with this config for later use
      $('#manageSettingsModal').data('config', config)

      $('#manageSettingsModalIPInput').val(config.ip_address)
      $('#manageSettingsModalPortInput').val(config.port)
      $('#manageSettingsModalGalleryNameInput').val(config.gallery_name)

      let staffString
      try {
        staffString = config.assignable_staff.join(', ')
      } catch {
        staffString = ''
      }

      $('#manageSettingsModalAssignableStaffInput').val(staffString)
      $('#manageSettingsModalDebugSelect').val(String(config.debug))
    })
}

function updateManageSettingsModal () {
  // Called when a chance to one of the settings is made
  const config = $('#manageSettingsModal').data('config')

  // Check for any changed data
  if ($('#manageSettingsModalIPInput').val().trim() !== config.ip_address || parseInt($('#manageSettingsModalPortInput').val()) !== config.port) {
    $('#manageSettingsModalSaveButton').show()
    $('#manageSettingsModalRestartRequiredWarning').show()
  } else {
    $('#manageSettingsModalRestartRequiredWarning').hide()
  }
  let staffString
  try {
    staffString = config.assignable_staff.join(', ')
  } catch {
    staffString = ''
  }

  if ($('#manageSettingsModalGalleryNameInput').val().trim() !== config.gallery_name || constTools.stringToBool($('#manageSettingsModalDebugSelect').val()) !== config.debug || $('#manageSettingsModalAssignableStaffInput').val().trim() !== staffString) {
    $('#manageSettingsModalSaveButton').show()
  }

  // Check for a missing IP address
  if ($('#manageSettingsModalIPInput').val() === '' || $('#manageSettingsModalIPInput').val() == null) {
    $('#manageSettingsModalMissingIPWarning').show()
    $('#manageSettingsModalSaveButton').hide()
  } else {
    $('#manageSettingsModalMissingIPWarning').hide()
  }
}

function updateSystemConfigurationFromModal () {
  // Use the manageSettingsModal to update the system configuration

  const update = {
    ip_address: $('#manageSettingsModalIPInput').val().trim(),
    port: parseInt($('#manageSettingsModalPortInput').val()),
    gallery_name: $('#manageSettingsModalGalleryNameInput').val().trim(),
    assignable_staff: $('#manageSettingsModalAssignableStaffInput').val().split(',').map(item => item.trim()),
    debug: constTools.stringToBool($('#manageSettingsModalDebugSelect').val())
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/system/updateConfiguration',
    params: {
      configuration: update
    }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#manageSettingsModal').modal('hide')
      }
    })
}

function createManageDescriptionEntry (entry) {
  // Take a dictionary and turn it into HTML elements

  // Create a new ID used only to track this description through the edit process,
  // even if the actual ID is changed.
  const cleanID = String(new Date().getTime() + Math.round(1000000 * Math.random()))

  const containerCol = document.createElement('div')
  containerCol.classList = 'col-12 mb-3 manageDescriptionEntry'
  containerCol.setAttribute('id', 'manageDescription_' + cleanID)
  $(containerCol).data('config', entry)
  $('#manageDescriptionsList').append(containerCol)

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
  titleCol.setAttribute('id', 'manageDescriptionID_' + cleanID)
  titleCol.style.fontSize = '18px'
  titleCol.style.borderTopLeftRadius = '0.25rem'
  titleCol.style.overflowWrap = 'break-word'
  titleCol.innerHTML = entry.id
  row1.appendChild(titleCol)

  const editCol = document.createElement('div')
  editCol.classList = 'col-3 bg-info text-center handCursor py-1'
  editCol.setAttribute('id', 'manageDescriptionEdit_' + cleanID)
  editCol.style.borderTopRightRadius = '0.25rem'
  editCol.innerHTML = 'Edit'
  $(editCol).click(function () {
    populateManageDescriptionsEdit(cleanID)
  })
  row1.appendChild(editCol)

  const bottomCol = document.createElement('div')
  bottomCol.classList = 'col-12'
  containerRow.appendChild(bottomCol)

  const row2 = document.createElement('div')
  row2.classList = 'row'
  bottomCol.appendChild(row2)

  const descriptionCol = document.createElement('div')
  descriptionCol.classList = 'col-12 bg-secondary py-1 px-1'
  descriptionCol.setAttribute('id', 'manageDescriptionsText_' + cleanID)
  descriptionCol.style.borderBottomLeftRadius = '0.25rem'
  descriptionCol.style.borderBottomRightRadius = '0.25rem'
  descriptionCol.innerHTML = entry.description
  row2.appendChild(descriptionCol)
}

function populateManageDescriptionsEdit (id) {
  // Take a dictionary of details and use it to fill the edit properties fields.

  const details = $('#manageDescription_' + id.replaceAll(' ', '_')).data('config')

  // Tag element with the id to enable updating the config later
  $('#manageDescriptionsEditIDInput').data('id', id)

  $('#manageDescriptionsEditIDInput').val(details.id)
  $('#manageDescriptionsDescriptionEditField').val(details.description)
}

function manageDescriptionsUpdateConfigFromEdit () {
  // Called when a change occurs in an edit field.
  // Update both the HTML and the config itself

  const id = $('#manageDescriptionsEditIDInput').data('id')
  const details = $('#manageDescription_' + id).data('config')
  $('#manageDescriptionsModalSaveButton').show() // Show the save button

  const newID = $('#manageDescriptionsEditIDInput').val()

  $('#manageDescriptionID_' + id).html(newID)
  details.id = newID

  const newDescription = $('#manageDescriptionsDescriptionEditField').val()
  $('#manageDescriptionsText_' + id).html(newDescription)
  details.description = newDescription

  $('#manageDescription_' + id).data('config', details)
}

function manageDescriptionsDeleteDescriptionEntry () {
  // Called when the "Delete description" button is clicked.
  // Remove the HTML entry from the listing

  const id = $('#manageDescriptionsEditIDInput').data('id')
  $('#manageDescriptionsModalSaveButton').show() // Show the save button
  $('#manageDescription_' + id).remove()

  // Clear the input fields
  $('#manageDescriptionsEditIDInput').val(null)
  $('#manageDescriptionsDescriptionEditField').val(null)
}

function showManageDescriptionsModal () {
  // Show the modal for managing component descriptions.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/system/descriptions/getConfiguration'
  })
    .then((result) => {
      populateManageDescriptionsModal(result.configuration)
    })

  // Clear the input fields
  $('#manageDescriptionsEditIDInput').val(null)
  $('#manageDescriptionsDescriptionEditField').val(null)
  $('#manageDescriptionsModalSaveButton').hide()

  $('#manageDescriptionsModal').modal('show')
}

function populateManageDescriptionsModal (list) {
  // Take a list of configuration entries and populate the modal.

  $('#manageDescriptionsList').empty()
  list.forEach((entry) => {
    createManageDescriptionEntry(entry)
  })
}

function updateDescriptionsConfigurationFromModal () {
  // Collect the dictionary from each description element and send it to Control Server to save.

  const entries = $('.manageDescriptionEntry')
  const listToSend = []
  entries.each((i, entry) => {
    listToSend.push($(entry).data('config'))
  })

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/system/descriptions/updateConfiguration',
    params: { configuration: listToSend }
  })
    .then((result) => {
      $('#manageDescriptionsModal').modal('hide')
    })
}

function loadVersion () {
  // Load version.txt and update the GUI with the current version

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/version.txt',
    rawResponse: true
  })
    .then((response) => {
      $('#versionSpan').html(response)
    })
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
document.getElementById('componentStatusModeRealtimeCheckbox').addEventListener('change', constExhibit.rebuildComponentInterface)
Array.from(document.getElementsByClassName('view-mode-radio')).forEach((el) => {
  el.addEventListener('change', () => {
    // Modify the search params to soft-save the change
    const urlParams = new URLSearchParams(window.location.search)

    if (document.getElementById('componentStatusModeRealtimeCheckbox').checked === true) {
      // Set real-time mode (default)
      urlParams.delete('showMaintStatus')
    } else {
      // Set maintenance status mode
      urlParams.set('showMaintStatus', 'true')
    }
    window.history.replaceState('', '', '?' + urlParams)

    // Rebuild the interface with the new option
    constExhibit.rebuildComponentInterface()
  })
})

document.getElementById('showAddStaticComponentModalButton').addEventListener('click', constExhibit.showAddStaticComponentsModal)
document.getElementById('addStaticComponentModalAddButton').addEventListener('click', constExhibit.submitStaticComponentAdditionFromModal)
document.getElementById('showAddProjetorModalButton').addEventListener('click', constProjector.showAddProjectorModal)
document.getElementById('addProjectorModalAddButton').addEventListener('click', constProjector.submitProjectorAdditionFromModal)
document.getElementById('showAddWakeOnLANModalButton').addEventListener('click', constExhibit.showAddWakeOnLANModal)
document.getElementById('addWakeOnLANModalAddButton').addEventListener('click', constExhibit.submitWakeOnLANAdditionFromModal)

// Component info modal
$('#componentInfoModalRemoveComponentButton').click(constExhibit.removeExhibitComponentFromModal)
$('#componentInfoModalMaintenanceSaveButton').click(function () {
  constMaintenance.submitComponentMaintenanceStatusChange('component')
})
$('#componentInfoModalMaintenanceStatusSelector').change(function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})
$('#componentInfoModalSettingsAutoplayAudio').change(function () {
  constExhibit.toggleExhibitComponentInfoSettingWarnings()
})
$('#componentInfoModalSettingsAllowShutdown').change(function () {
  constExhibit.toggleExhibitComponentInfoSettingWarnings()
})
$('.componentInfoSetting').change(function () {
  $('#componentInfoModalSettingsSaveButton').show()
})
$('#componentInfoModalSettingsSaveButton').click(constExhibit.submitComponentSettingsChange)
document.getElementById('definitionTabAppFilterSelect').addEventListener('change', (event) => {
  constExhibit.filterDefinitionListByApp()
})
document.getElementById('definitionTabThumbnailsCheckbox').addEventListener('change', (event) => {
  constExhibit.onDefinitionTabThumbnailsCheckboxChange()
})
$('#componentInfoModalDefinitionSaveButton').click(constExhibit.submitDefinitionSelectionFromModal)
document.getElementById('componentInfoModalViewScreenshot').addEventListener('click', () => {
  const component = constExhibit.getExhibitComponent($('#componentInfoModal').data('id'))
  constTools.openMediaInNewTab([component.getHelperURL() + '/system/getScreenshot'], ['image'])
})
document.getElementById('componentInfoModalEditDMXButton').addEventListener('click', (event) => {
  const component = constExhibit.getExhibitComponent($('#componentInfoModal').data('id'))
  window.open(component.getHelperURL() + '/dmx_control.html?standalone=true', '_blank').focus()
})
// Schedule tab
// =========================
document.getElementById('manageFutureDateButton').addEventListener('click', constSchedule.showManageFutureDateModal)
document.getElementById('manageFutureDateCalendarInput').addEventListener('change', constSchedule.populateFutureDateCalendarInput)
document.getElementById('manageFutureDateAddActionButton').addEventListener('click', (event) => {
  const scheduleName = document.getElementById('manageFutureDateCalendarInput').value
  constSchedule.scheduleConfigureEditModal(scheduleName, 'date-specific')
})
document.getElementById('manageFutureDateCreateScheduleButton').addEventListener('click', constSchedule.convertFutureScheduleFromModal)
document.getElementById('manageFutureDateDeleteScheduleButton').addEventListener('click', (event) => {
  event.target.focus()
})
$('#scheduleEditDeleteActionButton').click(constSchedule.scheduleDeleteActionFromModal)
$('#scheduleEditSubmitButton').click(constSchedule.sendScheduleUpdateFromModal)
$('#scheduleActionSelector').change(constSchedule.setScheduleActionTargetSelector)
$('#scheduleTargetSelector').change(constSchedule.setScheduleActionValueSelector)
// This event detects when the delete button has been clicked inside a popover to delete a date-specific schedule.
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('schedule-delete') === false) return
  if ($('#manageFutureDateModal').hasClass('show')) {
    // This popover is from the future dates edit modal
    constSchedule.deleteSchedule(document.getElementById('manageFutureDateCalendarInput').value)
  } else {
    // This popover is from the main schedule page
    constSchedule.deleteSchedule(event.target.getAttribute('id').slice(7))
  }
})

// Issues tab
// =========================
// This event detects when the delete button has been clicked inside a popover
document.addEventListener('click', (event) => {
  if (event.target.getAttribute('id') === 'issueMediaDeleteButtonConfirmation') {
    const file = document.getElementById('issueMediaViewFromModalSelect').value
    constIssues.issueMediaDelete([file])
  }
})
document.getElementById('issueModifyModalDeleteButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  constIssues.modifyIssue(id, 'delete')
  $('#issueModifyModal').modal('hide')
})
document.getElementById('issueModifyModalArchiveButton').addEventListener('click', () => {
  const id = document.getElementById('issueModifyModal').getAttribute('data-id')
  constIssues.modifyIssue(id, 'archive')
  $('#issueModifyModal').modal('hide')
})
$('#issueMediaViewFromModal').click(function () {
  const file = document.getElementById('issueMediaViewFromModalSelect').value
  constTools.openMediaInNewTab(['issues/media/' + file])
})
$('#issueMediaUploadSubmitButton').click(constIssues.uploadIssueMediaFile)
$('#issueMediaUpload').change(constIssues.onIssueMediaUploadChange)
$('#issueEditSubmitButton').click(constIssues.submitIssueFromModal)
$('#createIssueButton').click(function () {
  constIssues.showIssueEditModal('new')
})
document.getElementById('viewIssueArchiveButton').addEventListener('click', () => {
  constIssues.showArchivedIssuesModal()
})
$('#issueListFilterPrioritySelect').change(function () {
  constIssues.rebuildIssueList()
})
$('#issueListFilterAssignedToSelect').change(function () {
  constIssues.rebuildIssueList()
})
$('#componentInfoModalMaintenanceNote').on('input', function () {
  $('#componentInfoModalMaintenanceSaveButton').show()
})

// Analytics tab
// =========================
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
$('#downloadTrackerDataButton').click(function () {
  constTracker.downloadTrackerData($('#trackerDataSelect').val())
})
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

// Settings tab
// =========================
// Exhibits
document.getElementById('manageExhibitsButton').addEventListener('click', showManageExhibitsModal)
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
$('#exhibitDeleteSelectorButton').click(showExhibitDeleteModal)
document.getElementById('manageExhibitModalExhibitThumbnailCheckbox').addEventListener('change', onManageExhibitModalThumbnailCheckboxChange)
// Server settings
$('#showManageSettingsModalButton').click(showManageSettingsModal)
$('.manageSettingsInputField').on('input', updateManageSettingsModal).change(updateManageSettingsModal)
$('#manageSettingsModalSaveButton').click(updateSystemConfigurationFromModal)
// Projectors
$('#showManageProjectorsModalButton').click(constProjector.showManageProjectorsModal)
$('#manageProjectorAddBUtton').click(function () {
  constProjector.createManageProjectorEntry({
    id: 'New Projector',
    ip_address: '',
    protocol: 'pjlink'
  })
  $('#manageProjectorsModalSaveButton').show() // Show the save button
})
$('.manageProjectorEditField').change(constProjector.manageProjectorUpdateConfigFromEdit)
$('.manageProjectorEditField').on('input', constProjector.manageProjectorUpdateConfigFromEdit)
$('#manageProjectorDeleteButton').click(constProjector.manageProjectorDeleteProjectorEntry)
$('#manageProjectorsModalSaveButton').click(constProjector.updateProjectorConfigurationFromModal)
// Descriptions
$('#showComponentDescriptionEditModalButton').click(showManageDescriptionsModal)
$('#manageDescriptionsAddBUtton').click(function () {
  createManageDescriptionEntry({
    id: 'New Description',
    description: ''
  })
  $('#manageDescriptionsModalSaveButton').show() // Show the save button
})
$('.manageDescriptionsEditField').on('input', manageDescriptionsUpdateConfigFromEdit).change(manageDescriptionsUpdateConfigFromEdit)
$('#manageDescriptionsDeleteButton').click(manageDescriptionsDeleteDescriptionEntry)
$('#manageDescriptionsModalSaveButton').click(updateDescriptionsConfigurationFromModal)
// Wake on LAN
$('#showWakeOnLANEditModalButton').click(constExhibit.showManageWakeOnLANModal)
$('#manageWakeOnLANAddBUtton').click(function () {
  constExhibit.createManageWakeOnLANEntry({
    id: 'New Device',
    ip_address: '',
    mac_address: ''
  })
  $('#manageWakeOnLANModalSaveButton').show() // Show the save button
})
$('.manageWakeOnLANEditField').on('input', constExhibit.manageWakeOnLANUpdateConfigFromEdit).change(constExhibit.manageWakeOnLANUpdateConfigFromEdit)
$('#manageWakeOnLANDeleteButton').click(constExhibit.manageWakeOnLANDeleteWakeOnLANEntry)
$('#manageWakeOnLANModalSaveButton').click(constExhibit.updateWakeOnLANConfigurationFromModal)
// Static components
$('#showStaticComponentsEditModalButton').click(constExhibit.showManageStaticComponentsModal)
$('#manageStaticComponentsAddBUtton').click(function () {
  constExhibit.createManageStaticComponentsEntry({
    id: 'New component',
    group: 'STATIC'
  })
  $('#manageStaticComponentsModalSaveButton').show() // Show the save button
})
$('.manageStaticComponentsEditField').on('input', constExhibit.manageStaticComponentsUpdateConfigFromEdit).change(constExhibit.manageStaticComponentsUpdateConfigFromEdit)
$('#manageStaticComponentsDeleteButton').click(constExhibit.manageStaticComponentsDeleteComponentEntry)
$('#manageStaticComponentsModalSaveButton').click(constExhibit.updateStaticComponentsConfigurationFromModal)

// Activate all popovers
$(function () {
  $('[data-bs-toggle="popover"]').popover()
})

// Enable all tooltips
const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]')
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl))

constConfig.serverAddress = location.origin

// Subscribe to updates from the control server
const eventSource = new EventSource(constConfig.serverAddress + '/system/updateStream')
eventSource.addEventListener('update', function (event) {
  const update = JSON.parse(event.data)
  parseUpdate(update)
})
eventSource.addEventListener('end', function (event) {
  console.log('Handling end....')
  eventSource.close()
})

// Set color mode
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.querySelector('html').setAttribute('data-bs-theme', 'dark')
} else {
  document.querySelector('html').setAttribute('data-bs-theme', 'light')
}

loadVersion()
populateHelpTab()
parseQueryString()
constTracker.getAvailableDefinitions(populateTrackerTemplateSelect)
