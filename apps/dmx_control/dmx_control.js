/* global Coloris */

import * as constCommon from '../js/constellation_app_common.js'

class DMXUniverse {
  // A mirror for the DMXUniverse Python class

  constructor(name, controller) {
    this.name = name
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
    this.controller = controller
    this.fixtures = {}
  }

  addFixture(definition) {
    // Create a new fixture and add it to this.fixtures.

    const newFixture = new DMXFixture(definition.name, definition.start_channel, definition.channels, definition.uuid)
    newFixture.universe = this.name
    this.fixtures[definition.name] = newFixture

    return newFixture
  }

  getFixtureByName(name) {
    return this.fixtures[name]
  }

  getFixtureByUUID(uuid) {
    let matchedFixture = null
    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    })
    return matchedFixture
  }

  createHTML() {
    // Create the HTML representation for this universe.

    const col = document.createElement('div')
    col.classList = 'col-12'

    const row1 = document.createElement('div')
    row1.classList = 'row bg-secondary mx-0 rounded-top'
    col.appendChild(row1)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-9 col-sm-10 h4 px-2 py-2 mb-0'
    nameCol.innerHTML = this.name
    row1.appendChild(nameCol)

    const addButtonCol = document.createElement('div')
    addButtonCol.classList = 'col-3 col-sm-2 align-self-center pe-1'
    row1.appendChild(addButtonCol)

    const addButton = document.createElement('button')
    addButton.classList = 'btn btn-primary w-100'
    addButton.innerHTML = 'Add Fixture'
    addButton.addEventListener('click', () => {
      showAddFixtureModal(this.name)
    })
    addButtonCol.appendChild(addButton)

    const row2 = document.createElement('div')
    row2.classList = 'row'
    col.appendChild(row2)

    $(nameCol).click(() => {
      $(row2).slideToggle(300)
    })

    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      row2.appendChild(fixture.createHTML(this.safeName))
    })

    return col
  }
}

class DMXFixture {
  // A mirror for the DMXFixture Python class.

  constructor(name, startChannel, channelList, uuid) {
    this.name = name
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
    this.startChannel = startChannel
    this.channelList = channelList
    this.uuid = uuid

    this.channelValues = {}
    this.universe = null
    this.groups = [] // Hold the name of every group this fixture is in
  }

  setChannelValues(valueDict) {
    // Take a dictionary of channel values and update this.channelValues.

    Object.keys(valueDict).forEach((key) => {
      this.channelValues[key] = valueDict[key]
    })
  }

  updateGUI() {
    // Take the current channelValues and use them to update the GUI.

    // Loop the channels and update their GUI representations
    Object.keys(this.channelValues).forEach(key => {
      // Update the universe representation
      const universe = getUniverseByName(this.universe)
      $('#' + universe.safeName + '_fixture_' + this.uuid + '_' + 'channelValue_' + key).val(this.channelValues[key])
      $('#' + universe.safeName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + key).val(this.channelValues[key])
      updatecolorPicker(universe.safeName, this.uuid)

      // Update the group(s) representation
      this.groups.forEach((groupName) => {
        const group = getGroupByName(groupName)
        $('#' + group.safeName + '_fixture_' + this.uuid + '_' + 'channelValue_' + key).val(this.channelValues[key])
        $('#' + group.safeName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + key).val(this.channelValues[key])
        updatecolorPicker(group.safeName, this.uuid)
      })
    })
  }

  sendChannelUpdate(channel) {
    // Wrapper to choose the most efficient way to update

    if (['r', 'g', 'b'].includes(channel)) {
      this.sendColorUpdate()
    } else if (channel === 'dimmer') {
      this.sendBrightnessUpdate()
    } else {
      this.sendGenericChannelUpdate(channel)
    }
  }

