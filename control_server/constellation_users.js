import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function showEditUserModal (user = null) {
  // Show the modal for creating a new user account.

  if (user == null) {
    // We are creating a new user.
    configureEditUserModalForNewUser()
  } else {
    // We are editing an existing user.
    configureEditUserModalForExistingUser(user)
  }

  document.getElementById('editUserBlankUsername').style.display = 'none'
  document.getElementById('editUserBlankDisplayname').style.display = 'none'
  document.getElementById('editUserPasswordMismatch').style.display = 'none'
  document.getElementById('editUserBlankPassword').style.display = 'none'
  document.getElementById('editUserUsernameExists').style.display = 'none'

  document.getElementById('editUserSubmitButton').style.display = 'none'
  $('#editUserModal').modal('show')
}

function configureEditUserModalForNewUser () {
  // Set up the editUser modal for a new user.

  document.getElementById('editUserModal').setAttribute('data-uuid', '')
  document.getElementById('editUserModalTitle').innerHTML = 'Create a user'
  document.getElementById('editUserSubmitButton').innerHTML = 'Create'

  document.getElementById('editUserUsernameInput').value = ''
  document.getElementById('editUserDisplayNameInput').value = ''

  // Permissions
  document.getElementById('editUserPermissionAnalytics').value = 'none'
  document.getElementById('editUserPermissionExhibits').value = 'none'
  document.getElementById('editUserPermissionMaintenance').value = 'none'
  document.getElementById('editUserPermissionSchedule').value = 'none'
  document.getElementById('editUserPermissionSettings').value = 'none'
  document.getElementById('editUserPermissionUsers').value = 'none'
  document.getElementById('editUserPermissionGroups').value = 'none'
  document.getElementById('editUserGroupsRow').style.display = 'none'
  populateEditUserGroupsRow({ edit: [], view: [] })
}

function configureEditUserModalForExistingUser (user) {
  // Set up the editUser modal for editing an existing user.

  document.getElementById('editUserModal').setAttribute('data-uuid', user.uuid)
  document.getElementById('editUserModalTitle').innerHTML = 'Edit user'
  document.getElementById('editUserSubmitButton').innerHTML = 'Save'

  document.getElementById('editUserUsernameInput').value = user.username
  document.getElementById('editUserDisplayNameInput').value = user.display_name

  // Permissions
  document.getElementById('editUserPermissionAnalytics').value = user.permissions.analytics
  document.getElementById('editUserPermissionExhibits').value = user.permissions.exhibits
  document.getElementById('editUserPermissionMaintenance').value = user.permissions.maintenance
  document.getElementById('editUserPermissionSchedule').value = user.permissions.schedule
  document.getElementById('editUserPermissionSettings').value = user.permissions.settings
  document.getElementById('editUserPermissionUsers').value = user.permissions.users

  if (user.permissions.components.edit.includes('__all')) {
    document.getElementById('editUserPermissionGroups').value = 'edit'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else if (user.permissions.components.view.includes('__all')) {
    document.getElementById('editUserPermissionGroups').value = 'view'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else if (user.permissions.components.edit.length === 0 && user.permissions.components.view.length === 0) {
    document.getElementById('editUserPermissionGroups').value = 'none'
    document.getElementById('editUserGroupsRow').style.display = 'none'
  } else {
    document.getElementById('editUserPermissionGroups').value = 'custom'
    document.getElementById('editUserGroupsRow').style.display = 'flex'
  }

  populateEditUserGroupsRow(user.permissions.components)
}

function populateEditUserGroupsRow (permissions) {
  // Create an entry for each group and configure any existing permissions.
  // 'permissions' should be of the form: {edit: ['group1',...], view: ['group2',...]}

  const row = document.getElementById('editUserGroupsRow')
  row.innerHTML = ''

  for (const group of constConfig.groups) {
    const col = document.createElement('div')
    col.classList = 'col'
    row.appendChild(col)

    const label = document.createElement('label')
    label.classList = 'form-label fst-italic'
    label.innerHTML = group.name
    col.appendChild(label)

    const select = document.createElement('select')
    select.classList = 'form-select'
    select.addEventListener('change', () => {
      document.getElementById('editUserSubmitButton').style.display = 'block'
    })
    col.appendChild(select)

    const optionNone = new Option('None', 'none')
    select.appendChild(optionNone)
    const optionView = new Option('View', 'view')
    select.appendChild(optionView)
    const optionEdit = new Option('Edit', 'edit')
    select.appendChild(optionEdit)

    if (permissions.edit.includes(group.uuid)) {
      select.value = 'edit'
    } else if (permissions.view.includes(group.uuid)) {
      select.value = 'view'
    } else select.value = 'none'
  }
}

export function submitChangeFromEditUserModal () {
  // Collect the necessary details and submit a new or edited user.

  const uuid = document.getElementById('editUserModal').getAttribute('data-uuid')

  const details = {
    username: document.getElementById('editUserUsernameInput').value.trim(),
    display_name: document.getElementById('editUserDisplayNameInput').value.trim(),
    permissions: {
      analytics: document.getElementById('editUserPermissionAnalytics').value,
      exhibits: document.getElementById('editUserPermissionExhibits').value,
      maintenance: document.getElementById('editUserPermissionMaintenance').value,
      schedule: document.getElementById('editUserPermissionSchedule').value,
      settings: document.getElementById('editUserPermissionSettings').value,
      users: document.getElementById('editUserPermissionUsers').value
    }
  }
  const groupsPermission = document.getElementById('editUserPermissionGroups').value
  if (groupsPermission === 'none') {
    details.permissions.components = { edit: [], view: [] }
  } else if (groupsPermission === 'view') {
    details.permissions.components = { edit: [], view: ['__all'] }
  } else if (groupsPermission === 'edit') {
    details.permissions.components = { edit: ['__all'], view: [] }
  } else {
    // Custom
  }

  if (details.username === '') {
    document.getElementById('editUserBlankUsername').style.display = 'block'
    return
  }
  if (details.display_name === '') {
    document.getElementById('editUserBlankDisplayname').style.display = 'block'
    return
  }
  const password1 = document.getElementById('editUserPassword1Input').value
  const password2 = document.getElementById('editUserPassword2Input').value

  if (password1 !== password2) {
    document.getElementById('editUserPasswordMismatch').style.display = 'block'
    return
  }

  if (uuid === '') {
    // Creating a new user

    if (password1 === '') {
      document.getElementById('editUserBlankPassword').style.display = 'block'
      return
    }
  } else {
    // Editing an existing user
  }
  document.getElementById('editUserUsernameExists').style.display = 'none'
}

export function populateUsers () {
  // Retrieve a list of current users and create a representation of each.

  const usersRow = document.getElementById('usersRow')

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/users/list'
  }).then((response) => {
    for (const user of response.users) {
      const col = document.createElement('div')
      col.classList = 'col'
      usersRow.appendChild(col)

      const button = document.createElement('button')
      button.classList = 'btn btn-secondary w-100'
      button.innerHTML = user.display_name
      button.addEventListener('click', () => {
        showEditUserModal(user)
      })
      col.appendChild(button)
    }
  })
}

