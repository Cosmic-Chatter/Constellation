/* global bootstrap */
import * as constCommon from '../js/constellation_app_common.js'

export function createFileSelectionModal (userOptions) {
  // Build a standard Constellation file selection modal

  let options = {
    filetypes: [], // List of file types to allow ([] for all)
    multiple: true // Select multiple files?
  }

  // Merge in user options
  options = { ...options, ...userOptions }

  console.log(options)

  return new Promise(function (resolve, reject) {
    // If the document body does not already have a file select modal, create it.

    let modal = document.getElementById('constFileSelectModal')
    if (modal == null) {
      modal = document.createElement('div')
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
                <div class='col-2'>
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="" id="constFileSelectModalThumbnailCheckbox" checked>
                    <label class="form-check-label" for="constFileSelectModalThumbnailCheckbox">
                      Thumbnails
                    </label>
                  </div>
                </div>
              </div>
              <div class="row flex-column-reverse flex-lg-row">
              <div class="col-12 col-lg-8" style="height: 55vh; overflow-y: auto;">
                <div id="constFileSelectModalFileList"  class='row'></div>
              </div>
              <div id="constFileSelectModalFilePreview" class="col-12 col-lg-4 mb-3">
                <div class="row justify-content-center">
                  <div class='col-6 col-lg-12'>
                    <img id="constFileSelectModalFilePreviewImage" style="width: 100%; height: 200px; object-fit: contain;"></img>
                    <video id="constFileSelectModalFilePreviewVideo" loop autoplay disablePictureInPicture="true" webkit-playsinline="true" playsinline="true" style="width: 100%; height: 200px; object-fit: contain;"></video>
                  </div>
                  <div class='col-6 col-lg-12 mt-2 text-center h6' style="word-wrap: break-word">
                  <span id="constFileSelectModalFilePreviewFilename" ></span>
                  <div class='row'>
                    <div class='col-12 col-sm-6'>
                      <button class='btn btn-sm btn-info w-100 mt-3'>Rename</button>
                    </div>
                    <div class='col-12 col-sm-6'>
                      <button class='btn btn-sm btn-danger w-100 mt-3'>Delete</button>
                    </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
            <div class="modal-footer">
              <div class='row w-100 px-0'>
                <div class='col-9 ps-0'>
                  <div id="constFileSelectModalUploadInterface" class="form-group">
                    <div class="row align-middle d-flex">
                      <div class="col-4">
                        <label class="btn btn-outline-secondary w-100">
                          <span id="constFileSelectModalUploadfilename" style="overflow-wrap: break-word!important;">Upload new</span>
                          <input hidden type="file" class="form-control-file" id="constFileSelectModalUpload" multiple>
                        </label>
                      </div>
                      <div id="constFileSelectModalUploadSubmitCol" class="col-2">
                        <button id="constFileSelectModalUploadSubmitButton" class='btn w-100 btn-outline-primary'>Upload</button>
                      </div>
                      <div class='col-8 my-auto' id='constFileSelectModalUploadProgressBarContainer'>
                        <div class="progress" style="height: 25px;">
                          <div id='constFileSelectModalUploadProgressBar' class="progress-bar" role="progressbar" style="width: 30%; font-size: large;" aria-valuenow="20" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                      </div>
                      <div class='col-12 text-danger mt-2' id='constFileSelectModalUploadOverwriteWarning'>Warning: this upload will overwrite a file of the same name.</div>
                    </div>
                  </div>
                </div>
                <div class='col-3 justify-content-end d-flex pe-0'>
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

      // File upload
      document.getElementById('constFileSelectModalUpload').addEventListener('change', onUploadContentChange)
      document.getElementById('constFileSelectModalUploadSubmitButton').addEventListener('click', uploadFile)

      modal.addEventListener('hide.bs.modal', () => {
        // If we dismiss the modal in any way other than clicking the Choose button,
        // return no files.
        resolve([])
      })

      document.getElementById('constFileSelectModalChooseButton').addEventListener('click', () => {
        const selectedFiles = []
        modal.querySelectorAll('.const-file-selected').forEach((el) => {
          selectedFiles.push(el.getAttribute('data-filename'))
        })
        resolve(selectedFiles)
        bootstrap.Modal.getInstance(modal).hide()
      })
    }

    const title = document.getElementById('constFileSelectModalTitle')
    if (options.multiple) {
      title.innerHTML = 'Select files'
    } else title.innerHTML = 'Select file'

    // File upload
    document.getElementById('constFileSelectModalUploadSubmitCol').style.display = 'none'
    document.getElementById('constFileSelectModalUploadProgressBarContainer').style.display = 'none'
    document.getElementById('constFileSelectModalUploadOverwriteWarning').style.display = 'none'

    constCommon.makeHelperRequest({
      method: 'GET',
      endpoint: '/getAvailableContent'
    })
      .then((result) => {
        populateComponentContent(result, options)
        previewFile('', [])
      })
    new bootstrap.Modal(modal).show()
  })
}

