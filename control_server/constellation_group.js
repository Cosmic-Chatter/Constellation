import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function showEditGroupModal (uuid = '') {
  // Show the modal for creatng or editing a group

  document.getElementById('editGroupModal').setAttribute('data-uuid', uuid)
  document.getElementById('editGroupModalNameWarning').style.display = 'none'

  if (uuid !== '') {
    // We are editing a group
    document.getElementById('editGroupModalTitle').innerHTML = 'Edit group'
    document.getElementById('editGroupModalSubmitButton').innerHTML = 'Save'

    constTools.makeServerRequest({
      method: 'GET',
      endpoint: 'group/' + uuid + '/getDetails'
    })
      .then((response) => {
        if (response.success === true) {
          document.getElementById('editGroupModalNameInput').value = response.details.name
          document.getElementById('editGroupModalDescriptionInput').value = response.details.description
        }
        $('#editGroupModal').modal('show')
      })
  } else {
    // Creating a new group
    document.getElementById('editGroupModalTitle').innerHTML = 'Create a group'
    document.getElementById('editGroupModalSubmitButton').innerHTML = 'Create'

    $('#editGroupModal').modal('show')
  }
}

export function submitChangeFromGroupEditModal () {
  // Collect details from the group edit modal and submit them to the server

  const uuid = document.getElementById('editGroupModal').getAttribute('data-uuid')
  const name = document.getElementById('editGroupModalNameInput').value.trim()
  const description = document.getElementById('editGroupModalDescriptionInput').value.trim()

  if (name === '') {
    document.getElementById('editGroupModalNameWarning').style.display = 'block'
    return
  }

  if (uuid === '') {
    // Create new group
    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/group/create',
      params: {
        name, description
      }
    })
      .then(() => {
        $('#editGroupModal').modal('hide')
      })
  } else {
    // Edit group
  }
}

export function populateGroupsRow () {
  // Take the list of groups and build an HTML representation of them.

}
