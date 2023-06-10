/* global bootstrap */
import * as constCommon from '../js/constellation_app_common.js'

export function createFileSelectionModal (userOptions) {
  // Build a standard Constellation file selection modal

  let options = {
    filetypes: [], // List of file types to allow ([] for all)
    manage: false, // Allow uploading, deleting, and renaming, but not selecting
    multiple: true // Select multiple files?
  }

  // Merge in user options
  options = { ...options, ...userOptions }
  return new Promise(function (resolve, reject) {
    const selectedFiles = []

    const modal = document.createElement('div')
    modal.classList = 'modal'
    modal.setAttribute('id', 'constFileSelectModal')
    modal.setAttribute('tabindex', '-1000') // Always on top
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="constFileSelectModalTitle" class="modal-title">Select Files</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="row mb-2">
              <div class='col-4'>
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" value="" id="constFileSelectModalThumbnailCheckbox" checked>
                  <label class="form-check-label" for="constFileSelectModalThumbnailCheckbox">
                    Thumbnails
                  </label>
                </div>
              </div>
              <div class="offset-2 col-6 offset-lg-4 col-lg-4">
              <div class="input-group input-group-sm">
                <input id="constFileSelectModalSearchField" type="text" placeholder="Search" class="form-control" aria-label="Search">
              </div>
                
              </div>
            </div>
            <div class="row flex-column-reverse flex-lg-row">
            <div class="col-12 col-lg-8" style="max-height: 55vh; overflow-y: auto;">
              <div id="constFileSelectModalFileList"  class='row'></div>
            </div>
            <div id="constFileSelectModalFilePreview" class="col-12 col-lg-4 mb-3">
              <div class="row justify-content-center">
                <div class='col-6 col-lg-12'>
                  <img id="constFileSelectModalFilePreviewImage" style="width: 100%; height: 200px; object-fit: contain;"></img>
                  <video id="constFileSelectModalFilePreviewVideo" loop autoplay muted disablePictureInPicture="true" webkit-playsinline="true" playsinline="true" style="width: 100%; height: 200px; object-fit: contain;"></video>
                  <div style="height: 200px; display: flex; justify-content: center; align-items: center;">
                    <audio id="constFileSelectModalFilePreviewAudio" controls style="width: 100%;"></audio>
                  </div>
                </div>
                <div class='col-6 col-lg-12 mt-2 text-center h6' style="word-wrap: break-word">
                <span id="constFileSelectModalFilePreviewFilename" ></span>
                <div id="constFileSelectModalFilePreviewEditContainer" class='row align-items-center'>
                  <div class='col-12'>
                    <input id="constFileSelectModalFilePreviewEditField" type='text' class='form-control'>
                  </div>
                  <div id="constFileSelectModalFilePreviewEditFileExistsWarning" class='col-12 text-danger text-center mt-2'>
                  A file with this name already exists.
                  </div>
                  <div class='col-6 col-sm-3 offset-sm-3 mt-2'>
                    <button id="constFileSelectModalFilePreviewEditCancelButton" class='btn btn-danger btn-sm w-100'>✕</button>
                  </div>
                  <div class='col-6 col-sm-3 mt-2'>
                    <button id="constFileSelectModalFilePreviewEditSaveButton" class='btn btn-success btn-sm w-100'>✓</button>
                  </div>
                </div>
                
                <div class='row'>
                  <div class='col-12 col-sm-6'>
                    <button id="constFileSelectModalRenameFileButton" class='btn btn-sm btn-info w-100 mt-3'>Rename</button>
                  </div>
                  <div id="constFileSelectModalDeleteFileButton" class='col-12 col-sm-6'>
                    <button class='btn btn-sm btn-danger w-100 mt-3' data-bs-toggle='popover' title='Are you sure?' data-bs-content='<a id="fileDeletePopover" class="btn btn-danger w-100">Confirm</a>' data-bs-trigger='focus' data-bs-html='true'>Delete</button>
                  </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          <div class="modal-footer">
            <div class='row w-100 px-0'>
              <div class='col-12 col-lg-9 ps-0'>
                <div id="constFileSelectModalUploadInterface" class="form-group">
                  <div class="row align-middle d-flex">
                    <div class="col-6 col-md-4">
                      <label class="btn btn-outline-secondary w-100">
                        <span id="constFileSelectModalUploadfilename" style="overflow-wrap: break-word!important;">Upload new</span>
                        <input hidden type="file" class="form-control-file" id="constFileSelectModalUpload" multiple>
                      </label>
                    </div>
                    <div id="constFileSelectModalUploadSubmitCol" class="col-6 col-md-3 col-lg-2">
                      <button id="constFileSelectModalUploadSubmitButton" class='btn w-100 btn-outline-primary'>Upload</button>
                    </div>
                    <div class='col-12 col-md-5 col-lg-6 my-auto' id='constFileSelectModalUploadProgressBarContainer'>
                      <div class="progress" style="height: 25px;">
                        <div id='constFileSelectModalUploadProgressBar' class="progress-bar" role="progressbar" style="width: 30%; font-size: large;" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                      </div>
                    </div>
                    <div class='col-12 text-danger mt-2' id='constFileSelectModalUploadOverwriteWarning'>Warning: this upload will overwrite a file of the same name.</div>
                  </div>
                </div>
              </div>
              <div class='col-12 col-lg-3 justify-content-end d-flex pe-0'>
                <button type="button" class="btn btn-secondary me-1" data-bs-dismiss="modal">Close</button>
                <button id="constFileSelectModalChooseButton" type="button" class="btn btn-primary">Choose</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(modal)

    // Thumbnails checkbox
    document.getElementById('constFileSelectModalThumbnailCheckbox').addEventListener('change', (event) => {
      modal.querySelectorAll('.const-file-thumb-container').forEach((el) => {
        if (event.target.checked === true) {
          el.style.display = 'block'
        } else {
          el.style.display = 'none'
        }
      })
    })

    // Search field
    document.getElementById('constFileSelectModalSearchField').addEventListener('input', (event) => {
      filterComponentContent(event.target.value)
    })

    // File upload
    document.getElementById('constFileSelectModalUpload').addEventListener('change', onUploadContentChange)
    document.getElementById('constFileSelectModalUploadSubmitButton').addEventListener('click', () => {
      uploadFile(options)
    })
    if (options.filetypes.length > 0) {
      // Need to configure the accept= property to limit which file types can be uploaded.

      let acceptStr = ''
      options.filetypes.forEach((type) => {
        if (type === 'audio' || type === 'image' || type === 'video') acceptStr += type + '/*, '
        else acceptStr += '.' + type + ', '
      })
      document.getElementById('constFileSelectModalUpload').setAttribute('accept', acceptStr)
    }

    // File rename
    document.getElementById('constFileSelectModalFilePreviewEditContainer').style.display = 'none'
    document.getElementById('constFileSelectModalRenameFileButton').addEventListener('click', showRenameField)
    document.getElementById('constFileSelectModalFilePreviewEditCancelButton').addEventListener('click', cancelFileRename)
    document.getElementById('constFileSelectModalFilePreviewEditSaveButton').addEventListener('click', renameFile)

    // File delete
    const deleteBUtton = document.getElementById('constFileSelectModalDeleteFileButton')
    deleteBUtton.addEventListener('click', function () { deleteBUtton.focus() })
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'))
    popoverTriggerList.map(function (popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl)
    })

    if (document.body.getAttribute('data-fileDeletePopoverEventAdded') !== 'true') {
      // Only add this listener the first time we create a file select modal
      document.addEventListener('click', (event) => {
        if (event.target.getAttribute('id') !== 'fileDeletePopover') return
        deleteFile()
      })
      document.body.setAttribute('data-fileDeletePopoverEventAdded', 'true')
    }

    document.getElementById('constFileSelectModalChooseButton').addEventListener('click', () => {
      modal.querySelectorAll('.const-file-selected').forEach((el) => {
        selectedFiles.push(el.getAttribute('data-filename'))
      })
      bootstrap.Modal.getInstance(modal).hide()
    },
    { once: true })

    modal.addEventListener('hidden.bs.modal', () => {
      // If we dismiss the modal in any way other than clicking the Choose button,
      // return no files.

      // Destroy the modal
      const modal = document.getElementById('constFileSelectModal')
      modal.parentElement.removeChild(modal)

      // Return any selected files
      resolve(selectedFiles)
    },
    { once: true })

    const title = document.getElementById('constFileSelectModalTitle')
    if (options.manage === true) {
      title.innerHTML = 'Manage files'
    } else if (options.multiple === true) {
      title.innerHTML = 'Select files'
    } else if (options.multiple === false) {
      title.innerHTML = 'Select file'
    }

    // File upload
    document.getElementById('constFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('constFileSelectModalUploadProgressBarContainer').style.display = 'none'
    document.getElementById('constFileSelectModalUploadOverwriteWarning').style.display = 'none'

    populateComponentContent(options)
      .then(() => {
        // Configure manage vs select
        if (options.manage === true) {
          document.getElementById('constFileSelectModalChooseButton').style.display = 'none'
          Array.from(document.querySelectorAll('.const-file-select-col')).forEach((el) => {
            el.style.display = 'none'
          })
        }
        new bootstrap.Modal(modal).show()
      })
  })
}

