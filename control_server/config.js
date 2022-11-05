export default {
  componentGroups: [],
  currentExhibit: '',
  errorDict: {},
  exhibitComponents: [],
  serverAddress: '',
  serverSoftwareUpdateAvailable: false,
  STATUS: {
    STATIC: { name: 'STATIC', value: 0, colorClass: 'btn-secondary' },
    ACTIVE: { name: 'ACTIVE', value: 1, colorClass: 'btn-primary' },
    ONLINE: { name: 'ONLINE', value: 1, colorClass: 'btn-success' },
    STANDBY: { name: 'STANDBY', value: 2, colorClass: 'btn-info' },
    WAITING: { name: 'WAITING', value: 3, colorClass: 'btn-warning' },
    'SYSTEM ON': { name: 'SYSTEM ON', value: 4, colorClass: 'btn-info' },
    UNKNOWN: { name: 'UNKNOWN', value: 5, colorClass: 'btn-warning' },
    OFFLINE: { name: 'OFFLINE', value: 6, colorClass: 'btn-danger' }
  }
}
