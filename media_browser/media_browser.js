/*jshint esversion: 6 */

function changePage(val) {

  switch (val) {
    case 0:
      currentPage = 0;
      break;
    case 1:
      currentPage += 1;
      if (currentPage*cardsPerPage > data.length) {
        currentPage -= 1;
      }
      break;
    case -1:
      currentPage -= 1;
      if (currentPage < 0) {
        currentPage = 0;
      }
      break;
    default:
  }
  populateResultsRow();
}

function clear() {

  currentPage = 0;
  $("#searchInput").val("");
  keyboard.input.default = "";
  keyboard.input.searchInput = "";
  $(".filterSelect").val(null);
  populateResultsRow();
}

function createCard(obj) {

  // Take a JSON object and turn it into a card in the resultsRow

  var thumb;

  if (thumbnailKey != undefined && thumbnailKey != "") {
    thumb = "thumbs/" + String(obj[thumbnailKey]);
  } else {
    thumb = "thumbs/" + String(obj[mediaKey]);
  }

  var title = "";
  if (titleKey != undefined && titleKey != "") {
    title = obj[titleKey];
  }

  var id = String(Math.round(Date.now()*Math.random()));

  obj.uniqueMediaBrowserID = id;

  var titleClass;
  if (title.length > 30) {
    titleClass = 'resultTitleSmall';
  } else if (title.length > 20) {
    titleClass = 'resultTitleMedium';
  } else {
    titleClass = 'resultTitleLarge';
  }

  var html = `
    <div class='cardCol col-12 col-sm-6 col-md-4 col-lg-3 col-xl-2 align-items-center justify-content-top d-flex'>
      <div class="resultCard row my-2 w-100" onclick="displayMedia('${id}')">
        <center>
          <img class='resultImg' src="${thumb}" id=Entry_${id}>
          <p class='cardTitle ${titleClass}'>${title}</p>
        </center>
      </div>
    </div>
  `;

  $("#resultsRow").append(html);
}

function hideImageLightBox() {

  // Fade out the lightbox, and then hide it so it doesn't steal touches

  var temp = function() {$("#imageLightbox").css("display", "none");};
  $("#imageLightbox").animate({opacity: 0, queue: false}, {complete: temp, duration: 100});
}

function onFilterOptionChange() {
  currentPage = 0;
  populateResultsRow();
}

function populateFilterOptions() {

  // Read the filterKeys and create a dropdown for each

  if (filterKeys == undefined) {
    return;
  }
  $("#filterOptionsRow").empty();

  filterKeys.forEach((key, i) => {
    var newCol = document.createElement("div");
    newCol.className = "col-12 col-xl-6";
    $("#filterOptionsRow").append(newCol);

    var newSelect = document.createElement("select");
    newSelect.className = "form-select filterSelect";
    newSelect.multiple = true;
    newSelect.setAttribute("data-filterKey", key);

    let uniqueValues = [...new Set(data.map(entry => entry[key]))].sort();
    var newOption;
    uniqueValues.forEach((value, j) => {
      newOption = document.createElement("option");
      newOption.value = value;
      newOption.innerHTML = value;
      newSelect.appendChild(newOption);
    });
    newCol.appendChild(newSelect);
    newSelect.addEventListener("change", onFilterOptionChange);
  });
}

function _populateResultsRow(currentKey) {

  // Empty and repopulate the results row based on the given filters
  // currentKey accounts for the key being pressed right now, which is not
  // yet part of the input value

  // var startTime = performance.now();
  $("#resultsRow").empty();

  var input = $("#searchInput").val();

  // Filter on search terms
  var search_terms = (input).split(" ");
  var searchedData = [];
  data.forEach((item, i) => {
    var matchCount = 0;
    search_terms.forEach((term, i) => {
      if (term != "" || (term == "" && search_terms.length == 1)) {
        // Strip out non-letters, since the keyboard doesn't allow them
        if (item.searchData.normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z\s]/ig, "").toLowerCase().includes(term.replace(/[^A-Za-z]/ig, "").toLowerCase())) {
          matchCount += 1;
        }
      }
    });
    if (matchCount > 0) {
      item.matchCount = matchCount;
      searchedData.push(item);
    }
  });


  // Filter on filter options
  let filters = $.makeArray($(".filterSelect"));
  var filteredData = [];
  var thisKey, selectedValues, filterMathces;
  // Iterate through the remaining data and make sure it matches at least
  // one filtered value.
  searchedData.forEach((item, i) => {
    filterMathces = {};
    filters.forEach((filter, j) => {
      thisKey = filter.getAttribute("data-filterKey");
      selectedValues = $(filter).val();
      if (selectedValues.length > 0) {
        if (selectedValues.includes(item[thisKey])) {
          filterMathces[thisKey] = 1;
          item.matchCount += 1;
        } else {
          filterMathces[thisKey] = 0;
        }
      } else {
        // If no values are selected for this filter, pass all matches through
        filterMathces[thisKey] = 1;
      }

    });
    // Iterate through the matches to make sure we've matched on every filter
    var totalMathces = 0;
    for (let [matchKey, matchValue] of Object.entries(filterMathces)){
      if (matchValue == 1) {
        totalMathces += 1;
      }
    }
    if (totalMathces == filters.length) {
      filteredData.push(item);
    }
  });

  // Sort by the number of matches, so better results rise to the top.
  filteredData.sort((a, b) => b.matchCount - a.matchCount);

  // Make sure we have no more than 12 results to display
  displayedResults = filteredData.slice(cardsPerPage*currentPage,cardsPerPage*(currentPage+1));
  // Create a card for each item and add it to the display
  displayedResults.forEach((item, i) => {
    createCard(item);
  });
  // console.log("populateResultsRow runetime:", performance.now()-startTime)
  $("#resultsRow").fadeIn(200);

}