function filterComponentContent (strToMatch) {
  // Use CSS to hide any files that don't include the given string.

  Array.from(document.getElementById('constFileSelectModalFileList').children).forEach((el) => {
    const filename = el.getAttribute('data-filename')
    if (filename.toLowerCase().includes(strToMatch.toLowerCase())) {
      el.style.display = 'flex'
    } else {
      el.style.display = 'none'
    }
  })
}

function populateComponentContent (options) {
  // Get a list of the available files and create an element for each.

  return constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/getAvailableContent'
  })
    .then((result) => {
      _populateComponentContent(result, options)
      previewFile('', [])
    })
}

function _populateComponentContent (fileDict, options) {
  // Build HTML elements for every file in fileDict.all_exhibits, modified by
  // the options passed in from createFileSelectionModal()

  const fileRow = document.getElementById('constFileSelectModalFileList')
  // Alphabetize the list
  const fileList = fileDict.all_exhibits.sort(function (a, b) { return a.localeCompare(b) })
  let thumbnailList = fileDict.thumbnails
  if (thumbnailList == null) {
    thumbnailList = []
  }

  // Clear any existing files
  fileRow.innerHTML = ''
  const showThumbs = document.getElementById('constFileSelectModalThumbnailCheckbox').checked

  fileList.forEach((file) => {
    const extension = file.split('.').slice(-1)[0].toLowerCase()
    const mimetype = constCommon.guessMimetype(file)

    // If we are provided a list of allowable filetypes, reject any files
    // that are not of an acceptable type.
    if (options.filetypes.length > 0) {
      let match = false
      options.filetypes.forEach((type) => {
        if (extension === type || mimetype === type) match = true
      })
      if (match === false) return
    }

    const entry = document.createElement('div')
    entry.classList = 'col-12 row py-2 ps-4 const-file-entry'
    entry.innerHTML = `
      <div class='col-1 my-auto px-0 const-file-select-col' style="cursor: pointer;">
        <center>
          <div class='border text-center const-file-select-box' style="width: 30px; height: 30px;"></div>
        </center>
      </div>
      <div class='col-3 ps-1 const-file-thumb-container'></div>
      <div class='col-8 my-auto const-file-name'></div>
    `
    fileRow.appendChild(entry)

    // Set color based on whether dark mode is enabled
    const mode = document.querySelector('html').getAttribute('data-bs-theme')
    const box = entry.querySelector('.const-file-select-box')
    if (mode === 'dark') box.classList.add('border-light')
    else box.classList.add('border-dark')

    entry.setAttribute('data-filename', file)

    // Hover
    entry.addEventListener('mouseenter', (event) => {
      document.querySelectorAll('.const-file-entry').forEach((el) => {
        el.classList.remove('bg-secondary', 'text-dark')
      })
      event.target.classList.add('bg-secondary', 'text-dark')
      const file = event.target.getAttribute('data-filename')
      previewFile(file, thumbnailList)
    })

    // Checkbox
    const check = entry.querySelector('.const-file-select-box')
    check.addEventListener('click', (event) => {
      selectFile(event, options.multiple)
    })
    check.setAttribute('data-filename', file)

    // Thumbnail
    const thumbContainer = entry.querySelector('.const-file-thumb-container')

    let thumb
    const thumbRoot = file.replace(/\.[^/.]+$/, '')

    if (mimetype === 'image' && thumbnailList.includes(thumbRoot + '.jpg')) {
      thumb = document.createElement('img')
      thumb.src = constCommon.config.helperAddress + '/thumbnails/' + thumbRoot + '.jpg'
    } else if (mimetype === 'video' && thumbnailList.includes(thumbRoot + '.mp4')) {
      thumb = document.createElement('video')
      thumb.setAttribute('loop', true)
      thumb.setAttribute('autoplay', true)
      thumb.setAttribute('disablePictureInPicture', true)
      thumb.setAttribute('webkit-playsinline', true)
      thumb.setAttribute('playsinline', true)
      thumb.src = constCommon.config.helperAddress + '/thumbnails/' + thumbRoot + '.mp4'
    } else if (mimetype === 'audio') {
      thumb = document.createElement('img')
      thumb.src = constCommon.config.helperAddress + getDefaultAudioIcon()
    } else {
      // Not an image or video, or we don't have a thumbnail
      thumb = document.createElement('img')
      thumb.src = constCommon.config.helperAddress + getDefaultDocumentImage()
    }
    thumbContainer.appendChild(thumb)
    thumb.style.width = '100%'
    thumb.style.height = '50px'
    thumb.style.objectFit = 'contain'
    if (showThumbs === false) thumbContainer.style.display = 'none'

    // Filename
    const filename = entry.querySelector('.const-file-name')
    filename.innerHTML = shortenFilename(file)
    filename.title = file
  })
}

