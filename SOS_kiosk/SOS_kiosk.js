/*jshint esversion: 6 */

function handleTouchEnd(event) {

  config.lastTouchX = null;
  config.lastTouchY = null;
}

function handleTouchMove(event) {

  // Called when the user slides their finger over the sphere control panel

  // Keep the page from scrolling when we're using the touchpad
  event.preventDefault();

  resetActivityTimer();

  var touchX = event.changedTouches[0].pageX;
  var touchY = event.changedTouches[0].pageY;

  if (config.lastTouchX != null) {
    var dX = touchX - config.lastTouchX;
    var dY = touchY - config.lastTouchY;

    // Send the movement to the server to pass on to SOS
    var requestDict = {
      "action": "SOS_moveSphere",
      "dLon": dX,
      "dLat": dY
    };
    // requestString = `action=SOS_moveSphere&dLon=${dX}&dLat=${dY}`;
    let requestString = JSON.stringify(requestDict);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", helperIP, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(requestString);
  }
  config.lastTouchX = touchX;
  config.lastTouchY = touchY;
}

function rotateSphereZ(increment) {

  // Function to ask the helper to rotate the sphere by the given amount

  resetActivityTimer();

  // Send the movement to the server to pass on to SOS
  var requestDict = {
    "action": "SOS_rotateZ",
    "increment": increment
  };
  // requestString = `action=SOS_rotateZ&increment=${increment}`;
  let requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.timeout = 25;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function rotateSphereY(increment) {

  // Function to ask the helper to rotate the sphere by the given amount

  resetActivityTimer();

  // Send the movement to the server to pass on to SOS
  let requestDict = {
    "action": "SOS_rotateY",
    "increment": increment
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=SOS_rotateY&increment=${increment}`;

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.timeout = 25;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function rotateForward() {

  // Move the sphere about the Z axis a small amount.

  rotateSphereZ(1);
}

function rotateBack() {

  // Move the sphere about the Z axis a small amount.

  rotateSphereZ(-1);
}

function rotateUp() {

  // Move the sphere about the Z axis a small amount.

  rotateSphereY(-1);
}

function rotateDown() {

  // Move the sphere about the Z axis a small amount.

  rotateSphereY(1);
}

function stopRotation() {

  clearInterval(rotationTimer);
}

function startRotateForward() {

  stopRotation();
  rotateForward();
  rotationTimer = setInterval(rotateForward, 15);
}

function startRotateBack() {

  stopRotation();
  rotateBack();
  rotationTimer = setInterval(rotateBack, 15);
}

function startRotateUp() {

  stopRotation();
  rotateUp();
  rotationTimer = setInterval(rotateUp, 15);
}

function startRotateDown() {

  stopRotation();
  rotateDown();
  rotationTimer = setInterval(rotateDown, 15);
}

function askForDefaults() {

  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  let requestDict = {
    "action": "getDefaults"
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=getDefaults`;

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      readUpdate(this.responseText);
    }
};
  xhr.send(requestString);
}

function readUpdate(responseText) {

  // Function to read a message from the server and take action based
  // on the contents

  var update = JSON.parse(responseText);

  if ("kiosk_id" in update) {
    id = update.kiosk_id;
  }
  if ("kiosk_type" in update) {
    type = update.kiosk_type;
  }
  if (("server_ip_address" in update) && ("server_port" in update)) {
    serverAddress = "http://" + update.server_ip_address + ":" + update.server_port;
  }
  if ("dictionary" in update) {
    dictionary = update.dictionary;
  }
  if ('commands' in update) {
    for (var i=0; i<update.commands.length; i++) {
      let cmd = update.commands[i];

      if (cmd == "refresh_page") {
          location.reload();
      }
    }
  }
}

function sendPing() {

  // Contact the control server and ask for any updates

  if (serverAddress != "") {

    let requestDict = {
      "class": "exhibitComponent",
      "id": id,
      "type": type,
      "currentInteraction": String(currentlyActive),
      "allowed_actions": {"refresh": "true"}
    };
    let requestString = JSON.stringify(requestDict);
    // requestString = `class=exhibitComponent&id=${id}&type=${type}`;

    var xhr = new XMLHttpRequest();
    xhr.open("POST", serverAddress, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onerror = function() {
    };
    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {
        // console.log("Ping response received")
        readUpdate(this.responseText);
      }
  };
    xhr.send(requestString);
    // console.log("Ping sent")
  }
}

