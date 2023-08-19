import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function rebuildIssueList () {
  // Take an array of issue dictionaries and build the GUI representation.

  // Gather the settings for the various filters
  const filterPriority = $('#issueListFilterPrioritySelect').val()
  const filterAssignedTo = $('#issueListFilterAssignedToSelect').val()

  $('#issuesRow').empty()

  constConfig.issueList.forEach((issue, i) => {
    // Check against the filters
    if (filterPriority !== 'all' && filterPriority !== issue.priority && filterPriority != null) {
      return
    }
    if (
      (filterAssignedTo != null && filterAssignedTo !== 'all' && filterAssignedTo !== 'unassigned' && !issue.assignedTo.includes(filterAssignedTo)) ||
      (filterAssignedTo === 'unassigned' && issue.assignedTo.length > 0)
    ) return
    const col = document.createElement('div')
    col.setAttribute('class', 'col-12 col-sm-6 col-lg-4 mt-2')

    const card = document.createElement('div')
    // Color the border based on the priority
    let borderColor
    if (issue.priority === 'low') {
      borderColor = 'border-primary'
    } else if (issue.priority === 'medium') {
      borderColor = 'border-warning'
    } else {
      borderColor = 'border-danger'
    }
    card.setAttribute('class', `card h-100 border ${borderColor}`)
    col.appendChild(card)

    const body = document.createElement('div')
    body.setAttribute('class', 'card-body')
    card.appendChild(body)

    const title = document.createElement('H5')
    title.setAttribute('class', 'card-title')
    title.innerHTML = issue.issueName
    body.appendChild(title)

    issue.relatedComponentIDs.forEach((id, i) => {
      const tag = document.createElement('span')
      tag.setAttribute('class', 'badge badge-secondary mr-1')
      tag.innerHTML = id
      body.appendChild(tag)
    })

    issue.assignedTo.forEach((name, i) => {
      const tag = document.createElement('span')
      tag.setAttribute('class', 'badge badge-success mr-1')
      tag.innerHTML = name
      body.appendChild(tag)
    })

    const desc = document.createElement('p')
    desc.setAttribute('class', 'card-text')
    desc.style.whiteSpace = 'pre-wrap' // To preserve new lines
    desc.innerHTML = issue.issueDescription
    body.appendChild(desc)

    if (issue.media != null) {
      const mediaBut = document.createElement('button')
      mediaBut.setAttribute('class', 'btn btn-primary mr-1 mt-1')
      mediaBut.innerHTML = 'View image'
      mediaBut.addEventListener('click', function () {
        constTools.openMediaInNewTab('issues/media/' + issue.media)
      }, false)
      body.appendChild(mediaBut)
    }

    const editBut = document.createElement('button')
    editBut.setAttribute('class', 'btn btn-info mr-1 mt-1')
    editBut.innerHTML = 'Edit'
    editBut.addEventListener('click', function () {
      showIssueEditModal('edit', issue.id)
    })
    body.appendChild(editBut)

    const deleteBut = document.createElement('button')
    deleteBut.setAttribute('type', 'button')
    deleteBut.setAttribute('class', 'btn btn-danger mt-1')
    deleteBut.setAttribute('data-toggle', 'popover')
    deleteBut.setAttribute('title', 'Are you sure?')
    deleteBut.setAttribute('data-content', `<a id="Popover${issue.id}" class='btn btn-danger w-100 issue-delete'>Confirm</a>`)
    deleteBut.setAttribute('data-trigger', 'focus')
    deleteBut.setAttribute('data-html', 'true')
    // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
    deleteBut.addEventListener('click', function () { deleteBut.focus() })
    deleteBut.innerHTML = 'Delete'
    body.appendChild(deleteBut)
    $(deleteBut).popover()

    $('#issuesRow').append(col)
  })
}

export function deleteIssue (id) {
  // Ask the control server to remove the specified issue

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/issue/delete',
    params: { id_to_delete: id }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        getIssueList()
      }
    })
}