function shortenFilename (filename) {
  // Shorten the given filename so it fits on one line

  if (filename.length > 30) {
    return filename.substr(0, 15) + '...' + filename.substr(filename.length - 10, filename.length)
  }
  return filename
}

function previewFile (file, thumbnailList) {
  // Take the given filename and fill the preview with its details

  const img = document.getElementById('constFileSelectModalFilePreviewImage')
  const vid = document.getElementById('constFileSelectModalFilePreviewVideo')
  const aud = document.getElementById('constFileSelectModalFilePreviewAudio')

  document.getElementById('constFileSelectModalFilePreviewFilename').innerHTML = file
  document.getElementById('constFileSelectModalFilePreview').setAttribute('data-filename', file)

  const thumbRoot = file.replace(/\.[^/.]+$/, '')
  const mimetype = constCommon.guessMimetype(file)

  if (mimetype === 'image' && thumbnailList.includes(thumbRoot + '.jpg')) {
    img.style.display = 'block'
    vid.style.display = 'none'
    aud.parentElement.style.display = 'none'
    img.src = constCommon.config.helperAddress + '/thumbnails/' + thumbRoot + '.jpg'
  } else if (mimetype === 'video' && thumbnailList.includes(thumbRoot + '.mp4')) {
    img.style.display = 'none'
    vid.style.display = 'block'
    aud.parentElement.style.display = 'none'
    vid.src = constCommon.config.helperAddress + '/thumbnails/' + thumbRoot + '.mp4'
  } else if (mimetype === 'audio') {
    img.style.display = 'none'
    vid.style.display = 'none'
    aud.parentElement.style.display = 'flex'
    aud.src = constCommon.config.helperAddress + '/content/' + file
  } else {
    // We have something other than an image or video, or we are missing a thumbnail
    img.style.display = 'block'
    vid.style.display = 'none'
    aud.parentElement.style.display = 'none'
    img.src = constCommon.config.helperAddress + getDefaultDocumentImage()
  }
}