  sendGenericChannelUpdate(channel) {
    // Send a message to the helper asking it to update the given channel

    constCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setChannel',
      params: {
        channel_name: channel,
        value: this.channelValues[channel]
      }
    })
  }

  sendColorUpdate() {
    // Send a message to the helper asking it to update the color

    constCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setColor',
      params: {
        color: [this.channelValues['r'] || 0, this.channelValues['g'] || 0, this.channelValues['b'] || 0]
      }
    })
  }

  sendBrightnessUpdate() {
    // Send a message to the helper asking it to update the brightness

    constCommon.makeHelperRequest({
      method: 'POST',
      endpoint: '/DMX/fixture/' + this.uuid + '/setBrightness',
      params: {
        value: this.channelValues['dimmer'] || 0
      }
    })
  }

  createHTML(collectionName) {
    // Create the HTML representation for this fixture.
    // collectionName is the name of the universe/group/scene this HTML widget is being rendered for.

    const thisUUID = this.uuid

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-6 col-lg-4 mt-2'

    const row = document.createElement('div')
    row.classList = 'row mx-0'
    col.appendChild(row)

    const headerText = document.createElement('div')
    headerText.classList = 'col-8 fixture-header'
    headerText.innerHTML = this.name
    row.appendChild(headerText)

    const colorPickerCol = document.createElement('div')
    colorPickerCol.classList = 'col-4 px-0 mx-0'
    row.appendChild(colorPickerCol)

    const colorPicker = document.createElement('input')
    colorPicker.classList = 'coloris w-100'
    colorPicker.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'colorPicker')
    colorPicker.setAttribute('type', 'text')
    // colorPicker.setAttribute('data-coloris', true)
    colorPicker.value = 'rgb(255,255,255)'
    colorPicker.addEventListener('input', () => {
      onColorChangeFromPicker(collectionName, thisUUID)
    })
    colorPickerCol.appendChild(colorPicker)

    const expandMessage = document.createElement('div')
    expandMessage.classList = 'col-12 text-center fst-italic small'
    expandMessage.style.backgroundColor = '#28587B'
    expandMessage.innerHTML = 'Tap to expand'
    $(expandMessage).hide()
    row.appendChild(expandMessage)

    const row2 = document.createElement('div')
    row2.classList = 'row mx-0'
    col.appendChild(row2)

    this.channelList.forEach((channel) => {
      const channelCol = document.createElement('div')
      channelCol.classList = 'col-12 channel-entry py-1'
      row2.appendChild(channelCol)

      const channelRow = document.createElement('div')
      channelRow.classList = 'row'
      channelCol.appendChild(channelRow)

      const channelHeader = document.createElement('div')
      channelHeader.classList = 'col-12'
      channelHeader.innerHTML = channelNameToDisplayName(channel)
      channelRow.appendChild(channelHeader)

      const channelSliderCol = document.createElement('div')
      channelSliderCol.classList = 'col-8'
      channelRow.appendChild(channelSliderCol)

      const channelSlider = document.createElement('input')
      channelSlider.classList = 'form-range h-100'
      channelSlider.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'channelSlider_' + channel)
      channelSlider.setAttribute('type', 'range')
      channelSlider.setAttribute('min', 0)
      channelSlider.setAttribute('max', 255)
      channelSlider.setAttribute('step', 1)
      channelSlider.value = 0
      channelSlider.addEventListener('input', (e) => {
        onChannelSliderChange(collectionName, thisUUID, channel, parseInt(e.target.value))
      })
      channelSliderCol.appendChild(channelSlider)

      const channelValueCol = document.createElement('div')
      channelValueCol.classList = 'col-4 ps-0'
      channelRow.appendChild(channelValueCol)

      const channelValue = document.createElement('input')
      channelValue.classList = 'form-control text-center'
      channelValue.setAttribute('id', collectionName + '_fixture_' + this.uuid + '_' + 'channelValue_' + channel)
      channelValue.setAttribute('type', 'number')
      channelValue.setAttribute('min', 0)
      channelValue.setAttribute('max', 255)
      channelValue.value = 0
      channelValue.addEventListener('input', e => {
        onChannelValueChange(collectionName, thisUUID, channel, parseInt(e.target.value))
      })
      channelValueCol.appendChild(channelValue)
    })

    $([headerText, expandMessage]).click(() => {
      $(row2).slideToggle({ duration: 300, complete: () => { $(expandMessage).slideToggle(100) } })
    })

    return col
  }
}