function populateResultsRow(currentKey="") {

  // Stub function to do the fade, then call the helper function

  $("#resultsRow").fadeOut(200, complete=function(){_populateResultsRow(currentKey);});
}

function displayMedia(id) {

  // Take the given id and display the media in the overlay.

  var obj = data.filter(function(item){
    return item.uniqueMediaBrowserID == id;
  })[0];

  var title = "";
  if (titleKey != undefined && titleKey != "") {
    title = obj[titleKey];
  }

  var caption = "";
  if (captionKey != undefined && captionKey != "") {
    caption = obj[captionKey];
  }
  var credit = "";
  if (creditKey != undefined && creditKey != "") {
    credit = obj[creditKey];
  }
  showImageInLightBox(String(obj[mediaKey]), title, caption, credit);
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
    requestDict = {"class": "exhibitComponent",
                   "id": id,
                   "type": type,
                   "helperPort": helperAddress.split(":")[2], // DEPRECIATED
                   "helperAddress": helperAddress,
                   "currentInteraction": String(currentlyActive),
                   "allowed_actions": allowedActionsDict};

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
      } else if (cmd == "shutdown") {
        askForShutdown();
      } else if (cmd == "sleepDisplays") {
          sleepDisplays();
      } else if (cmd == "wakeDisplays") {
          wakeDisplays();
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
  if ("contentPath" in update) {
    contentPath = update.contentPath;
  }
  if ("current_exhibit" in update) {
    currentExhibit = update.current_exhibit;
  }
  if ("missingContentWarnings" in update) {
    errorDict.missingContentWarnings = update.missingContentWarnings;
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

  // This should be last to make sure the path has been updated
  if ("content" in update) {
    console.log(`Received content update: ${update.content}`);
  }
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

function showAttractor() {

  // Make the attractor layer visible

  document.getElementById("attractorVideo").play()
  .then(result => {
    $("#attractorOverlay").show();
    hideImageLightBox();
    clear();
    currentlyActive = false;
  });
}

function hideAttractor() {

  // Make the attractor layer invisible

  $("#attractorOverlay").hide(result => {
    document.getElementById("attractorVideo").pause();
    currentlyActive = true;
    resetActivityTimer();
  });
}

function resetActivityTimer() {

  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAttractor, 30000);
}

function setCardCount() {

  // Based on the window size and the Bootstrap grid, calculate the number of
  // cards we will be showing per page.

  const windowWidth = window.innerWidth;
  if (windowWidth >= 1200) {
    cardsPerPage = 12;
  } else if (windowWidth >= 992) {
    cardsPerPage = 8;
  } else if (windowWidth >= 768) {
    cardsPerPage = 6;
  } else if (windowWidth >= 576) {
    cardsPerPage = 4;
  } else {
    cardsPerPage = 2;
  }
  populateResultsRow();
}

function showImageInLightBox(image, title="", caption="", credit="") {

  // Set the img source to the provided image, set the caption, and reveal
  // the light box. The desired image must be located in the media directory

  // Hide elements until image is loaded
  $("#imageLightboxImage, #imageLightboxTitle, #imageLightboxCaption, #imageLightboxCredit").hide();
  // document.getElementById("imageLightboxImage").src = "media/" + image;

  document.getElementById("imageLightboxTitle").innerHTML = title;
  document.getElementById("imageLightboxCaption").innerHTML = caption;

  if (credit != "" && credit != undefined) {
    document.getElementById("imageLightboxCredit").innerHTML = "Credit: " + credit;
  } else {
    document.getElementById("imageLightboxCredit").innerHTML = "";
  }


  // Load the image with a callback to fade it in when it is loaded
  $("#imageLightboxImage").one("load", function(){
    $("#imageLightboxImage, #imageLightboxTitle, #imageLightboxCredit").fadeIn();
    if (caption == "") {
      $("#imageLightboxImage").addClass("imageLightboxImageTall").removeClass("imageLightboxImageShort");
      $("#imageLightboxCaption").hide();
    } else {
      $("#imageLightboxImage").removeClass("imageLightboxImageTall").addClass("imageLightboxImageShort");
      $("#imageLightboxCaption").fadeIn();
    }
  }).attr("src", "media/" + image);

  $("#imageLightbox").css("display", "flex").animate({opacity: 1, queue: false}, 100);
}
