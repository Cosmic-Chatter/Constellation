/*jshint esversion: 6 */

function startSeekBack() {

  // Begin a timer that sends messages to the helper to ask the video player
  // to seek backwards

  seekDirection = "back";
  stopSeek();
  seekTimer = setInterval(askToSeek, 50);
  askToSeek();

}

function startSeekForward() {

  // Begin a timer that sends messages to the helper to ask the video player
  // to seek backwards

  seekDirection = "forward";
  stopSeek();
  seekTimer = setInterval(askToSeek, 50);
  askToSeek();

}

function stopSeek(resetAttractor=true) {

  if (resetAttractor) {
    resetAttractorTimer();
  }
  clearInterval(seekTimer);
  // var temp = function() {setPlayPause("play");}
  // setTimeout(temp, 2000);
  setPlayPause("play");
}

function askToSeek() {

  // Send a message to the helper, asking it to tell the video player to seek
  // the video.

  setPlayPause("pause");

  var requestDict = {"action": "seekVideo",
                     "direction": seekDirection,
                     "fraction": 0.01};

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 50; // ms
  xhr.ontimeout = function() {console.log("timeout");};
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
    }
  };
  xhr.send(JSON.stringify(requestDict));
}

function setPlayPause(state) {

  // Ask the helper to tell the player to play or pause the video

  var requestDict = {};

  if (state == "play") {
    requestDict.action = 'playVideo';
  } else if (state == "pause") {
    requestDict.action = 'pauseVideo';
  }

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 1000; // ms
  xhr.ontimeout = function() {console.log("timeout");};
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
    }
  };
  xhr.send(JSON.stringify(requestDict));
}

function getCurrentExhibit() {

  // Ask the helper to send the current exhibit name and update as necessary

  var requestDict = {"action": "getCurrentExhibit"};
  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      if (this.responseText != "") {
        current_config.current_exhibit = this.responseText;
        localize();
      }
    }
};
  xhr.send(requestString);
}

function askForDefaults() {

  // Send a message to the local helper and ask for the latest configuration
  // defaults, then use them.

  var requestString = JSON.stringify({"action": "getDefaults"});

  let checkAgain = function() {
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
      current_config = JSON.parse(this.responseText);
      readUpdate(this.responseText);
      rebuildInterface();
    }
};
  xhr.send(requestString);
}

function switchLang() {

  // Switch to the other language and start changing the content.

  if (currentLang == "en") {
    currentLang = "es";
  } else {
    currentLang = "en";
  }
  setLang(currentLang);
}

function setLang(lang) {

  currentLang = lang;
  if (currentLang == "es") {
    $("#langSwitchButton").html("English");
  } else {
    $("#langSwitchButton").html("Español");
  }
  localize();
}

function updateTextSize() {

  // Read the current text size variables and update the appropriate elements

  $("p").css('font-size', currentLabelTextSize);
  $("H1").css('font-size', currentHeaderTextSize);
  $("H3").css('font-size', currentButtonTextSize);

  var attractorTextSize = Math.min(window.innerWidth/10, 100);
  var attractorSubTextSize = Math.min(window.innerWidth/20, 50);
  $("#attractorDatasetName").css('font-size', attractorTextSize);
  $("#TouchToExploreLabel").css('font-size', attractorSubTextSize);
}

function resetTextSize() {

  currentButtonTextSize = defaultButtonTextSize;
  currentHeaderTextSize = defaultHeaderTextSize;
  currentLabelTextSize = defaultLabelTextSize;

  updateTextSize();
}

function increaseTextSize() {

  resetAttractorTimer();
  currentButtonTextSize += 2;
  currentHeaderTextSize += 5;
  currentLabelTextSize += 2;
  updateTextSize();
}

function decreaseTextSize() {

  resetAttractorTimer();
  currentButtonTextSize -= 2;
  currentHeaderTextSize -= 5;
  currentLabelTextSize -= 2;
  if (currentButtonTextSize < defaultButtonTextSize) {
    currentButtonTextSize = defaultButtonTextSize;
  }
  if (currentLabelTextSize < defaultLabelTextSize) {
    currentLabelTextSize = defaultLabelTextSize;
  }
  if (currentHeaderTextSize < defaultHeaderTextSize) {
    currentHeaderTextSize = defaultHeaderTextSize;
  }
  updateTextSize();
}

function sleepDisplay() {

  // Overlay a black div to blank the screen.

  document.getElementById('displayBlackout').style.display = "block";
}

function wakeDisplay() {

  // Hide the blanking div

  document.getElementById('displayBlackout').style.display = "none";
}

