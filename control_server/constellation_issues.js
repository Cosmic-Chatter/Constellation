import constConfig from './config.js'
import * as constTools from './constellation_tools.js'

export function rebuildIssueList () {
  // Take an array of issue dictionaries and build the GUI representation.

  // Gather the settings for the various filters
  const filterPriority = $('#issueListFilterPrioritySelect').val()
  const filterAssignedTo = $('#issueListFilterAssignedToSelect').val()
  const issueList = document.getElementById('issuesRow')
  issueList.innerHTML = ''

  constConfig.issueList.forEach((issue, i) => {
    // Check against the filters
    if (filterPriority !== 'all' && filterPriority !== issue.priority && filterPriority != null) {
      return
    }
    if (
      (filterAssignedTo != null && filterAssignedTo !== 'all' && filterAssignedTo !== 'unassigned' && !issue.assignedTo.includes(filterAssignedTo)) ||
      (filterAssignedTo === 'unassigned' && issue.assignedTo.length > 0)
    ) return

    issueList.append(createIssueHTML(issue))
  })
}

export function createIssueHTML (issue, full = true) {
  // Create an HTML representation of an issue

  const col = document.createElement('div')
  col.setAttribute('class', 'col mt-2')

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
  card.setAttribute('class', `card border ${borderColor}`)
  col.appendChild(card)

  const body = document.createElement('div')
  body.setAttribute('class', 'card-body')
  card.appendChild(body)

  const title = document.createElement('H5')
  title.setAttribute('class', 'card-title')
  title.innerHTML = issue.issueName
  body.appendChild(title)

  const content = document.createElement('div')
  content.style.transition = 'all 1s'
  content.style.overflow = 'hidden'
  body.appendChild(content)

  issue.relatedComponentIDs.forEach((id, i) => {
    const tag = document.createElement('span')
    tag.setAttribute('class', 'badge bg-secondary me-1')
    tag.innerHTML = id
    content.appendChild(tag)
  })

  issue.assignedTo.forEach((name, i) => {
    const tag = document.createElement('span')
    tag.setAttribute('class', 'badge bg-success me-1')
    tag.innerHTML = name
    content.appendChild(tag)
  })

  const desc = document.createElement('p')
  desc.setAttribute('class', 'card-text')
  desc.style.whiteSpace = 'pre-wrap' // To preserve new lines
  desc.innerHTML = issue.issueDescription
  content.appendChild(desc)

  if (issue.media.length > 0) {
    const mediaBut = document.createElement('button')
    mediaBut.setAttribute('class', 'btn btn-primary me-1 mt-1')
    mediaBut.innerHTML = 'View media'

    const mediaFiles = []
    issue.media.forEach((file) => {
      mediaFiles.push('issues/media/' + file)
    })
    mediaBut.addEventListener('click', function () {
      constTools.openMediaInNewTab(mediaFiles)
    }, false)
    content.appendChild(mediaBut)
  }

  const editBut = document.createElement('button')
  editBut.setAttribute('class', 'btn btn-info me-1 mt-1')
  editBut.innerHTML = 'Edit'
  editBut.addEventListener('click', function () {
    showIssueEditModal('edit', issue.id)
  })
  content.appendChild(editBut)

  const deleteBut = document.createElement('button')
  deleteBut.setAttribute('type', 'button')
  deleteBut.setAttribute('class', 'btn btn-danger mt-1')
  deleteBut.setAttribute('data-bs-toggle', 'popover')
  deleteBut.setAttribute('title', 'Are you sure?')
  deleteBut.setAttribute('data-bs-content', `<a id="Popover${issue.id}" class='btn btn-danger w-100 issue-delete'>Confirm</a>`)
  deleteBut.setAttribute('data-bs-trigger', 'focus')
  deleteBut.setAttribute('data-bs-html', 'true')
  // Note: The event listener to detect is the delete button is clicked is defined in webpage.js
  deleteBut.addEventListener('click', function () { deleteBut.focus() })
  deleteBut.innerHTML = 'Delete'
  content.appendChild(deleteBut)
  $(deleteBut).popover()

  const footer = document.createElement('div')
  footer.classList = 'card-footer text-body-secondary text-center'

  if (full === false) {
    content.style.height = '0px'
    footer.innerHTML = 'More'
  } else {
    footer.innerHTML = 'Less'
  }
  card.appendChild(footer)

  footer.addEventListener('click', (event) => {
    if (content.style.height === '') {
      // Nothing set yet
      content.style.height = String(content.scrollHeight) + 'px'
    }
    // Give a frame for the above option to take
    setTimeout(() => {
      if (content.style.height === '0px') {
        content.style.height = String(content.scrollHeight) + 'px'
        footer.innerHTML = 'Less'
      } else {
        content.style.height = '0px'
        footer.innerHTML = 'More'
      }
    }, 1)
  })

  return col
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
          .then((issueList) => {
            constConfig.issueList = issueList
            rebuildIssueList()
          })
      }
    })
}

