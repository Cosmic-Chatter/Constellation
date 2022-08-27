/* global serverIP */

export function getAvailableDefinitions (complete) {
  // Ask the control server to send a list of availble definition files
  // Pass a function and it will be called with the list as the
  // only parameter

  const requestDict = {
    class: 'tracker',
    action: 'getAvailableDefinitions'
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', serverIP, true)
  xhr.timeout = 3000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const definitionList = JSON.parse(this.responseText)
      if (typeof complete === 'function') {
        complete(definitionList)
      }
    }
  }
  xhr.send(requestString)
}

export function getAvailableTrackerData (complete) {
  // Ask the control server to send a list of availble data files
  // Pass a function and it will be called with the list as the
  // only parameter

  const requestDict = {
    class: 'tracker',
    action: 'getAvailableTrackerData'
  }

  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', serverIP, true)
  xhr.timeout = 3000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const response = JSON.parse(this.responseText)
      if ('success' in response && response.success === false) {
        console.log('Error retrieving tracker data list:', response.reason)
        return
      }
      if (typeof complete === 'function') {
        complete(response.data)
      }
    }
  }
  xhr.send(requestString)
}

export function loadLayoutDefinition (name, complete) {
  // Ask the control server to send a JSON dict with the layout definition
  // from the file with `name`
  // After the layout is retrieved, the function `complete` will be called
  // with the layout as the only parameter

  const requestDict = {
    class: 'tracker',
    action: 'getLayoutDefinition',
    name
  }
  const requestString = JSON.stringify(requestDict)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', serverIP, true)
  xhr.timeout = 1000
  xhr.setRequestHeader('Content-Type', 'application/json')
  xhr.overrideMimeType('text/plain; charset=x-user-defined')
  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return

    if (this.status === 200) {
      const definition = JSON.parse(this.responseText)
      if ('success' in definition) {
        if (definition.success === true) {
          if (typeof complete === 'function') {
            complete(definition.layout)
          }
        } else {
          console.log('Error: could not load layout definition:', definition.reason)
        }
      } else {
        console.log('Error: Did not receive valid JSON')
      }
    }
  }
  xhr.send(requestString)
}