function getDefaultDocumentImage () {
  // Return the approriate thumbnail based on whether dark mode is enabled.

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/document_white.svg'
  else if (mode === 'light') return '/_static/icons/document_black.svg'
  else return '/_static/icons/document_black.svg'
}

function getDefaultAudioIcon () {
  // Return the approriate thumbnail based on whether dark mode is enabled.

  const mode = document.querySelector('html').getAttribute('data-bs-theme')
  if (mode === 'dark') return '/_static/icons/audio_white.svg'
  else if (mode === 'light') return '/_static/icons/audio_black.svg'
  else return '/_static/icons/audio_black.svg'
}

function selectFile (event, allowMultiple) {
  // Called when the user clicks the checkbox on a file. If allowMultiple=false,
  // selecting one file unselects the others.

  const target = event.target

  if (target.classList.contains('const-file-selected')) {
    target.classList.remove('const-file-selected', 'bg-success')
    target.innerHTML = ''
  } else {
    if (allowMultiple === false) {
      document.querySelectorAll('.const-file-select-box').forEach((el) => {
        el.classList.remove('const-file-selected', 'bg-success')
        el.innerHTML = ''
      })
    }

    target.classList.add('const-file-selected', 'bg-success')
    target.innerHTML = '✓'
  }
}

function onUploadContentChange () {
  // When we select a file for uploading, check against the existing files
  //  and warn if we will overwrite.

  // Show the upload button
  document.getElementById('constFileSelectModalUploadSubmitCol').style.display = 'block'

  const fileInput = document.getElementById('constFileSelectModalUpload')

  // Check for filename collision
  const currentFiles = Array.from(document.getElementById('constFileSelectModal').querySelectorAll('.const-file-select-box')).map(el => el.getAttribute('data-filename'))

  let collision = false
  for (let i = 0; i < fileInput.files.length; i++) {
    const file = fileInput.files[i]
    if (currentFiles.includes(file.name)) {
      collision = true
    }
  }
  // Format button text
  if (fileInput.files.length === 1) {
    document.getElementById('constFileSelectModalUploadfilename').innerHTML = '1 file selected'
  } else {
    document.getElementById('constFileSelectModalUploadfilename').innerHTML = String(fileInput.files.length) + ' files selected'
  }
  if (collision) {
    document.getElementById('constFileSelectModalUploadOverwriteWarning').style.display = 'block'
  } else {
    document.getElementById('constFileSelectModalUploadOverwriteWarning').style.display = 'none'
  }
}