function showCardRow() {

  $("#cardRow").show();
  $("#timeoutMessage").hide();
}

function hideCardRow() {

  $("#cardRow").hide();
  $("#timeoutMessage").show();
  updateTimeoutDisplay(selectionTimeoutLength, iterate=true);
}

function updateTimeoutDisplay(number, iterate=false) {

  // Function to change the number displayed in the timeout

  $("#timeoutSecondsDisplay").html(number);

  if (iterate) {
    if (number > 0) {
      let temp = function() {
        updateTimeoutDisplay(number-1, iterate=true);
      };
      setTimeout(temp, 1000);
    } else {
      showCardRow();
    }
  }
}

function selectClip(clipNumber) {

  // Called when someone taps on a card on the interface. If the tap is valid
  // and allowed, pass the request on to gotoClip

  resetActivityTimer();

  if (checkForSelectionTimeout()) {
    gotoClip(clipNumber);
    timeOfLastSelection = new Date();
    hideCardRow();
    setTimeout(showCardRow, selectionTimeoutLength*1000);
  } else {
    console.log("Please wait", secondsToSelectionTimeoutExpiration(),"more seconds to make a selection.");
  }
}

function gotoClip(clipNumber) {

  // Send a command to the helper to tell SOS to go to the specified clip.

  resetActivityTimer();

  if (config.block == false) {
    config.clip_number = clipNumber;
    $(".card").removeClass("bg-primary");
    $("#card"+clipNumber).addClass("bg-primary");
    $("#attractorDatasetName").html($("#cardName"+clipNumber).html());

    requestString = `action=SOS_gotoClip&clipNumber=${clipNumber}`;

    let xhr = new XMLHttpRequest();
    xhr.open("POST", helperIP, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {

      }
  };
    xhr.send(requestString);
    config.block = true;
    setTimeout(function() {config.block = false;}, 2000);
  } else console.log("Touch blocked");

}

function createCard(name, number, icon) {

  // Create a card that holds one dataset

  // Try to look up a public-facing name for the dataset
  if (dictionary != null) {
    if (name in dictionary) {
      name = dictionary[name];
    }
  }

  var html = `
    <div class='col-12 col-md-6 col-lg-4 col-xl-3 mt-3'>
      <div id="card${number}" class="card w-100 h-100" onclick="selectClip(${number})">
          <img class='card-img-top' src="thumbnails/${icon}"></img>
          <div class="card-body">
            <center><h3 id="cardName${number}" class="card-title">${name}</h3></center>
        </div>
      </div>
    </div>
  `;
  $("#cardRow").append(html);
}

function rebuildInterface() {

  // Repopulate the clip buttons in response to a change in playlist

  // Retreive the new clip list
  requestString = `action=SOS_getClipList`;

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onerror = function() {
  };
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      $("#cardRow").empty();
      var clipList = JSON.parse(this.responseText);
      for (var i=0; i<clipList.length; i++) {
        clip = clipList[i];

        createCard(clip.name, clip.clipNumber, clip.icon);
      }
      $("#card" + config.clip_number).addClass("bg-primary");
    }
};
  xhr.send(requestString);
}

