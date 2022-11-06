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