function uploadFile (options) {
  // Handle uploading files

  const fileInput = document.getElementById('constFileSelectModalUpload')

  document.getElementById('constFileSelectModalUploadOverwriteWarning').style.display = 'none'

  if (fileInput.files[0] != null) {
    document.getElementById('constFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('constFileSelectModalUploadProgressBarContainer').style.display = 'block'

    const formData = new FormData()

    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i]
      formData.append('files', file)
    }

    const xhr = new XMLHttpRequest()
    xhr.open('POST', constCommon.config.helperAddress + '/uploadContent', true)

    xhr.onreadystatechange = function () {
      if (this.readyState !== 4) return
      if (this.status === 200) {
        const response = JSON.parse(this.responseText)

        if ('success' in response) {
          console.log('success')
          document.getElementById('constFileSelectModalUploadProgressBarContainer').style.display = 'none'
          document.getElementById('constFileSelectModalUploadfilename').innerHTML = 'Upload new'
          populateComponentContent(options)
        }
      } else if (this.status === 422) {
        console.log(JSON.parse(this.responseText))
      }
    }

    xhr.upload.addEventListener('progress', function (evt) {
      if (evt.lengthComputable) {
        let percentComplete = evt.loaded / evt.total
        percentComplete = parseInt(percentComplete * 100)
        document.getElementById('constFileSelectModalUploadProgressBar').style.width = String(percentComplete) + '%'
        if (percentComplete > 0) {
          document.getElementById('constFileSelectModalUploadProgressBarContainer').style.display = 'block'
        }
      }
    }, false)

    xhr.send(formData)
  }
}