function readUpdate(responseText) {

  // Function to read a message from the server and take action based
  // on the contents

  var update = JSON.parse(responseText);

  //current_config = update;
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
  if ("kiosk_anydesk_id" in update) {
    AnyDeskID = update.kiosk_anydesk_id;
  }

  if ('commands' in update) {
    for (var i=0; i<update.commands.length; i++) {
      var cmd = update.commands[i];

      if (cmd == "refresh_page") {
          location.reload();
      }
      else if (cmd == "shutdown" || cmd == "power_off") {
        askForShutdown();
      } else if (cmd == "sleepDisplay") {
          sleepDisplay();
      } else if (cmd == "wakeDisplay" || cmd == "power_on") {
          wakeDisplay();
      }
    }
  }
}

function sendAnalytics(data) {

  // Take the provided dicitonary of data and send it to the control server

  // Append the date and time of this recording
  var tzoffset = (new Date()).getTimezoneOffset() * 60000; // Time zone offset in milliseconds
  var date_str = (new Date(Date.now() - tzoffset)).toISOString().slice(0, -1);
  data.datetime = date_str;

  // Append the current exhibit
  data.exhibit = current_config.current_exhibit;

  var requestDict = {"class": "tracker",
                     "action": "submitAnalytics",
                     "data": data,
                     "name": id};

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

function sendPing() {

  // Contact the control server and ask for any updates

  if (serverAddress != "") {

    var allowedActionsDict = {"refresh": "true",
                              "sleep": "true"};

    var requestDict = {"class": "exhibitComponent",
                       "id": id,
                       "type": type,
                       "currentInteraction": String(currentlyActive),
                       "allowed_actions": allowedActionsDict,
                       "AnyDeskID": AnyDeskID};

    var requestString = JSON.stringify(requestDict);

    var xhr = new XMLHttpRequest();
    xhr.timeout = 1000;
    xhr.open("POST", serverAddress, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onerror = function() {
    };
    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {
        if (this.responseText != "") {
          readUpdate(this.responseText);
        }
      }
  };
    xhr.send(requestString);
  }
}

function highlightClip(number) {

  // Configure the interface to show the specified clip

  $(".card-footer").hide();
  $(".border.rounded.no-gutters").removeClass("bg-primary"); // Selects all the cards
  $("#cardName" + number).addClass("bg-primary");
  getLabelText($("#cardName" + number).data("name"), currentLang);
  document.getElementById("labelTextArea").scrollTop = 0;

}

function selectClip(number) {

  // Called when a user taps on one of the cards.

  if (blockTouches == false && activeClip != number) {
    resetAttractorTimer();
    activeClip = number;
    blockTouches = true;
    setTimeout(function() {blockTouches = false;}, 500);

    // Ask the helper to switch the clip
    gotoClip(number);
    highlightClip(number);
  }

}

function gotoClip(number) {

  // Function to ask the helper to ask the player to change the media to the
  // specified clip

  var requestString = JSON.stringify({"action": "gotoClip",
                                  "clipNumber": number});

  var xhr = new XMLHttpRequest();
  xhr.timeout = 500;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.ontimeout = function() {
    console.log("timeout on gotoClip");
  };
  xhr.onreadystatechange = function () {

    if (this.readyState != 4) return;

    if (this.status == 200) {
      console.log("response received:", this.responseText);
    }
  };
  xhr.send(requestString);
}

function setAutoplay(state) {

  // state should be "off", "on", or "toggle"

  var requestDict = {"action": "setAutoplay",
                     "state": state};

  requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.timeout = 2000;
  xhr.open("POST", helperAddress, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function getLabelText(name, lang) {

  // Ask the helper to retreive a label file for the specified object in
  // the specified language and send the text.

  if (name == null || lang == null) {
    setLabelText("");
    console.log("getLabelText: error: missing value for", name, lang);
    return;
  }

  var labelKey = current_config.current_exhibit + "_" + lang + "_" + name;
  if (labelKey in labelCache) {
    $("#labelTextArea").html(labelCache[labelKey]);
    updateTextSize();
  } else {
    var labelName = name.split(".").slice(0,-1).join(".")+".txt";
    var requestDict = {"action": "getLabelText",
                       "lang": lang,
                       "name": labelName};

    requestString = JSON.stringify(requestDict);

    var xhr = new XMLHttpRequest();
    xhr.timeout = 2000;
    xhr.open("POST", helperAddress, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {

      if (this.readyState != 4) return;

      if (this.status == 200) {
        if (this.responseText != "") {
          var formatted_text = markdownConverter.makeHtml(this.responseText);
          // Add it to the cache.
          labelCache[labelKey] = formatted_text;
          setLabelText(formatted_text);
        } else {
          setLabelText("");
        }
      }
    };
    xhr.send(requestString);
  }
}

function setLabelText(formatted_text) {

  // Take an HTML string and set put it in the label text div

  $("#labelTextArea").html(formatted_text);
  updateTextSize();
}

function createCard(name, number) {

  // Create a card that holds one dataset

  // Try to look up a public-facing name for the dataset
  var displayName = name;
  if (dictionary != null) {
    var dict = getDictionary(currentLang);
    var dictKey = name;
    if (dictKey in dict) {
      displayName = dict[dictKey];
    }
  }
  var icon = name.split(".").slice(0,-1).join(".")+".png";

  var html = `
  <div class='col-12 m-1' onclick="selectClip(${number})">
    <div id="cardName${number}" data-name="${name}" data-number="${number}" class="button-card row no-gutters p-2 border border-primary rounded align-items-center">
      <div class="col-3">
        <img class='card-img-top' src="thumbnails/${icon}" onerror="this.src='thumbnails/default.svg'"></img>
      </div>
      <div class="col-9 pl-2">
        <div class="card-body">
          <h3 id="cardTitle${number}" class="card-title">${displayName}</h3>
        </div>
        </div>
      </div>
    </div>
  </div>
  `;
  $("#cardRow").append(html);
  if (number == activeClip) {
    highlightClip(number);
  }
  updateTextSize();
}

function localize() {

  // Update elements to reflect the current language

  if (dictionary != null) {
    var dict = getDictionary(current_config.current_exhibit);

    // Update kiosk title
    var dictKey = "kiosk_title_" + currentLang;
    if (dictKey in dict) {
      var title = dict[dictKey];
      $(".mastheadText").html(title);
      if (currentLang == "en") {
        $("#attractorDatasetName").html(title);
      }
    }

    // Update button display names
    var cards = $(".button-card");
    cards.each(
      function(){
        var name = $(this).data("name");
        var number = $(this).data("number");
        console.log(name, number);
        $("#cardTitle"+number).html(dict[name]);
      }
    );
  }
  highlightClip(activeClip);
}

function rebuildInterface() {

  // Repopulate the clip buttons in response to a change in playlist

  if (dictionary != null) {
    var dict = getDictionary(current_config.current_exhibit);
    var dictKey = "kiosk_title_" + currentLang;
    if (dictKey in dict) {
      var title = dict[dictKey];
      $(".mastheadText").html(title);
      if (currentLang == "en") {
        $("#attractorDatasetName").html(title);
      }
    }
  }

  // Remove the existing cards
  $("#cardRow").empty();

  // Create new ones
  for (var i=0; i<clipList.length; i++) {
    clip = clipList[i];
    createCard(clip, i);
  }

  $("#card"+activeClip).addClass("bg-primary");
}

function getDictionary(value) {

  // Return the correct dictionary for the current language

  if (dictionary != null) {
    var dict = dictionary;
    if ("meta" in dictionary) {
      // We have a dictionary with a section for each language
      if (value.toUpperCase() in dictionary) {
        dict = dictionary[value.toUpperCase()];
      }
    }
    return(dict);
  } else {
    console.log("Dictionary is not available!");
    return(null);
  }
}

function getClipList() {

  // Ask the helper for a list of the currently playing clips. If this is
  // different than what we have, rebuild the interface to reflect that.

  // Retreive the new clip list
  var requestDict = {"action": "getClipList"};
  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var update = JSON.parse(this.responseText);
      if ("clipList" in update) {
        var oldList = clipList;
        clipList = update.clipList;
        activeClip = parseInt(update.activeClip);
        if (arraysEqual(oldList, clipList) == false) {
          rebuildInterface();
          getCurrentExhibit(); // A changing clipList probably means a different exhibit
        }
      }
    }
};
  xhr.send(requestString);
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

function showAttractor() {

  // Make the attractor layer visible and start autorun

  stopSeek(false);
  $("#attractorOverlay").show();
  setLang("en");
  setAutoplay("on");
  resetTextSize();
  currentlyActive = false;

  var analyticsData = {
    "action": "showAttractor",
    "target": "attractor",
    "idle": "true"
  };
  sendAnalytics(analyticsData);
}

function hideAttractor() {

  // Make the attractor layer invisible and stop the autorun

  $("#attractorOverlay").hide();
  setAutoplay("off");
  resetAttractorTimer();
  currentlyActive = true;

  var analyticsData = {
    "action": "hideAttractor",
    "target": "attractor",
    "idle": "false"
  };
  sendAnalytics(analyticsData);
}

function resetAttractorTimer() {

    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(showAttractor, 30000);
}
