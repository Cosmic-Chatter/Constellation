/*jshint esversion: 6 */

function checkForSoftwareUpdate() {

  var xhr = new XMLHttpRequest();
  xhr.timeout = 2000;
  xhr.open('GET', 'https://raw.githubusercontent.com/FWMSH/Constellation/main/media_player/version.txt', true);
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      if(parseFloat(this.responseText) > SOFTWARE_VERSION) {
        errorDict.softwareUpdateAvailable = "true";
      }
    }
  };
  xhr.send(null);
}

function sleepDisplay() {

  // Send a message to the local helper process and ask it to sleep the
  // displays

  var requestString = JSON.stringify({"action": "sleepDisplay"});

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
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

  var requestString = JSON.stringify({"action": "wakeDisplay"});

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
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
  sendConfigUpdate(update); // Send to helper to update the default config

  if ('commands' in update) {
    for (var i=0; i<update.commands.length; i++) {
      var cmd = (update.commands)[i];

      if (cmd == "restart") {
        askForRestart();
      } else if (cmd == "shutdown" || cmd == "power_off") {
        askForShutdown();
      } else if (cmd == "sleepDisplay") {
          sleepDisplay();
      } else if (cmd == "wakeDisplay" || cmd == "power_on") {
          wakeDisplay();
      } else if (cmd == "refresh_page") {
        if ("refresh" in allowedActionsDict && allowedActionsDict.refresh == "true") {
          location.reload();
        }
      } else if (cmd == "reloadDefaults"){
          askForDefaults();
      } else if (cmd.startsWith("gotoClip")) {
          var clipNumber = cmd.split("_")[1];
          gotoSource(clipNumber);
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
  if ("helperAddress" in update) {
    helperAddress = update.helperAddress;
  }
  if ("contentPath" in update) {
    contentPath = update.contentPath;
  }
  if ("current_exhibit" in update) {
    if (currentExhibit != update.current_exhibit) {
      currentExhibit = update.current_exhibit;
      updateSourceList(true);
    }
  }
  if ("missingContentWarnings" in update) {
    errorDict.missingContentWarnings = update.missingContentWarnings;
  }
  if ("allow_sleep" in update) {
    allowedActionsDict.sleep = update.allow_sleep;
  }
  if ("allow_restart" in update) {
    allowedActionsDict.restart = update.allow_restart;
  }
  if ("allow_shutdown" in update) {
    allowedActionsDict.shutdown = update.allow_shutdown;
  }
  if ("helperSoftwareUpdateAvailable" in update) {
    if (update.helperSoftwareUpdateAvailable == "true")
    errorDict.helperSoftwareUpdateAvailable = "true";
  }
  if ("anydesk_id" in update) {
    AnyDeskID = update.anydesk_id;
  }

  // This should be last to make sure the path has been updated
  // if ("content" in update) {
  //   if (arraysEqual(sourceList, update.content) == false) {
  //     sourceList = update.content;
  //     gotoSource(0);
  //   }
  // }
}

function seekVideoByFraction(direction, fraction) {

  // Seek to a point in the video given by the options.

  var video = document.getElementById("fullscreenVideo");

  var timeToGoTo;
  if (direction == "back") {
    timeToGoTo = video.currentTime - fraction*video.duration;
  } else if (direction == "forward") {
    timeToGoTo = video.currentTime + fraction*video.duration;
  }
  // Handle boundaries
  if (timeToGoTo < 0) {
    timeToGoTo += video.duration;
  } else if (timeToGoTo > video.duration) {
    timeToGoTo -= video.duration;
  }
  video.currentTime = timeToGoTo;
}

function arraysEqual(arr1, arr2) {

  // Function to check if two arrays have the same elements in the same order

  if (arr1.length != arr2.length) {
    return false;
  } else {
    for (var i=0; i<arr1.length; i++) {
      if (arr1[i] != arr2[i]) {
        return false;
      }
    }
    return true;
  }
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

function askForDefaults() {

  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  var requestString = JSON.stringify({"action": "getDefaults"});

  let checkAgain = function() {
    $("#helperConnectionWarningAddress").text(helperAddress);
    $("#helperConnectionWarning").show();
    console.log("Could not get defaults... checking again");
    setTimeout(askForDefaults, 500);
  };
  let xhr = new XMLHttpRequest();
  xhr.timeout = 2000;
  xhr.onerror = checkAgain;
  xhr.ontimeout = checkAgain;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      $("#helperConnectionWarning").hide();
      readUpdate(this.responseText);

    }
  };
  xhr.send(requestString);
}

function sendPing() {

  // Contact the control server and ask for any updates

  if (serverAddress != "") {
    requestDict = {"class": "exhibitComponent",
                   "id": id,
                   "type": type,
                   "helperPort": helperAddress.split(":")[2], // Depreciated
                   "helperAddress": helperAddress,
                   "allowed_actions": allowedActionsDict,
                   "AnyDeskID": AnyDeskID};

    // See if there is an error to report
    let errorString = JSON.stringify(errorDict);
    if (errorString != "") {
      requestDict.error = errorString;
    }
    requestString = JSON.stringify(requestDict);

    var xhr = new XMLHttpRequest();
    xhr.open("POST", serverAddress, true);
    xhr.timeout = 2000;
    xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {
        readUpdate(this.responseText);
      }
  };
    xhr.send(requestString);
  }
}

function updateSourceList(first=false) {

  // Function to ask the helper for any new updates, like switching between
  // media clips

  var requestString = JSON.stringify({"action": "getAvailableContent"});

  var xhr = new XMLHttpRequest();
  xhr.timeout = 2000;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      let content = JSON.parse(this.responseText);
      sourceList = content.all_exhibits.filter(file => file.startsWith(currentExhibit))
                                       .sort(function (a, b) {
                                              return a.localeCompare(b);
                                            })
      sourceListLength = sourceList.length;
      if (first) {
        activeSourceIndex = 0;
        displayImage(sourceList[0])
        if (continueAnimating) {
          animateTimelapse();
        }
      }
    }
};
  xhr.send(requestString);

}

