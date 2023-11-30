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
      console.log(response)
    })
}