class DMXFixtureGroup {
  // A mirror for the DMXFixtureGroup Python class.

  constructor(name) {
    this.name = name
    this.safeName = name.replaceAll(' ', '_').replaceAll('.', '_').replaceAll('#', '_')
    this.fixtures = {}
    this.scenes = {}
  }

  addFixtures(fixtures) {
    // Take an array of fixtures and add them to the group.

    fixtures.forEach((fixture) => {
      this.fixtures[fixture.name] = fixture
      if (!this.fixtures[fixture.name].groups.includes(this.name)) {
        this.fixtures[fixture.name].groups.push(this.name)
      }
    })
  }

  clearFixtures() {
    this.fixtures = {}
  }

  createScene(name, values) {
    // Create a new DMXScene and add it this this.scenes.

    this.scenes[name] = new DMXScene(name, values, this.name)
  }

  createHTML() {
    // Create the HTML representation for this group.

    const col = document.createElement('div')
    col.classList = 'col-12'

    const row1 = document.createElement('div')
    row1.classList = 'row bg-secondary mx-0 rounded-top'
    col.appendChild(row1)

    const nameCol = document.createElement('div')
    nameCol.classList = 'col-6 col-sm-8 h4 px-2 py-2 mb-0'
    nameCol.innerHTML = this.name
    row1.appendChild(nameCol)

    const editFixturesCol = document.createElement('div')
    editFixturesCol.classList = 'col-3 col-sm-2 align-self-center pe-1'
    row1.appendChild(editFixturesCol)

    const editFixturesButton = document.createElement('button')
    editFixturesButton.classList = 'btn btn-primary w-100'
    editFixturesButton.innerHTML = 'Edit fixtures'
    editFixturesButton.addEventListener('click', () => {
      showEditGroupModal(this.name)
    })
    editFixturesCol.appendChild(editFixturesButton)

    const addSceneCol = document.createElement('div')
    addSceneCol.classList = 'col-3 col-sm-2 align-self-center pe-1'
    row1.appendChild(addSceneCol)

    const addSceneButton = document.createElement('button')
    addSceneButton.classList = 'btn btn-primary w-100'
    addSceneButton.innerHTML = 'Create scene'
    addSceneButton.addEventListener('click', () => {
      showEditSceneModal("", this.name)
    })
    addSceneCol.appendChild(addSceneButton)

    const contentDiv = document.createElement('div')
    contentDiv.classList = 'px-1 pt-2 bg-secondary'
    col.appendChild(contentDiv)

    // Collapse the content div when the group's top bar is clicked.
    $(nameCol).click(() => {
      $(contentDiv).slideToggle(300)
    })

    const tabNav = document.createElement('nav')
    tabNav.classList = 'nav nav-tabs'
    contentDiv.appendChild(tabNav)

    const fixtureTab = document.createElement('a')
    fixtureTab.classList = 'nav-link active'
    fixtureTab.setAttribute('aria-current', 'page')
    fixtureTab.setAttribute('id', this.safeName + '_fixtureTab')
    fixtureTab.setAttribute('href', '#' + this.safeName + '_fixturePane')
    fixtureTab.setAttribute('data-bs-toggle', 'tab')
    fixtureTab.setAttribute('data-bs-target', '#' + this.safeName + '_fixturePane')
    fixtureTab.innerHTML = 'Fixtures'
    tabNav.appendChild(fixtureTab)

    const sceneTab = document.createElement('a')
    sceneTab.classList = 'nav-link'
    sceneTab.setAttribute('href', '#')
    sceneTab.setAttribute('id', this.safeName + '_sceneTab')
    sceneTab.setAttribute('href', '#' + this.safeName + '_scenePane')
    sceneTab.setAttribute('data-bs-toggle', 'tab')
    sceneTab.setAttribute('data-bs-target', '#' + this.safeName + '_scenePane')
    sceneTab.innerHTML = 'Scenes'
    tabNav.appendChild(sceneTab)

    const tabPaneContainer = document.createElement('div')
    tabPaneContainer.classList = 'tab-content'
    contentDiv.appendChild(tabPaneContainer)

    const fixturePane = document.createElement('div')
    fixturePane.classList = 'tab-pane active'
    fixturePane.setAttribute('id', this.safeName + '_fixturePane')
    fixturePane.setAttribute('role', 'tabpanel')
    fixturePane.setAttribute('aria-labelledby', this.safeName + '_fixturePane')
    fixturePane.setAttribute('tabindex', '0')
    tabPaneContainer.appendChild(fixturePane)

    const scenePane = document.createElement('div')
    scenePane.classList = 'tab-pane'
    scenePane.setAttribute('id', this.safeName + '_scenePane')
    scenePane.setAttribute('role', 'tabpanel')
    scenePane.setAttribute('aria-labelledby', this.safeName + '_SceneTab')
    scenePane.setAttribute('tabindex', '0')
    tabPaneContainer.appendChild(scenePane)

    // Add fixtures
    const fixtureRow = document.createElement('div')
    fixtureRow.classList = 'row'
    fixturePane.appendChild(fixtureRow)

    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      fixtureRow.appendChild(fixture.createHTML(this.safeName))
    })

    // Add scenes
    const sceneRow = document.createElement('div')
    sceneRow.classList = 'row'
    scenePane.appendChild(sceneRow)

    Object.keys(this.scenes).forEach((key) => {
      const scene = this.scenes[key]
      sceneRow.appendChild(scene.createHTML())
    })

    return col
  }

  getFixtureByName(name) {
    return this.fixtures[name]
  }

  getFixtureByUUID(uuid) {
    let matchedFixture = null
    Object.keys(this.fixtures).forEach((key) => {
      const fixture = this.fixtures[key]
      if (fixture.uuid === uuid) matchedFixture = fixture
    })
    return matchedFixture
  }

  getSceneByName(name) {
    let matchedScene = null
    Object.keys(this.scenes).forEach((key) => {
      const scene = this.scenes[key]
      if (scene.name === name) matchedScene = scene
    })
    return matchedScene
  }
  

  showScene(scene) {
    // Tell the helper to set the given scene.

    constCommon.makeHelperRequest({
      method: "POST",
      endpoint: '/DMX/group/' + this.name + '/showScene',
      params: {
        scene
      }
    })
  }
}