function sendConfigUpdate(update) {

  // Send a message to the helper with the latest configuration to set as
  // the default

  var requestDict = {"action": "updateDefaults"};

  if ("content" in update) {
    requestDict.content = update.content;
  }
  if ("current_exhibit" in update) {
    requestDict.current_exhibit = update.current_exhibit;
  }

  var xhr = new XMLHttpRequest();
  xhr.timeout = 1000;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(JSON.stringify(requestDict));
}


function handleTouchStart(event, touch=true) {

  hideAttractor();

  if (touch) {
    touchStartX = event.touches[0].clientX;
  } else {
    // Mouse input
    touchStartX = event.clientX;
    currentClick = true;
  }
}

function handleTouchEnd(event) {

  lastTouchX = null;
  currentClick = false;
}

function handleTouchMove(event, touch=true) {

  let pos;
  let dx;
  let dist;
  if (touch) {
    pos = event.touches[0].clientX;
  } else {
    // Mouse input
    if (currentClick) {
      pos = event.clientX;
    } else {
      return
    }
  }

  if (lastTouchX != null) {

    dx = pos - lastTouchX;
    dist = Math.abs(pos - touchStartX);

    if (dist > window.innerWidth/25) {
      // Advance the image and reset the starting point.
      touchStartX = pos;

      let touchVelocity = Math.abs(1000*dx/window.innerWidth);

      let sourceIncrement;
      if (touchVelocity < 10) {
        // Slow touch
        if (sourceListLength < 100) {
          sourceIncrement = 1;
        } else if (sourceListLength < 1000) {
          sourceIncrement = 2;
        } else if (sourceListLength < 3000) {
          sourceIncrement = 3;
        } else {
          sourceIncrement = 4;
        }
      } else if (touchVelocity < 30) {
        if (sourceListLength < 600) {
          sourceIncrement = 3;
        } else {
          sourceIncrement = Math.round(sourceListLength/300);
        }
      } else {
        if (sourceListLength < 1000) {
          sourceIncrement = 10;
        } else {
          sourceIncrement = Math.round(sourceListLength/100);
        }
      }
      if (stopInput == false) {
        if (dx > 0) {
          changeSource(sourceIncrement);
        } else {
          changeSource(-1*sourceIncrement);
        }
      }
    }
  }
  lastTouchX = pos;
}

