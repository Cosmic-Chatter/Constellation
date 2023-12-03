import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function showCreateAccountModal () {
  // Show the modal for creating a new user account.

  $('#createAccountModal').modal('show')
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
