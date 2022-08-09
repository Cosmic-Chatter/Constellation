function buildLayout(definition) {

  // Take a layout defition in the form of a dictionary of dictionaries and
  // create cards for each element

  // Clear the exisiting layout
  $("#cardRow").empty();

  let buttons = Object.keys(definition);
  let buttonClasses;
  if (buttons.length-1 < 6) {
    buttonClasses = 'col button-col mx-0 px-1';
  } else {
    buttonClasses = 'col-3 button-col mx-0 px-1';
  }

  // Iterate through the buttons and build their HTML
  let numImages = 0; // Number of buttons that include an image
  let numText = 0; // Number of buttons that include text
  buttons.forEach((item) => {
    if (item == "SETTINGS") {
      return;
    }
    voteCounts[item] = 0;
    buttonDef = definition[item];

    let div = document.createElement("div");
    div.classList = buttonClasses;
    div.addEventListener("click", function(){buttonTouched(div, item)});
    document.getElementById("cardRow").appendChild(div);

    let card = document.createElement("div");
    card.classList = "card card-inactive mb-0";
    div.appendChild(card);

    if ("icon" in buttonDef) {
      numImages += 1;
      let img = document.createElement("img");
      img.src = buttonDef.icon;
      img.classList = "card-img-top card-img-full";
      card.appendChild(img);
    }

    let text = document.createElement("div");
    text.classList = "card-body card-body-full d-flex align-items-center justify-content-center";
    card.appendChild(text);

    let title = document.createElement("div");
    title.classList = "card-title my-0 noselect";
    if ("title" in buttonDef) {
      numText += 1;
      title.innerHTML = buttonDef.title;
    }
    text.append(title);
  });

  if (numText == 0) {
    $(".card-body").remove();
  }

  // Make sure all the buttons are the same height
  let heights = $(".card-body").map(function ()
    {
        return $(this).height();
    }).get();
  let maxHeight = Math.max.apply(null, heights);
  $(".card-body").each(function() {
    $(this).height(maxHeight);
  } )

}

function buttonTouched(button, name) {

  // Respond to the touch of a button by changing color and logging the vote

  currentlyActive = true;

  $(button).find(".card").removeClass("card-inactive").addClass("card-active");
  setTimeout(function(){
    $(button).find(".card").removeClass("card-active").addClass("card-inactive");
  }, 500)
  logVote(name, 1);
}

function logVote(name, numVotes) {

  // Record one or more votes for the given option

  if (blockTouches == false) {
    voteCounts[name] += numVotes;
  }
  clearTimeout(touchBlocker);
  blockTouches = true;
  touchBlocker = setTimeout(function(){blockTouches = false;}, touchCooldown*1000);
}

function checkConnection() {

  // Send a message to the server checking that the connection is stable.

  var requestDict = {"class": "tracker",
                      "action": "checkConnection"};

  var requestString = JSON.stringify(requestDict);

  function badConnection() {
    $("#connectionWarning").show();
  }
  var xhr = new XMLHttpRequest();
  xhr.open("POST", serverAddress, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.ontimeout = badConnection;
  xhr.onerror = badConnection;
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var response = JSON.parse(this.responseText);
      if (response["success"] == true) {
        $("#connectionWarning").hide();
      }
    }
  };xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var response = JSON.parse(this.responseText);
      if (response["success"] == true) {
        $("#connectionWarning").hide();
      }
    }
  };
  xhr.send(requestString);
}

function checkForHelperUpdates() {

  // Function to ask the helper for any new updates, like switching between
  // media clips

  var requestString = JSON.stringify({"action": "getUpdate"});

  var xhr = new XMLHttpRequest();
  xhr.timeout = 50;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      readUpdate(this.responseText);
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
  // xhr.onreadystatechange = function () {
  //   if (this.readyState != 4) return;

  //   if (this.status == 200) {
  //     var response = JSON.parse(this.responseText);
  //     if ("helperAddress" in response) {
  //       helperAddress = response.helperAddress;
  //     }
      
  //   }
  // };
  xhr.send(JSON.stringify(requestDict));
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
    currentExhibit = update.current_exhibit;
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
  if ("content" in update) {
    if (!arrays_equal(update.content, currentContent)) {
      currentContent = update.content;

      // Get the file from the helper and build the interface
      let definition = currentContent[0]; // Only one INI file at a time

      var xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
          if (xhr.readyState == 4 && xhr.status == 200) {
            updateContent(definition, parseINIString(xhr.responseText));
          }
      }
      xhr.open("GET", helperAddress + "/content/" + definition, true);
      xhr.send(null);
    }
  }
}