function handleScroll(event) {

  // Cycle the images when a user scrolls the mouse scroll wheel.

  hideAttractor();

  let dx = event.wheelDelta;
  let velocity = Math.abs(dx);

  let sourceIncrement;
  if (velocity < 500) {
    // Slow scroll
    if (sourceListLength < 100) {
      sourceIncrement = 1;
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2;
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3;
    } else {
      sourceIncrement = 4;
    }
  } else {
    if (sourceListLength < 1000) {
      sourceIncrement = 10;
    } else {
      sourceIncrement = Math.round(sourceListLength/100);
    }
  }
  if (stopInput == false) {
    if (dx < 0) {
      changeSource(sourceIncrement);
    } else {
      changeSource(-1*sourceIncrement);
    }
  }
}

function handleKeyDown(event) {

  // Listen for arrow keys and switch images accordingly

  hideAttractor();

  let key = event.key;
  let repeated = event.repeat

  if (repeated == false) {
    // Single press
    if (sourceListLength < 100) {
      sourceIncrement = 1;
    } else if (sourceListLength < 1000) {
      sourceIncrement = 2;
    } else if (sourceListLength < 3000) {
      sourceIncrement = 3;
    } else {
      sourceIncrement = 4;
    }
  } else {
    if (sourceListLength < 1600) {
      sourceIncrement = 8;
    } else {
      sourceIncrement = Math.round(sourceListLength/200);
    }
  }
  if (stopInput == false) {
    if (["ArrowRight", "ArrowUp"].includes(key)) {
      changeSource(sourceIncrement);
    } else if (["ArrowLeft", "ArrowDown"].includes(key)) {
      changeSource(-1*sourceIncrement);
    }
  }
}

function loadImage(url) {

  // Use a promise to load the given image

  stopInput = true;

  return new Promise(resolve => {
    const image = new Image();

    image.addEventListener('load', () => {
      resolve(image);
    });
    image.src = url;
  });
}

function displayImage(file) {

  // Handle switching the src on the appropriate image tag to `file`.

  let viewerToHide, viewerToShow;
  if (activeViewerIndex == 0) {
    activeViewerIndex = 1;
    loadImage('content/' + file).then(newImage => {
      viewerList[1].src = newImage.src;
      viewerList[1].style.display = "block";
      viewerList[0].style.display = "none";
      stopInput = false;
    });
  } else {
    activeViewerIndex = 0;
    loadImage('content/' + file).then(newImage => {
      viewerList[0].src = newImage.src;
      viewerList[0].style.display = "block";
      viewerList[1].style.display = "none";
      stopInput = false;
    });
  }
}

function changeSource(dist) {

  // Advance through the sourceList by the number `dist` and

  activeSourceIndex += dist;
  if (activeSourceIndex > sourceListLength - 1) {
    activeSourceIndex = sourceListLength - 1;
  } else if (activeSourceIndex < 0) {
    activeSourceIndex = 0;
  }
  displayImage(sourceList[activeSourceIndex]);
}

function animateNextFrame() {

  // Show the next frame in the timelapse and set a timeout to recursively call
  // this function.

  if (continueAnimating) {
    changeSource(animationStepSize);
    if (activeSourceIndex == sourceListLength - 1) {
      activeSourceIndex = -1;
    }
    animationTimer = setTimeout(animateNextFrame, 1000/animationFramerate);
  }
}

function animateTimelapse() {

  // Start the process of animating the timelapse

  animationStepSize = 1;
  if (sourceListLength < 50) {
    animationFramerate = 5;
  } else if (sourceListLength < 200) {
    animationFramerate = 10;
  } else if (sourceListLength < 500) {
    animationFramerate = 20;
  } else if (sourceListLength < 2000) {
    animationFramerate = 30;
  } else {
    animationFramerate = 30;
    animationStepSize = 2;
  }
  continueAnimating = true;
  clearTimeout(animationTimer);
  animateNextFrame();
}

function showAttractor() {

  // Start animating the timelapse and show a moving hand icon to guide users

  animateTimelapse();
  document.getElementById("handContainer").style.display = "block";
}

function hideAttractor() {

  // Stop any animation
  continueAnimating = false;

  // Hide the moving hand icon
  document.getElementById("handContainer").style.display = "none";

  // Set the attractor to start again in 30 s
  clearTimeout(attractorTimer);
  attractorTimer = setTimeout(showAttractor, 30000);
}