function getSOSState() {

  let requestDict = {
    "action": "SOS_getState"
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=SOS_getState`;

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onerror = function() {
  };
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      var state_dict = JSON.parse(this.responseText);
      var keys = Object.keys(state_dict);

      for (var i=0;i<keys.length;i++) {
        key = keys[i];
        if (key in config) {
          if (key == 'playlist_name') {
            if (config[key] != state_dict[key]) {
              console.log("New playlist detected");
              config[key] = state_dict[key];
              rebuildInterface();
            }
          } else if (key == 'clip_number') {
            if (config[key] != state_dict[key]) {
              console.log("New active clip detected");
              config[key] = state_dict[key];
              $(".card").removeClass("bg-primary");
              $("#card"+config[key]).addClass("bg-primary");
              $("#attractorDatasetName").html($("#cardName"+config[key]).html());
            }
          } else if (key == 'frame_number') {
            // Calculate the approximate time left in the clip
            let n = Number(state_dict.frame_number);
            let n_tot = Number(state_dict.frame_count);
            let fps_triple = state_dict["frame_rate "].split(" "); // That extra space is on purpose
            let fps = Number(fps_triple[0]);

            config.secondsToNextClip = (n_tot - n)/fps;
          }
        } else {
          config[key] = state_dict[key];
        }
      }
    }
};
  xhr.send(requestString);
}

function checkForSelectionTimeout() {

  // Check to see if enough time has passed to allow another selection to be made

  var now = new Date();

  if ((now - timeOfLastSelection)/1000 > selectionTimeoutLength){
    return true;
  } else {
    return false;
  }
}

function secondsToSelectionTimeoutExpiration() {

  // Calculate how many seconds until we can make another selecetion

  var now = new Date();
  var seconds = selectionTimeoutLength - (now - timeOfLastSelection)/1000;

  if (seconds <= 0) {
    return 0;
  } else {
    return Math.round(seconds);
  }
}

function showAttractor() {

  // Make the attractor layer visible and start autorun

  $("#attractorOverlay").show();
  currentlyActive = false;

  startAutorun = function() {
    requestString = `action=SOS_startAutorun`;
    var xhr = new XMLHttpRequest();
    xhr.open("POST", helperIP, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(requestString);
  };
  autorunScheduler = setTimeout(startAutorun, (config.secondsToNextClip - 2.5)*1000 );
}

function hideAttractor() {

  // Make the attractor layer invisible and start the autorun

  $("#attractorOverlay").hide();
  currentlyActive = true;
  clearTimeout(autorunScheduler);
  resetActivityTimer();

  let requestDict = {
    "action": "SOS_stopAutorun"
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=SOS_stopAutorun`;
  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperIP, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function resetActivityTimer() {

  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAttractor, 30000);
}

// These will be replaced by the values specified in defaults.ini
var id = 'SOS-KIOSK';
var type = 'KIOSK';
var serverAddress = ""; // The address of the main control server
var source = "";
var dictionary = null;
var autorunScheduler = null; // Will hold a reference to a setTimeout object that handles starting autorun gracefully.
var currentlyActive = false

var timeOfLastSelection = new Date('2020-01-01'); // Updated every time someone selects a new dataset
var selectionTimeoutLength = 10; // How many seconds must pass before someone can select a new dataset

// Event listeners for when the rotation buttons are pressed
var rotationTimer = null; // Will hold a reference to a setInterval
var forwardButton = document.getElementById("rotateForwardButton");
var backButton = document.getElementById("rotateBackButton");
var upButton = document.getElementById("rotateUpButton");
var downButton = document.getElementById("rotateDownButton");

forwardButton.addEventListener('touchstart', startRotateForward);
forwardButton.addEventListener('touchend', stopRotation);
forwardButton.addEventListener('mousedown', startRotateForward);
forwardButton.addEventListener('mouseup', stopRotation);

backButton.addEventListener('touchstart', startRotateBack);
backButton.addEventListener('touchend', stopRotation);
backButton.addEventListener('mousedown', startRotateBack);
backButton.addEventListener('mouseup', stopRotation);

upButton.addEventListener('touchstart', startRotateUp);
upButton.addEventListener('touchend', stopRotation);
upButton.addEventListener('mousedown', startRotateUp);
upButton.addEventListener('mouseup', stopRotation);

downButton.addEventListener('touchstart', startRotateDown);
downButton.addEventListener('touchend', stopRotation);
downButton.addEventListener('mousedown', startRotateDown);
downButton.addEventListener('mouseup', stopRotation);

config = {'playlist_name': null,
          'clip_number': null,
          'secondsToNextClip': 100000,
          'block': false,
          'lastTouchX': null,
          'lastTouchY': null};

askForDefaults();
sendPing();
setInterval(sendPing, 5000);
rebuildInterface();
var inactivityTimer = null;
resetActivityTimer();
setInterval(getSOSState, 2000);
