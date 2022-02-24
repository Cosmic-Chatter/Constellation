/*jshint esversion: 6 */

function sleepDisplay() {

  // Send a message to the local helper process and ask it to sleep the
  // displays

  let requestDict = {
    "action": "sleepDisplay"
  };
  let requestString = JSON.stringify(requestDict);

  let xhr = new XMLHttpRequest();
  xhr.timeout = 1000;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
    }
};
  xhr.send(requestString);
}

function wakeDisplay() {

  // Send a message to the local helper process and ask it to sleep the
  // displays

  let requestDict = {
    "action": "wakeDisplay"
  };
  let requestString = JSON.stringify(requestDict);

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
    }
};
  xhr.send(requestString);
}

function commandProjector(cmd) {

  // Send a message to the local helper process to control the projector

  let requestDict = {
    "action": "commandProjector",
    "command": cmd
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=commandProjector&command=${cmd}`;

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
    }
};
  xhr.send(requestString);
}

function readUpdate(responseText) {

  // Function to read a message from the server and take action based
  // on the contents

  var update = JSON.parse(responseText);

  if ('commands' in update) {
    for (var i=0; i<update.commands.length; i++) {
      var cmd = (update.commands)[i];

      if (cmd == "sleepDisplay") {
        sleepDisplay();
      } else if (cmd == "wakeDisplay") {
        wakeDisplay();
      } else if (cmd == "refresh_page") {
          location.reload();
      } else if (cmd == "restart") {
        askForRestart();
      } else if (cmd == "shutdown") {
        askForShutdown();
      } else {
        console.log(`Command not recognized: ${cmd}`);
      }
    }
  }
  if ("id" in update) {
    id = update.id;
  }
  if ("type" in update) {
    type = update.type;
  }
  if (("server_ip_address" in update) && ("server_port" in update)) {
    serverAddress = "http://" + update.server_ip_address + ":" + update.server_port;
  }
  if ("sos_address" in update) {
    sosAddress = "http://" + update.sos_address;
  }
  if ("dictionary" in update) {
    dictionary = update.dictionary.CURRENT;
  }
  if ("allow_restart" in update) {
    allowedActionsDict.restart = update.allow_restart;
  }
  if ("allow_shutdown" in update) {
    allowedActionsDict.shutdown = update.allow_shutdown;
  }
  if ("anydesk_id" in update) {
    AnyDeskID = update.anydesk_id;
  }
}

function changeMedia(source) {

  var video = document.getElementById("fullscreenVideo");
  var videoContainer = document.getElementById("videoOverlay");
  var image = document.getElementById("fullscreenImage");
  var imageContainer = document.getElementById("imageOverlay");

  // Split off the extension
  var split = source.split(".");
  var ext = split[split.length-1];

  if (["mp4", "mpeg", "m4v", "webm", "mov", "ogg"].includes(ext.toLowerCase())) {
    video.pause();
    video.src = source;
    video.load();
    video.play();
    videoContainer.style.opacity = 1;
    imageContainer.style.opacity = 0;
  } else if (["png", "jpg", "jpeg", "tiff", "bmp", "heic", "webp"].includes(ext.toLowerCase())) {
    video.pause();
    videoContainer.style.opacity = 0;
    image.src = source;
    imageContainer.style.opacity = 1;
  }

}

function askForDefaults() {

  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  let requestDict = {
    "action": "getDefaults"
  };
  let requestString = JSON.stringify(requestDict);

  let checkAgain = function() {
    console.log("Could not get defaults... checking again");
    setTimeout(askForDefaults, 500);
  };

  let xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
  xhr.ontimeout = checkAgain;
  xhr.onerror = checkAgain;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      readUpdate(this.responseText);
    }
};
  xhr.send(requestString);
}

function askForRestart() {

  // Send a message to the local helper and ask for it to restart the PC

  var requestString = JSON.stringify({"action": "restart"});

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function askForShutdown() {

  // Send a message to the local helper and ask for it to shutdown the PC

  var requestString = JSON.stringify({"action": "shutdown"});

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function sendPing() {

  // Contact the control server and ask for any updates

  if (serverAddress != "") {
    requestDict = {"class":"exhibitComponent",
                   "id": id,
                   "type": type,
                   "allowed_actions": allowedActionsDict,
                   "AnyDeskID": AnyDeskID};

    if (errorString != null) {
      requestDict.error = errorString;
    }
    requestString = JSON.stringify(requestDict);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", serverAddress, true);
    xhr.timeout = 1000;
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onerror = function() {
    };
    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {
        readUpdate(this.responseText);
      }
  };
    xhr.send(requestString);
  }
}

function showDefaultImage() {

  var img = document.getElementById("fullscreenImage");

  // Make sure we don't go into an infinite loop
  if (img.src != 'playlists/default/default.jpeg') {
    changeMedia('playlists/default/default.jpeg');
  }
}

function pollSOS() {

  // Function to ask SOS for the current dataset and switch the displayed
  // media based on the response.

  let requestDict = {
    "action": "SOS_getCurrentClipName"
  };
  let requestString = JSON.stringify(requestDict);
  // requestString = `action=SOS_getCurrentClipName`;

  let xhr = new XMLHttpRequest();
  xhr.open("POST", sosAddress, true);
  xhr.timeout = 1000;

  let errorFunc = function() {
    if (pollSOSErrorTicks > 1) {
      if (currentObject != null) {
        changeMedia("playlists/default/" + dictionary["default"]);
      }
      currentObject = null;
      errorString = "SOS connection offline";
    }
    pollSOSErrorTicks += 1;
  };
  xhr.onerror = errorFunc;
  xhr.ontimeout = errorFunc;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      pollSOSErrorTicks = 0;
      if (this.response != currentObject) {
        var filename = "";
        if (this.response in dictionary) {
          filename = dictionary[this.response];
        } else {
          filename = dictionary["default"];
        }

        changeMedia("playlists/default/" + filename);
        currentObject = this.response;
        errorString = null;
      }

    }
  };
  xhr.send(requestString);
}