class DMXScene {
  // A mirror for the DMXScene Python class

  constructor(name, values, group=null) {
    this.name = name
    this.values = values
    this.group = group

  }

  createHTML() {
    // Create the HTML representation for this scene.

    const thisName = this.name
    const thisGroup = this.group

    const col = document.createElement('div')
    col.classList = 'col-12 col-sm-4 col-lg-3 mt-2'

    const topRow = document.createElement('div')
    topRow.classList = 'row'
    col.appendChild(topRow)

    const header = document.createElement('div')
    header.classList = 'col-12 text-center rounded-top fixture-header'
    header.innerHTML = this.name
    col.appendChild(header)

    const bottomRow = document.createElement('div')
    bottomRow.classList = 'row rounded-bottom mx-0 py-2 mb-2'
    bottomRow.style.backgroundColor = '#2D648B'
    col.appendChild(bottomRow)

    const runCol = document.createElement('div')
    runCol.classList = 'col-6'
    bottomRow.appendChild(runCol)

    const runButton = document.createElement('button')
    runButton.classList = 'btn btn-primary w-100'
    runButton.innerHTML = 'Run'
    runButton.addEventListener('click', function() {
      getGroupByName(thisGroup).showScene(thisName)
    })
    runCol.appendChild(runButton)

    const editCol = document.createElement('div')
    editCol.classList = 'col-6'
    bottomRow.appendChild(editCol)

    const editButton = document.createElement('button')
    editButton.classList = 'btn btn-info w-100'
    editButton.innerHTML = 'Edit'
    editCol.appendChild(editButton)

    return col
  }
}