function getIssueList (id = '__all') {
  // Get a list of all the current issues and rebuild the issue GUI

  return constTools.makeServerRequest({
    method: 'GET',
    endpoint: '/issue/list/' + id
  }).then((response) => response.issueList)
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
  const issueRelatedComponentsSelector = document.getElementById('issueRelatedComponentsSelector')
  issueRelatedComponentsSelector.innerHTML = ''

  const components = constTools.sortComponentsByGroup()

  Object.keys(components).sort().forEach((group) => {
    const header = new Option(group)
    header.setAttribute('disabled', true)
    issueRelatedComponentsSelector.appendChild(header)
    const sortedGroup = components[group].sort((a, b) => {
      const aID = a.id.toLowerCase()
      const bID = b.id.toLowerCase()
      if (aID > bID) return 1
      if (aID < bID) return -1
      return 0
    })
    sortedGroup.forEach((component) => {
      const option = new Option(component.id, component.id)
      issueRelatedComponentsSelector.appendChild(option)
    })
  })

  for (let i = 0; i < constConfig.exhibitComponents.length; i++) {
    // Check if component already exists as an option. If not, add it
    if ($(`#issueRelatedComponentsSelector option[value='${constConfig.exhibitComponents[i].id}']`).length === 0) {
      $('#issueRelatedComponentsSelector').append()
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
  $('#issueMediaUploadFilename').html('Choose files')
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
    rebuildIssueMediaUploadedList()
  } else if (target != null) {
    $('#issueEditModal').data('type', 'edit')
    $('#issueEditModal').data('target', target)
    $('#issueEditModalTitle').html('Edit Issue')

    const targetIssue = getIssue(target)
    $('#issueTitleInput').val(targetIssue.issueName)
    $('#issueDescriptionInput').val(targetIssue.issueDescription)
    $('#issueAssignedToSelector').val(targetIssue.assignedTo)
    $('#issueRelatedComponentsSelector').val(targetIssue.relatedComponentIDs)
    if (targetIssue.media.length > 0) {
      rebuildIssueMediaUploadedList(target)
    } else {
      rebuildIssueMediaUploadedList()
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

    const formData = new FormData()

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', constConfig.serverAddress + '/issue/uploadMedia', true)
    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          if (response.success === true) {
            rebuildIssueMediaUploadedList()
            // If we cancel without saving, need to delete this file.
            document.getElementById('issueEditCancelButton').addEventListener('click', function () {
              issueMediaDelete(response.filenames)
            })
          } else {
            rebuildIssueMediaUploadedList()
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

function rebuildIssueMediaUploadedList (id = '') {
  // Configure the file upload/view interface depending on whether a file has
  // been uploaded.

  let filenames
  if (id === '') {
    _rebuildIssueMediaUploadedList([])
  } else {
    constTools.makeServerRequest({
      method: 'GET',
      endpoint: '/issue/' + id + '/getMedia'
    })
      .then((result) => {
        if (result.success === true) {
          filenames = result.media
        } else {
          filenames = []
        }
        _rebuildIssueMediaUploadedList(filenames)
      })
  }
}

function _rebuildIssueMediaUploadedList (filenames) {
  // Helper function to format the issue media details based on the supplied filenames

  $('#issueMediaViewFromModal').data('filenames', filenames)

  if (filenames.length > 0) {
    $('#issueMediaUploadCol').hide()
    $('#issueMediaViewCol').show()
    $('#issueMediaModalLabel').html('Uploaded media')

    // Build select entries for each file
    const mediaSelect = document.getElementById('issueMediaViewFromModalSelect')
    mediaSelect.innerHTML = ''
    let imageCounter = 0
    let videoCounter = 0
    const imageOptions = []
    const videoOptions = []
    filenames.forEach((filename) => {
      const fileType = constTools.guessMimetype(filename)
      if (fileType === 'image') {
        imageCounter += 1
        imageOptions.push(new Option('Image ' + imageCounter, filename))
      } else if (fileType === 'video') {
        videoCounter += 1
        videoOptions.push(new Option('Video ' + videoCounter, filename))
      }
    })
    if (imageOptions.length > 0) {
      const imageHeader = new Option('Images')
      imageHeader.setAttribute('disabled', true)
      mediaSelect.appendChild(imageHeader)
      imageOptions.forEach((option) => { mediaSelect.appendChild(option) })
    }

    if (videoOptions.length > 0) {
      const videoHeader = new Option('Videos')
      videoHeader.setAttribute('disabled', true)
      mediaSelect.appendChild(videoHeader)
      videoOptions.forEach((option) => { mediaSelect.appendChild(option) })
    }
  } else {
    $('#issueMediaModalLabel').html('Add media')
    $('#issueMediaUploadCol').show()
    $('#issueMediaViewCol').hide()
  }
}

export function issueMediaDelete (filenames) {
  // Send a message to the control server, asking for the files to be deleted.
  // filenames is an array of strings

  const requestDict = { filenames }

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
          rebuildIssueMediaUploadedList()
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
  if ($('#issueMediaViewFromModal').data('filenames').length > 0) {
    issueDict.media = $('#issueMediaViewFromModal').data('filenames')
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
