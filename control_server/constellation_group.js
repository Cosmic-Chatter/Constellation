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
      endpoint: '/group/' + uuid + '/getDetails'
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

    document.getElementById('editGroupModalNameInput').value = ''
    document.getElementById('editGroupModalDescriptionInput').value = ''

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
    constTools.makeServerRequest({
      method: 'POST',
      endpoint: '/group/' + uuid + '/edit',
      params: {
        name, description
      }
    })
      .then(() => {
        $('#editGroupModal').modal('hide')
      })
  }
}

export function populateGroupsRow () {
  // Take the list of groups and build an HTML representation of them.

  const groupRow = document.getElementById('settingsGroupsRow')
  groupRow.innerHTML = ''

  for (const group of constConfig.groups) {
    const groupCol = document.createElement('div')
    groupCol.classList = 'col'
    groupRow.appendChild(groupCol)

    const row = document.createElement('div')
    row.classList = 'row'
    groupCol.appendChild(row)

    const titleCol = document.createElement('div')
    titleCol.classList = 'col-12'
    row.appendChild(titleCol)

    const btnGroup = document.createElement('div')
    btnGroup.classList = 'btn-group w-100'
    titleCol.appendChild(btnGroup)

    const name = document.createElement('button')
    name.classList = 'btn btn-primary w-75'
    name.addEventListener('click', () => {
      showEditGroupModal(group.uuid)
    })
    name.style.fontSize = '18px'
    name.innerHTML = group.name
    btnGroup.appendChild(name)

    const dropdownBtn = document.createElement('button')
    dropdownBtn.classList = 'btn btn-primary dropdown-toggle dropdown-toggle-split'
    dropdownBtn.setAttribute('data-bs-toggle', 'dropdown')
    dropdownBtn.setAttribute('aria-haspopup', 'true')
    dropdownBtn.setAttribute('aria-expanded', 'false')
    dropdownBtn.innerHTML = '<span class="visually-hidden">Toggle Dropdown</span>'
    btnGroup.appendChild(dropdownBtn)

    const dropdownMenu = document.createElement('div')
    dropdownMenu.classList = 'dropdown-menu'
    btnGroup.appendChild(dropdownMenu)

    const editButton = document.createElement('button')
    editButton.classList = 'dropdown-item text-info'
    editButton.innerHTML = 'Edit'
    editButton.addEventListener('click', () => {
      showEditGroupModal(group.uuid)
    })
    dropdownMenu.appendChild(editButton)

    const deleteButton = document.createElement('button')
    deleteButton.classList = 'dropdown-item text-danger'
    deleteButton.innerHTML = 'Delete'
    deleteButton.addEventListener('click', () => {
      document.getElementById('deleteGroupModal').setAttribute('data-uuid', group.uuid)
      $('#deleteGroupModal').modal('show')
    })
    dropdownMenu.appendChild(deleteButton)

    if (group.description !== '') {
      // Adjust the rounding on the name row to make room for the description
      name.style.borderBottomLeftRadius = '0'
      dropdownBtn.style.borderBottomRightRadius = '0'

      const descCol = document.createElement('div')
      titleCol.classList = 'col-12'
      row.appendChild(descCol)

      const description = document.createElement('div')
      description.classList = 'bg-secondary rounded-bottom text-white px-2 py-2'
      description.innerHTML = group.description
      descCol.appendChild(description)
    }
  }
}

export function deleteGroupFromModal () {
  // Delete the group for the displayed confirmation modal

  const uuid = document.getElementById('deleteGroupModal').getAttribute('data-uuid')

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/group/' + uuid + '/delete'
  })
    .then(() => {
      $('#deleteGroupModal').modal('hide')
    })
}
