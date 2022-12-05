import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function setComponentInfoModalMaintenanceStatus (id) {
  // Ask the server for the current maintenance status of the given component
  // and then update the componentInfoModal with that info

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/getStatus',
    params: { id }
  })
    .then((result) => {
      if ('status' in result && 'notes' in result) {
        $('#componentInfoModalMaintenanceStatusSelector').val(result.status)
        $('#componentInfoModalMaintenanceNote').val(result.notes)
        $('#maintenanceHistoryWorkingBar').attr('ariaValueNow', result.working_pct)
        $('#maintenanceHistoryWorkingBar').width(String(result.working_pct) + '%')
        $('#maintenanceHistoryWorkingBar').attr('title', 'Working: ' + String(result.working_pct) + '%')
        $('#maintenanceHistoryNotWorkingBar').attr('ariaValueNow', result.not_working_pct)
        $('#maintenanceHistoryNotWorkingBar').width(String(result.not_working_pct) + '%')
        $('#maintenanceHistoryNotWorkingBar').attr('title', 'Not working: ' + String(result.not_working_pct) + '%')
        $('#componentInfoModalMaintenanceSaveButton').hide()
      }
    })
}

export function submitComponentMaintenanceStatusChange (type = 'component') {
  // Take details from the maintenance tab of the componentInfoModal and send
  // a message to the server updating the given component.

  let id, status, notes
  if (type === 'component') {
    id = $('#componentInfoModalTitle').html()
    status = $('#componentInfoModalMaintenanceStatusSelector').val()
    notes = $('#componentInfoModalMaintenanceNote').val()
  }

  const requestDict = {
    id,
    status,
    notes
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/maintenance/updateStatus',
    params: requestDict
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        $('#componentInfoModalMaintenanceSaveButton').hide()
      }
    })
}

export function refreshMaintenanceRecords () {
  // Ask the server to send all the maintenance records and then rebuild the
  // maintanence overview from those data.

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/maintenance/getAllStatuses'
  })
    .then((result) => {
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
    })
}