function getIssueList () {
  // Get a list of all the current issues and rebuild the issue GUI

  constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list'
  })
    .then((response) => {
      if ('success' in response) {
        if (response.success === true) {
          rebuildIssueList(response.issueList)
        } else {
          console.log('Error retrieving issueList: ', response.reason)
        }
      }
    })
}

function getIssue (id) {
  // Function to search the issueList for a given id

  const result = constConfig.issueList.find(obj => {
    return obj.id === id
  })

  return result
}

export function showIssueEditModal (issueType, target) {
  // Show the modal and configure for either "new" or "edit"

  // Make sure we have all the current components listed as objections for
  // the issueRelatedComponentsSelector
  for (let i = 0; i < constConfig.exhibitComponents.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueRelatedComponentsSelector option[value='${constConfig.exhibitComponents[i].id}']`).length === 0) {
      $('#issueRelatedComponentsSelector').append(new Option(constConfig.exhibitComponents[i].id, constConfig.exhibitComponents[i].id))
    }
  }

  // Make sure we have all the assignable staff listed as options for
  // issueAssignedToSelector
  for (let i = 0; i < constConfig.assignableStaff.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueAssignedToSelector option[value='${constConfig.assignableStaff[i]}']`).length === 0) {
      $('#issueAssignedToSelector').append(new Option(constConfig.assignableStaff[i], constConfig.assignableStaff[i]))
    }
  }

  // Clear file upload interface elements
  $('#issueMediaUploadFilename').html('Choose file')
  $('#issueMediaUploadEqualSignWarning').hide()
  $('#issueMediaUploadHEICWarning').hide()
  $('#issueMediaUploadSubmitButton').hide()
  $('#issueMediaUploadProgressBarContainer').hide()
  $('#issueMediaUpload').val(null)

  // Clone the cancel button to remove any lingering event listeners
  const oldElement = document.getElementById('issueEditCancelButton')
  const newElement = oldElement.cloneNode(true)
  oldElement.parentNode.replaceChild(newElement, oldElement)

  if (issueType === 'new') {
    // Clear inputs
    $('#issueTitleInput').val('')
    $('#issueDescriptionInput').val('')
    $('#issueAssignedToSelector').val(null)
    $('#issueRelatedComponentsSelector').val(null)

    $('#issueEditModal').data('type', 'new')
    $('#issueEditModalTitle').html('Create Issue')
    issueMediaUploadedFile(false)
  } else if (target != null) {
    $('#issueEditModal').data('type', 'edit')
    $('#issueEditModal').data('target', target)
    $('#issueEditModalTitle').html('Edit Issue')

    const targetIssue = getIssue(target)
    $('#issueTitleInput').val(targetIssue.issueName)
    $('#issueDescriptionInput').val(targetIssue.issueDescription)
    $('#issueAssignedToSelector').val(targetIssue.assignedTo)
    $('#issueRelatedComponentsSelector').val(targetIssue.relatedComponentIDs)
    if (targetIssue.media != null) {
      issueMediaUploadedFile(true, targetIssue.media)
    } else {
      issueMediaUploadedFile(false)
    }
  }

  $('#issueEditModal').modal('show')
}

export function onIssueMediaUploadChange () {
  // When a file is selected, check if it contains an equal sign (not allowed).
  // If not, display it

  $('#issueMediaUploadSubmitButton').show()
  // Show the upload button (we may hide it later)
  const fileInput = $('#issueMediaUpload')[0]
  $('#issueMediaUploadFilename').html('File: ' + fileInput.files[0].name)
  // Check for = in filename
  if (fileInput.files[0].name.includes('=')) {
    $('#issueMediaUploadEqualSignWarning').show()
    $('#issueMediaUploadSubmitButton').hide()
  } else {
    $('#issueMediaUploadEqualSignWarning').hide()
  }
  // Check for HEIC file
  if (fileInput.files[0].type === 'image/heic') {
    $('#issueMediaUploadHEICWarning').show()
    $('#issueMediaUploadSubmitButton').hide()
  } else {
    $('#issueMediaUploadHEICWarning').hide()
  }
}