function onColorChangeFromPicker(collectionName, uuid) {
  // When is a color is changed from the picker, update the interface to match.

  const newColor = $('#' + collectionName + '_fixture_' + uuid + '_' + 'colorPicker').val()
  // newColor is a string of format 'rgb(123, 123, 132)'
  const colorSplit = newColor.slice(4, -1).split(',')
  const red = parseInt(colorSplit[0])
  const green = parseInt(colorSplit[1])
  const blue = parseInt(colorSplit[2])

  // Set the sliders
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_r').val(red)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_g').val(green)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_b').val(blue)

  // Set the inputs
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_r').val(red)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_g').val(green)
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_b').val(blue)

  // Update the fixture and send a color change to the helper
  const fixture = getFixtureByUUID(uuid)
  fixture.setChannelValues({ 'r': red, 'g': green, 'b': blue })
  fixture.sendColorUpdate()
}

function onChannelSliderChange(collectionName, uuid, channel, value) {
  // When the slider changes, update the number field.
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelValue_' + channel).val(value)
  updatecolorPicker(collectionName, uuid)

  // Update the fixture and send a color change to the helper
  const fixture = getFixtureByUUID(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function onChannelValueChange(collectionName, uuid, channel, value) {
  // When the number box is changed, update the slider.
  $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_' + channel).val(value)
  // updatecolorPicker(collectionName, uuid)

  const fixture = getFixtureByUUID(uuid)
  const valueToUpdate = {}
  valueToUpdate[channel] = value
  fixture.setChannelValues(valueToUpdate)
  fixture.sendChannelUpdate(channel)
}

function updatecolorPicker(collectionName, uuid) {
  // Read the values from the number inputs and update the color picker

  const red = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_r').val()
  const blue = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_g').val()
  const green = $('#' + collectionName + '_fixture_' + uuid + '_' + 'channelSlider_b').val()
  const colorStr = 'rgb(' + red + ',' + blue + ',' + green + ')'

  // Update the input and the color of the parent div
  try {
    $('#' + collectionName + '_fixture_' + uuid + '_' + 'colorPicker').val(colorStr).closest('.clr-field')[0].style.color = colorStr
  }
  catch (TypeError) {
    // This will fail is the value is changed before the Coloris color picker is activated.
  }
}

function showAddFixtureModal(universe) {
  // Prepare the addFixtureModal and then show it.

  $('#addFixtureModal').data('universe', universe)

  $('#addFixtureName').val('')
  $('#addFixtureStartingChannel').val('')
  $('#addFixtureChannelList').empty()
  $('#addFixtureFromModalButton').hide()

  $('#addFixtureModal').modal('show')
}

function showEditGroupModal(groupName) {
  // Configure the edit group modal and show it

  const group = getGroupByName(groupName)

  $('#editGroupModal').data('group', groupName)
  $('#editGroupModalTitle').html('Edit ' + groupName)

  // Populate the list of fixtures
  const fixtureRow = $('#editGroupFixtureRow')
  fixtureRow.empty()
  universeList.forEach((universe) => {
    const header = document.createElement('div')
    header.classList = 'h5 col-12'
    header.innerHTML = universe.name
    fixtureRow.append(header)
    Object.keys(universe.fixtures).forEach((fixtureName) => {
      const fixture = universe.fixtures[fixtureName]

      fixtureRow.append(createFixtureCheckbox(fixture, group))
    })
  })

  $('#editGroupModal').modal('show')
}

function editGroupFromModal() {
  // Called when the Save button is pressed in the editGroupModal
  const group = getGroupByName($('#editGroupModal').data('group'))
  group.clearFixtures()
  const fixturesElements = $('#editGroupFixtureRow').find('.form-check-input ').toArray()

  let fixturesToAdd = []
  fixturesElements.forEach((element) => {
    if ($(element).prop('checked') === true) {
      const fixture = getFixtureByUUID($(element).data('uuid'))
      fixturesToAdd.push(fixture)
    }
  })

  group.addFixtures(fixturesToAdd)
  rebuildGroupsInterface()
  $('#editGroupModal').modal('hide')
}

function showEditSceneModal(sceneName, groupName) {
  // Configure the edit scene modal and show it

  const group = getGroupByName(groupName)
  const scene = group.getSceneByName(sceneName)
  $("#editSceneModal").data('group', group)
  
  $("#editSceneFixtureList").empty()
  Object.keys(group.fixtures).forEach((fixtureName) => {
    const fixture = group.getFixtureByName(fixtureName)
    $("#editSceneFixtureList").append(createFixtureCheckbox(fixture, scene))
  })

  $("#editSceneModal").modal('show')
}

function editSceneFromModal() {
  // Save the scene changse from the modal.

  const sceneName = $("#editSceneModalSceneName").val().trim()
  const duration = parseInt($("#editSceneModalDurationInput").val())
  const checkboxes = $("#editSceneFixtureList").find(".form-check-input").toArray()
  const groupName = $("#editSceneModal").data('group').name

  const sceneDict = {}
  checkboxes.forEach((box) => {
    if ($(box).prop('checked') === true) {
      const fixture = getFixtureByUUID($(box).data('uuid'))
      const values = fixture.channelValues
      values.duration = duration
      sceneDict[fixture.name] = values
    }
  })
  
  constCommon.makeHelperRequest({
    method: "POST",
    endpoint: '/DMX/group/' + groupName + '/createScene',
    params: {name: sceneName, values: sceneDict}
  })
  .then((result) => {
    if ("success" in result && result.success === true) {
      getGroupByName(groupName).createScene(sceneName, sceneDict)
      $("#editSceneModal").modal("hide")
    }
  })
  
}

function createFixtureCheckbox(fixture, collection=null) {
  // Return a column that holds a checkbox representing the fixture.
  // If 'collecion' is specified, the box will be checked if the fixture
  // is in 'collecion'

  const col = document.createElement('div')
  col.classList = 'col-3 my-1'

  const container = document.createElement('div')
  container.classList = 'form-check'
  col.appendChild(container)

  const check = document.createElement('input')
  check.classList = 'form-check-input'
  check.setAttribute('type', 'checkbox')
  check.setAttribute('id', 'editGroupFixture_' + fixture.uuid)
  check.value = ""

  if (collection != null && collection.getFixtureByUUID(fixture.uuid) != null) {
    check.setAttribute('checked', true)
  }

  $(check).data("uuid", fixture.uuid)
  container.appendChild(check)

  const label = document.createElement('label')
  label.class = 'form-check-label'
  label.setAttribute('for', 'editGroupFixture_' + fixture.uuid)
  label.innerHTML = fixture.name
  container.appendChild(label)

  return col
}

function addChannelToModal() {
  // Called when the Add channel button is pressed in the addFixtureModal.

  const col = document.createElement('div')
  col.classList = 'col-12 mt-1'

  const row = document.createElement('div')
  row.classList = 'row'
  col.appendChild(row)

  const selectCol = document.createElement('div')
  selectCol.classList = 'col-10'
  row.appendChild(selectCol)

  const select = document.createElement('select')
  select.classList = 'form-control'
  selectCol.appendChild(select)

  const options = [['Colors', ''], ['Amber', 'a'], ['Blue', 'b'], ['Green', 'g'], ['Red', 'r'], ['Ultraviolet', 'uv'], ['White', 'w'], ['Properties', ''], ['Brightness', 'dimmer'], ['Pan', 'pan'], ['Pan (fine)', 'pan_fine'], ['Strobe', 'strobe'], ['Tilt', 'tilt'], ['Tilt (fine)', 'tilt_fine'], ['Other', 'other']]

  options.forEach((entry) => {
    const option = document.createElement('option')
    option.innerHTML = entry[0]
    if (entry[1] === '') {
      option.setAttribute('disabled', true)
    } else {
      option.value = entry[1]
    }
    select.appendChild(option)
  })

  const deleteCol = document.createElement('div')
  deleteCol.classList = 'col-2 align-self-center'
  row.appendChild(deleteCol)

  const deleteButton = document.createElement('button')
  deleteButton.classList = 'btn btn-danger btn-sm'
  deleteButton.innerHTML = '\u2573'
  deleteButton.addEventListener('click', () => {
    $(col).remove()
    if ($('#addFixtureChannelList').children().length === 0) {
      $('#addFixtureFromModalButton').hide()
    }
  })
  deleteCol.appendChild(deleteButton)

  $('#addFixtureChannelList').append(col)
  $('#addFixtureFromModalButton').show()
}

function addFixtureFromModal() {
  // Collect the necessary information from the addFixtureModal and ask the helper to add the fixture.

  const channelList = []
  $('#addFixtureChannelList').children().each(function () { channelList.push($(this).find('select').val()) })

  const definition = {
    name: $('#addFixtureName').val(),
    start_channel: parseInt($('#addFixtureStartingChannel').val()),
    channels: channelList
  }
  console.log(definition)
}

function createUniverse(name, controller) {
  // Create a new universe and add it to the global list.

  const newUniverse = new DMXUniverse(name, controller)
  universeList.push(newUniverse)
  return newUniverse
}

function createGroup(name) {
  // Create a new universe and add it to the global list.

  const newGroup = new DMXFixtureGroup(name)
  groupList.push(newGroup)
  return newGroup
}

function channelNameToDisplayName(name) {
  // Take a name such as 'r' and convert it to the proper name to display.

  const nameDict = {
    a: 'Amber',
    b: 'Blue',
    g: 'Green',
    r: 'Red',
    uv: 'UV',
    w: 'White',
    color: 'Color',
    dimmer: 'Dimmer',
    mode: 'Mode',
    speed: 'Speed',
    strobe: "Strobe",
  }
  if (name in nameDict) {
    return nameDict[name]
  }
  return name
}

function updateFunc(update) {
  // Read updates for media player-specific actions and act on them

  if ('commands' in update) {
    for (let i = 0; i < update.commands.length; i++) {
      const cmd = (update.commands)[i]
    }
  }

  // This should be last to make sure the path has been updated
  if ('content' in update) {
    // console.log(update.content)
  }
}

function getUniverseByName(name) {
  let matchedUniverse = null
  universeList.forEach((universe) => {
    if (universe.name === name) {
      matchedUniverse = universe
    }
  })
  return matchedUniverse
}


function getGroupByName(name) {
  let matchedGroup = null
  groupList.forEach((group) => {
    if (group.name === name) {
      matchedGroup = group
    }
  })
  return matchedGroup
}

function getFixtureByUUID(uuid) {
  let matchedFixture = null
  universeList.forEach(universe => {
    const fixture = universe.getFixtureByUUID(uuid)
    if (fixture != null) matchedFixture = fixture
  })
  return matchedFixture
}

function getDMXStatus() {
  // Ask the helper for the latest status for each fixture.

  constCommon.makeHelperRequest({
    method: "GET",
    endpoint: "/DMX/getStatus"
  })
    .then((response) => {
      Object.keys(response.status).forEach((key) => {
        const update = response.status[key]
        const fixture = getFixtureByUUID(key)
        fixture.setChannelValues(update)
        fixture.updateGUI()
      })
    })
}

function getDMXConfiguration() {
  // Ask the helper for the current DMX configuration and update the interface.

  let configuration

  constCommon.makeHelperRequest({
    method: 'GET',
    endpoint: '/DMX/getConfiguration'
  })
    .then((response) => {
      configuration = response.configuration
      configuration.universes.forEach((universeDef) => {
        // First, create the universe
        const universeObj = createUniverse(universeDef.name, universeDef.controller)
        // Then, loop the fixtures and add each.
        universeDef.fixtures.forEach((fixture) => {
          universeObj.addFixture(fixture)
        })
      })
      rebuildUniverseInterface()
    })
    .then(() => {
      configuration.groups.forEach((groupDef) => {
        // First, create the group
        const groupObj = createGroup(groupDef.name)
        // Then, add fixtures and scenes
        groupDef.fixtures.forEach((fixtureDef) => {
          const fixture = getFixtureByUUID(fixtureDef.uuid)
          groupObj.addFixtures([fixture])
        })
        groupDef.scenes.forEach((sceneDef) => {
          groupObj.createScene(sceneDef.name, sceneDef.values)
        })
      })
      rebuildGroupsInterface()
    })
    .then(() => {
      getDMXStatus()
    })

}

function rebuildUniverseInterface() {
  // Take the list of universes and add the HTML representation of each.
  $('#noUniverseWarning').hide()
  $('#universeRow').empty()
  universeList.forEach(universe => {
    $('#universeRow').append(universe.createHTML())
    // Then, bind the color picker to each element.
    Object.keys(universe.fixtures).forEach(fixtureName => {
      const fixture = universe.fixtures[fixtureName]
      Coloris({
        alpha: false,
        theme: 'pill',
        themeMode: 'dark',
        format: 'rgb',
        el: '#' + universe.safeName + '_fixture_' + fixture.uuid + '_' + 'colorPicker',
        wrap: true
      })
    });
  })
}

function rebuildGroupsInterface() {
  // Take the list of group and add the HTML representation of each.

  $('#noGroupsWarning').hide()
  $('#groupsRow').empty()
  groupList.forEach(group => {
    $('#groupsRow').append(group.createHTML())
    // Then, bind the color picker to each element.
    Object.keys(group.fixtures).forEach(fixtureName => {
      const fixture = group.fixtures[fixtureName]
      Coloris({
        alpha: false,
        theme: 'pill',
        themeMode: 'dark',
        format: 'rgb',
        el: '#' + group.safeName + '_fixture_' + fixture.uuid + '_' + 'colorPicker',
        wrap: true
      })
    });
  })
}

function testSetup() {
  // Temporary function to test things during development.

  const universe = createUniverse('Main', 'OpenDMX')
  const leftFix = universe.addFixture({
    name: 'Left',
    start_channel: 1,
    channels: ['Strobe', 'r', 'g', 'b'],
    uuid: '8ec4979f-38d8-4a5b-b013-f3ebb90985cc'
  })
  const middleFix = universe.addFixture({
    name: 'Middle',
    start_channel: 6,
    channels: ['r', 'g', 'b', 'w'],
    uuid: '2'
  })
  const rightFix = universe.addFixture({
    name: 'Right',
    start_channel: 10,
    channels: ['r', 'g', 'b', 'w'],
    uuid: '3'
  })
  const topFix = universe.addFixture({
    name: 'Top',
    start_channel: 14,
    channels: ['r', 'g', 'b', 'w', 'X_rotate', 'Y_rotate'],
    uuid: '4'
  })

  const testGroup = createGroup('Test Group')
  testGroup.addFixtures([leftFix, rightFix])

  $('#noUniverseWarning').hide()
  $('#noGroupsWarning').hide()
  rebuildUniverseInterface()
  rebuildGroupsInterface()
}

// Add event listeners
// Universe tab
$('#addFixtureAddChannelButton').click(addChannelToModal)
$('#addFixtureFromModalButton').click(addFixtureFromModal)

// Group tab
$('#editGroupModalSaveButton').click(editGroupFromModal)
$("#editSceneModalSaveButton").click(editSceneFromModal)

constCommon.config.updateParser = updateFunc // Function to read app-specific updatess
constCommon.config.constellationAppID = 'dmx_control'

const universeList = []
const groupList = []

constCommon.config.debug = true

constCommon.config.helperAddress = window.location.origin

constCommon.askForDefaults()
constCommon.sendPing()

setInterval(constCommon.sendPing, 5000)
setInterval(constCommon.checkForHelperUpdates, 5000)

// testSetup()
getDMXConfiguration()
setInterval(getDMXStatus, 5000)