function updateContent(name, definition) {

  // Clean up the old survey, then create the new one.

  // If there are votes left for the old survey, make sure they are recorded
  sendData();

  // Update the configuration name
  if (name.toLowerCase().endsWith(".ini")) {
    configurationName = name.slice(0,-4);
  } else {
    configurationName = name;
  }

  // Clear the vote categories
  voteCounts = {};

  // Parse the settings and make the appropriate changes
  if ("header" in definition.SETTINGS) {
    document.getElementById("header").innerHTML = definition.SETTINGS.header;
  } else {
    document.getElementById("header").innerHTML = "";
  }
  if ("subheader" in definition.SETTINGS) {
    document.getElementById("subheader").innerHTML = definition.SETTINGS.subheader;
  } else {
    document.getElementById("subheader").innerHTML = "";
  }
  if ("footer" in definition.SETTINGS) {
    document.getElementById("footer").innerHTML = definition.SETTINGS.footer;
  } else {
    document.getElementById("footer").innerHTML = "";
  }
  if ("subfooter" in definition.SETTINGS) {
    document.getElementById("subfooter").innerHTML = definition.SETTINGS.subfooter;
  } else {
    document.getElementById("subfooter").innerHTML = "";
  }
  if ("recording_interval" in definition.SETTINGS) {
    clearInterval(voteCounter);
    recordingInterval = parseFloat(definition.SETTINGS.recording_interval);
    voteCounter = setInterval(sendData, recordingInterval*1000);
  }
  if ("touch_cooldown" in definition.SETTINGS) {
    touchCooldown = parseFloat(definition.SETTINGS.touch_cooldown);
  }

  buildLayout(definition);
}

function arrays_equal(arr1, arr2) {

  if (arr1.length != arr2.length) {
    return false;
  }
  for (var i=0; i<arr1.length; i++) {
    if (arr1[i] != arr2[i]) {
      return false;
    }
  }
  return true;
}

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

function loadLayoutDefinition(name) {

  // Ask the control server to send a JSON dict with the layout definition
  // from the file with `name`

  var requestDict = {"class": "voter",
                      "action": "getLayoutDefinition",
                      "name": name};

  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", serverAddress, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var definition = JSON.parse(this.responseText);
      buildLayout(definition);
    }
  };
  xhr.send(requestString);
}

function sendData() {

  // Collect the current value from each card, build a dictionary, and
  // send it to the control server for storage.

  if (debug) {
    console.log("Sending data...")
  }
  resultDict = {};

  // Append the date and time of this recording
  var tzoffset = (new Date()).getTimezoneOffset() * 60000; // Time zone offset in milliseconds
  var date_str = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
  resultDict["Date"] = date_str;

  let totalVotes = 0;
  Object.keys(voteCounts).forEach((entry) => {
    resultDict[entry] = voteCounts[entry];
    totalVotes += voteCounts[entry];

    // Reset votes
    voteCounts[entry] = 0;
  })

  // If there are no votes to record, bail out.
  if (totalVotes == 0) {
    return;
  }

  var requestDict = {"class": "tracker",
                      "action": "submitData",
                      "data": resultDict,
                      "name": configurationName};

  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", serverAddress, true);
  xhr.timeout = 5000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;
    if (this.status == 200) {
    }
  };
  xhr.send(requestString);

}

function parseQueryString() {

  // Read the query string to determine what options to set

  var queryString = decodeURIComponent(window.location.search);

  var searchParams = new URLSearchParams(queryString);

  if (searchParams.has("id")) {
    id = searchParams.get("id");
  }
  if (searchParams.has("type")) {
    type = searchParams.get("type");
  }
  if (searchParams.has("config")) {
    configurationName = searchParams.get("config");
  }
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
                    "helperIPSameAsClient": helperIPSameAsClient,
                    "allowed_actions": allowedActionsDict,
                    "constellation_app_id": "voting_kiosk",
                    "currentInteraction": String(currentlyActive),
                    "AnyDeskID": AnyDeskID};
    currentlyActive = false;

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

function parseINIString(data) {

  // Take an INI file and return an object with the settings
  // From https://stackoverflow.com/questions/3870019/javascript-parser-for-a-string-which-contains-ini-data

  var regex = {
      section: /^\s*\[\s*([^\]]*)\s*\]\s*$/,
      param: /^\s*([^=]+?)\s*=\s*(.*?)\s*$/,
      comment: /^\s*;.*$/
  };
  var value = {};
  var lines = data.split(/[\r\n]+/);
  var section = null;
  lines.forEach(function(line){
      if(regex.comment.test(line)){
          return;
      }else if(regex.param.test(line)){
          var match = line.match(regex.param);
          if(section){
              value[section][match[1]] = match[2];
          }else{
              value[match[1]] = match[2];
          }
      }else if(regex.section.test(line)){
          var match = line.match(regex.section);
          value[match[1]] = {};
          section = match[1];
      }else if(line.length == 0 && section){
          section = null;
      };
  });
  return value;
}

var id = "NO_ID";
var type = "VOTING_KIOSK";
const SOFTWARE_VERSION = 1.0;

var serverAddress = "http://localhost:8082";
var currentExhibit = ""; // This will double as the root of the source path
var allowedActionsDict = {"refresh": "true"};
var AnyDeskID = "";
var errorDict = {};
var debug = true;

var configurationName = "default";
var currentContent = [];
var voteCounts = {};
var recordingInterval = 60 // Send votes every this many minutes
var voteCounter = setInterval(sendData, recordingInterval*1000);
var blockTouches = false;
var touchBlocker = null; // Will hold id for the setTimeout() that resets blockTouches
var touchCooldown = 2; // seconds before blockTouches is reset
var currentlyActive = false; // set to true when someone presses a button

var helperIPSameAsClient = helperAddress.includes("localhost") || helperAddress.includes("127.0.0.1");

askForDefaults();
checkForSoftwareUpdate();
setInterval(sendPing, 5000);
setInterval(checkConnection, 500);

// Hide the cursor
document.body.style.cursor = 'none';