export function uploadIssueMediaFile () {
  const fileInput = $('#issueMediaUpload')[0]
  if (fileInput.files[0] != null) {
    $('#issueMediaUploadSubmitButton').prop('disabled', true)
    $('#issueMediaUploadSubmitButton').html('Working...')

    const file = fileInput.files[0]
    const formData = new FormData()
    formData.append('files', file)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', constConfig.serverAddress + '/issue/uploadMedia', true)
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          if (response.success === true) {
            issueMediaUploadedFile(true, response.filename)
            // If we cancel without saving, need to delete this file.
            document.getElementById('issueEditCancelButton').addEventListener('click', function () {
              issueMediaDelete(response.filename)
            })
          } else {
            issueMediaUploadedFile(false)
          }
        }
        $('#issueMediaUploadSubmitButton').prop('disabled', false)
        $('#issueMediaUploadSubmitButton').html('Upload')
        $('#issueMediaUploadProgressBarContainer').hide()
        $('#issueMediaUploadSubmitButton').hide()
        $('#issueMediaUploadFilename').html('Choose file')
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        $('#issueMediaUploadProgressBar').width(String(percentComplete) + '%')
        if (percentComplete > 0) {
          $('#issueMediaUploadProgressBarContainer').show()
        } else if (percentComplete === 100) {
          $('#issueMediaUploadProgressBarContainer').hide()
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function issueMediaUploadedFile (fileExists, filename = null) {
  // Configure the file upload/view interface depending on whether a file has
  // been uploaded.

  $('#issueMediaViewFromModal').data('filename', filename)

  if (fileExists) {
    $('#issueMediaUploadCol').hide()
    $('#issueMediaViewCol').show()
    $('#issueMediaModalLabel').html('Uploaded image')
  } else {
    $('#issueMediaModalLabel').html('Add image')
    $('#issueMediaUploadCol').show()
    $('#issueMediaViewCol').hide()
  }
}

export function issueMediaDelete (filename) {
  // Send a message to the control server, asking for the file to be deleted.

  const requestDict = { filename }
  // If this is an existing issue, we need to say what the issue id is
  const issueType = $('#issueEditModal').data('type')
  if (issueType === 'edit') {
    requestDict.owner = $('#issueEditModal').data('target')
  }

  constTools.makeServerRequest({
    method: 'POST',
    endpoint: '/issue/deleteMedia',
    params: requestDict
  })
    .then((response) => {
      if ('success' in response) {
        if (response.success === true) {
          issueMediaUploadedFile(false)
        }
      }
    })
}

export function submitIssueFromModal () {
  // Take the inputs from the modal, check that we have everything we need,
  // and submit it to the server.

  const issueDict = {}
  issueDict.issueName = $('#issueTitleInput').val()
  issueDict.issueDescription = $('#issueDescriptionInput').val()
  issueDict.relatedComponentIDs = $('#issueRelatedComponentsSelector').val()
  issueDict.assignedTo = $('#issueAssignedToSelector').val()
  issueDict.priority = $('#issuePrioritySelector').val()
  if ($('#issueMediaViewFromModal').data('filename') != null) {
    issueDict.media = $('#issueMediaViewFromModal').data('filename')
  }

  let error = false
  if (issueDict.issueName === '') {
    console.log('Need issue name')
    error = true
  }

  if (error === false) {
    const issueType = $('#issueEditModal').data('type')
    let endpoint
    if (issueType === 'new') {
      endpoint = '/issue/create'
    } else {
      issueDict.id = $('#issueEditModal').data('target')
      endpoint = '/issue/edit'
    }
    $('#issueEditModal').modal('hide')

    constTools.makeServerRequest({
      method: 'POST',
      endpoint,
      params: { details: issueDict }
    })
      .then((result) => {
        if ('success' in result && result.success === true) {
          getIssueList()
        }
      })
  }
}
