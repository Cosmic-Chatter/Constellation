import constConfig from './config.js'

export function setComponentInfoModalMaintenanceStatus (id) {
  // Ask the server for the current maintenance status of the given component
  // and then update the componentInfoModal with that info

  const requestDict = { id }

  const xhr = new XMLHttpRequest()
  xhr.timeout = 2000
  xhr.open('POST', constConfig.serverAddress + '/maintenance/getStatus', true)
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      if (this.responseText !== '') {
        const result = JSON.parse(this.responseText)
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
      }
    }
  }
  xhr.send(JSON.stringify(requestDict))
}