function populateComponentContent (fileDict, options) {
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
      <div class='col-1 my-auto px-0' style="cursor: pointer;">
        <center>
          <div class='border border-light text-center const-file-select-box' style="width: 30px; height: 30px;"></div>
        </center>
      </div>
      <div class='col-3 ps-1 const-file-thumb-container'></div>
      <div class='col-8 my-auto const-file-name'></div>
    `
    fileRow.appendChild(entry)

    // Hover
    entry.addEventListener('mouseenter', (event) => {
      document.querySelectorAll('.const-file-entry').forEach((el) => {
        el.classList.remove('bg-secondary', 'text-dark')
      })
      event.target.classList.add('bg-secondary', 'text-dark')
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

    let thumb, thumbName
    if (mimetype === 'image') {
      thumbName = file.replace(/\.[^/.]+$/, '') + '.jpg'
      if (thumbnailList.includes(thumbName)) {
        thumb = document.createElement('img')
        thumb.src = constCommon.config.helperAddress + '/thumbnails/' + thumbName
      }
    } else if (mimetype === 'video') {
      thumbName = file.replace(/\.[^/.]+$/, '') + '.mp4'
      if (thumbnailList.includes(thumbName)) {
        thumb = document.createElement('video')
        thumb.setAttribute('loop', true)
        thumb.setAttribute('autoplay', true)
        thumb.setAttribute('disablePictureInPicture', true)
        thumb.setAttribute('webkit-playsinline', true)
        thumb.setAttribute('playsinline', true)
        thumb.src = constCommon.config.helperAddress + '/thumbnails/' + thumbName
      }
    } else {
      // We have something other than an image or video
      thumb = document.createElement('img')
      thumb.src = constCommon.config.helperAddress + '/_static/icons/document_white.svg'
    }
    thumbContainer.appendChild(thumb)
    thumb.style.width = '100%'
    thumb.style.height = '50px'
    thumb.style.objectFit = 'contain'

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

  document.getElementById('constFileSelectModalFilePreviewFilename').innerHTML = file
  document.getElementById('constFileSelectModalFilePreview').setAttribute('data-filename', file)

  let thumbName
  const mimetype = constCommon.guessMimetype(file)
  if (mimetype === 'image') {
    img.style.display = 'block'
    vid.style.display = 'none'
    thumbName = file.replace(/\.[^/.]+$/, '') + '.jpg'
    if (thumbnailList.includes(thumbName)) {
      img.src = constCommon.config.helperAddress + '/thumbnails/' + thumbName
    }
  } else if (mimetype === 'video') {
    img.style.display = 'none'
    vid.style.display = 'block'
    thumbName = file.replace(/\.[^/.]+$/, '') + '.mp4'
    if (thumbnailList.includes(thumbName)) {
      vid.src = constCommon.config.helperAddress + '/thumbnails/' + thumbName
    }
  } else {
    // We have something other than an image or video
    img.style.display = 'block'
    vid.style.display = 'none'
    img.src = constCommon.config.helperAddress + '/_static/icons/document_white.svg'
  }
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

function uploadFile () {
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