function deleteFile () {
  // Delete the current file in the preview pane

  const file = document.getElementById('constFileSelectModalFilePreview').getAttribute('data-filename')
  console.log('Deleting file:', file)
  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/deleteFile',
    params: { file }
  })
    .then((result) => {
      if ('success' in result && result.success === true) {
        const entry = document.getElementById('constFileSelectModal').querySelector(`.const-file-entry[data-filename="${file}"]`)
        previewFile('', [])
        document.getElementById('constFileSelectModalFilePreview').setAttribute('data-filename', '')
        entry.parentElement.removeChild(entry)
      }
    })
}

function showRenameField () {
  // Show the rename field for the file currently being previewed.

  const filename = document.getElementById('constFileSelectModalFilePreview').getAttribute('data-filename')

  if (filename === '') return

  document.getElementById('constFileSelectModalFilePreviewEditContainer').style.display = 'flex'
  document.getElementById('constFileSelectModalFilePreviewFilename').style.display = 'none'
  document.getElementById('constFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'none'

  const fileNameWithoutExt = filename.substring(0, filename.lastIndexOf('.')) || filename
  const renameField = document.getElementById('constFileSelectModalFilePreviewEditField')
  renameField.setAttribute('filename', filename) // Save the original name to ensure we rename the correct file
  renameField.value = filename
  renameField.setSelectionRange(0, fileNameWithoutExt.length)
  renameField.focus()
}

function cancelFileRename () {
  document.getElementById('constFileSelectModalFilePreviewEditContainer').style.display = 'none'
  document.getElementById('constFileSelectModalFilePreviewFilename').style.display = 'block'
}

function renameFile () {
  // Get the new name and send it to the helper to be changed.

  const renameField = document.getElementById('constFileSelectModalFilePreviewEditField')
  const originalName = renameField.getAttribute('filename')
  const newName = renameField.value

  if (originalName === newName) {
    cancelFileRename()
    return
  }

  constCommon.makeHelperRequest({
    method: 'POST',
    endpoint: '/renameFile',
    params: {
      current_name: originalName,
      new_name: newName
    }
  })
    .then((result) => {
      if ('success' in result) {
        if (result.success === false && result.error === 'file_exists') {
          document.getElementById('constFileSelectModalFilePreviewEditFileExistsWarning').style.display = 'block'
        } else if (result.success === true) {
          // Update the preview pane
          document.getElementById('constFileSelectModalFilePreview').setAttribute('data-filename', newName)
          // Update the entry
          const entry = document.getElementById('constFileSelectModal').querySelector(`.const-file-entry[data-filename="${originalName}"]`)
          entry.setAttribute('data-filename', newName)
          entry.querySelector('.const-file-name').title = newName
          entry.querySelector('.const-file-name').innerHTML = shortenFilename(newName)
          entry.querySelector('.const-file-select-box').setAttribute('data-filename', newName)

          // Update the preview filename
          document.getElementById('constFileSelectModalFilePreviewFilename').innerHTML = newName
          document.getElementById('constFileSelectModalFilePreviewEditContainer').style.display = 'none'
          document.getElementById('constFileSelectModalFilePreviewFilename').style.display = 'block'
        }
      }
    })
}