export function loginFromDropdown () {
  // Collect the username and password and attempt to log in the user.

  const username = document.getElementById('loginDropdownUsername').value.trim().toLowerCase()
  const password = document.getElementById('loginDropdownPassword').value

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login',
    params: {
      credentials: [username, password]
    }
  })
    .then((response) => {
      if (response.success === true) {
        // configureUser(response.user)
        // Reload the page now that the authentication cookie is set.
        location.reload()
      }
    })
}

export function authenticateUser () {
  // If authToken exists in the cookie, use it to log in

  let token = ''
  document.cookie.split(';').forEach((item) => {
    item = item.trim()
    if (item.startsWith('authToken="')) {
      token = item.slice(11, -1)
    }
  })

  if (token === '') {
    token = 'This will fail' // Token cannot be an empty string
    configureUser({}, false)
  }

  return constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/user/login'
  })
    .then((response) => {
      if (response.success === true) {
        configureUser(response.user)
      }
    })
}

function configureUser (userDict, login = true) {
  // Take a dictionary of user details and set up Constellation to reflect it.
  // set login=false to set up a logged out user

  constConfig.user = userDict

  if (login) {
    document.getElementById('loginMenu').style.display = 'none'
    document.getElementById('userMenu').style.display = 'block'

    // Set the name of the account
    document.getElementById('userMenuUserDisplayName').innerHTML = userDict.display_name
    let initials = ''
    userDict.display_name.split(' ').forEach((word) => {
      initials += word.slice(0, 1)
    })
    document.getElementById('userMenuUserShortName').innerHTML = initials
  } else {
    document.getElementById('loginMenu').style.display = 'block'
    document.getElementById('userMenu').style.display = 'none'
  }

  if (constTools.checkPermission('schedule', 'view')) {
    document.getElementById('nav-schedule-tab').style.display = 'block'
    configureSchedulePermissions()
  } else {
    document.getElementById('nav-schedule-tab').style.setProperty('display', 'none', 'important')
  }

  if (constTools.checkPermission('exhibits', 'view')) {
    document.getElementById('nav-exhibits-tab').style.display = 'block'
    document.getElementById('nav-exhibits-dropdown-tab').style.display = 'block'
  } else {
    document.getElementById('nav-exhibits-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-exhibits-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (constTools.checkPermission('maintenance', 'view')) {
    document.getElementById('nav-issues-tab').style.display = 'block'
    document.getElementById('nav-issues-dropdown-tab').style.display = 'block'
    configureMaintenancePermissions()
  } else {
    document.getElementById('nav-issues-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-issues-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (constTools.checkPermission('analytics', 'view')) {
    document.getElementById('nav-analytics-tab').style.display = 'block'
    document.getElementById('nav-analytics-dropdown-tab').style.display = 'block'
  } else {
    document.getElementById('nav-analytics-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-analytics-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (constTools.checkPermission('settings', 'view')) {
    document.getElementById('nav-settings-tab').style.display = 'block'
    document.getElementById('nav-settings-dropdown-tab').style.display = 'block'
  } else {
    document.getElementById('nav-settings-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-settings-dropdown-tab').style.setProperty('display', 'none', 'important')
  }

  if (constTools.checkPermission('users', 'view')) {
    document.getElementById('nav-users-tab').style.display = 'block'
    document.getElementById('nav-users-dropdown-tab').style.display = 'block'
  } else {
    document.getElementById('nav-users-tab').style.setProperty('display', 'none', 'important')
    document.getElementById('nav-users-dropdown-tab').style.setProperty('display', 'none', 'important')
  }
}

export function logoutUser () {
  // Remove the user and delete the cookie.

  document.cookie = 'authToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC;'
  location.reload()
}

function configureSchedulePermissions () {
  // Configure the schedule to respect the level of user permission.

  if (constTools.checkPermission('schedule', 'edit')) {
    // User may edit
  } else {
    // User may view only
  }
}

function configureMaintenancePermissions () {
  // Configure the maintenance tab to respect the level of user permission.

  const createIssueButtonCol = document.getElementById('createIssueButton').parentNode
  if (constTools.checkPermission('maintenance', 'edit')) {
    // User may edit
    createIssueButtonCol.style.setProperty('display', 'block')
  } else {
    // User may view only
    createIssueButtonCol.style.setProperty('display', 'none', 'important')
  }
}
