/*jshint esversion: 6 */

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

  // Send a message to the local helper and ask for it to shut down the PC

  var requestString = JSON.stringify({"action": "shutdown"});

  var xhr = new XMLHttpRequest();
  xhr.open("POST", helperAddress, true);
  xhr.timeout = 2000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.send(requestString);
}

function checkForSoftwareUpdate() {

  console.log("WARNING: update not checked because source link is incorrect.")
  // var xhr = new XMLHttpRequest();
  // xhr.timeout = 2000;
  // xhr.open('GET', 'https://raw.githubusercontent.com/FWMSH/Constellation-Local/main/infostation_new/version.txt', true);
  // xhr.onreadystatechange = function () {
  //
  //   if (this.readyState != 4) return;
  //
  //   if (this.status == 200) {
  //     if(parseFloat(this.responseText) > SOFTWARE_VERSION) {
  //       errorDict.softwareUpdateAvailable = "true";
  //     }
  //   }
  // };
  // xhr.send(null);
}

function createButton(title, id) {

  // Create a button in the bottom bar that shows the pane with the given id

  let existingButton = $("#" + id + "ButtonCol");
  let col;
  if (existingButton.length == 0) {
    // Create a new button
    col = document.createElement("div");
    col.setAttribute("class", "col-2 tabButtonCol");
    col.setAttribute("id", id + "ButtonCol");
    $("#buttonRow").append(col);

    // Adjust the column size based on the number of buttons that have been added
    let nButtons = $("#buttonRow").children().length;
    const allButtons = $(".tabButtonCol");
    if (nButtons == 1) {
      allButtons.removeClass("col-1 col-2 col-3 col-4 col-6").addClass("col-12");
    } else if (nButtons == 2) {
      allButtons.removeClass("col-1 col-2 col-3 col-4 col-12").addClass("col-6");
    } else if (nButtons == 3) {
      allButtons.removeClass("col-1 col-2 col-3 col-6 col-12").addClass("col-4");
    } else if (nButtons == 4) {
      allButtons.removeClass("col-1 col-2 col-4 col-6 col-12").addClass("col-3");
    } else if (nButtons > 4) {
      allButtons.removeClass("col-1 col-6 col-3 col-4 col-12").addClass("col-2");
    }
  } else {
    // Update button
    existingButton.empty();
    col = existingButton;
    col.empty();
  }

  let button = document.createElement("button");
  button.setAttribute("class", "btn btn-secondary tabButton w-100 h-100");
  button.setAttribute("onclick", `gotoTab("${id}", this)`);
  $(button).html(title);
  col.append(button);
}

function createCard(content) {

  // Create a single thumbnail card with the details provided in 'content'

  let card = document.createElement("div");
  card.setAttribute("class", "card");
  $(card).data("details", content);

  let img = document.createElement("img");
  img.setAttribute("class", "card-img-top");
  img.src = content.thumb;
  $(card).append(img);

  let body = document.createElement("div");
  body.setAttribute("class", "card-body");
  card.append(body);

  let title = document.createElement("div");
  title.setAttribute("class", "card-title text-center");
  $(title).html(content.title_en);
  body.append(title);

  return card;
}

function createImageTab(content, tabName) {

  // Create a pane that displays a grid of images. 'content' should be an array
  // of objects with the following properties:
  // 'image', 'thumb', 'title_en', 'title_es', 'caption_en', 'caption_es', 'credit_en', 'credit_es'

  // First, create the pane
  const id = "imageTab_"+String(Date.now());
  const overlayId = id + "_overlay";
  let pane = document.createElement("div");
  pane.setAttribute("id", id);
  pane.setAttribute("class", "tab-pane fade show active");
  $("#nav-tabContent").append(pane);

  let row = document.createElement("div");
  row.setAttribute("class", "row mx-1 align-items-center");
  $("#"+id).append(row);

  // Then, iterate through the content and build a card for each image
  content.forEach((item, i) => {
    let col = document.createElement("div");
    col.setAttribute("class", "col-4 mt-3");
    row.append(col);

    let card = createCard(item);
    card.setAttribute("onclick", `imageOverlayShow("${id}", this)`);
    col.append(card);

  });

  // Then, create the overlay that will show the media
  let overlay = document.createElement("div");
  overlay.setAttribute("class", "row overlay mx-0 align-items-center");
  overlay.setAttribute("id", overlayId);
  overlay.setAttribute("onclick", `imageOverlayHide("${id}")`);
  $("#"+id).append(overlay);
  $(overlay).hide();

  let bigImgCol = document.createElement("div");
  bigImgCol.setAttribute("class", "offset-1 col-10 text-center");
  overlay.append(bigImgCol);

  let bigImg = document.createElement("img");
  bigImg.setAttribute("class", "bigImage");
  bigImg.setAttribute("id", id+"_image");
  bigImg.src = content[0].image;
  bigImgCol.append(bigImg);

  let title = document.createElement("p");
  title.setAttribute('class', "overlayTitle text-center");
  title.setAttribute("id", id+"_title");
  $(title).html(content[0].title_en);
  bigImgCol.append(title);

  let caption = document.createElement("p");
  caption.setAttribute("class", "overlayCaption text-start");
  caption.setAttribute("id", id+"_caption");
  $(caption).html(content[0].caption_en);
  bigImgCol.append(caption);

  let credit = document.createElement("p");
  credit.setAttribute("class", "overlayCredit fst-italic text-start");
  credit.setAttribute("id", id+"_credit");
  $(credit).html(content[0].credit_en);
  bigImgCol.append(credit);

  // Create button for this tab
  createButton(tabName, id);
}

function createTextTab(content, tabName) {

  // Create a pane that displays Markdown-formatted text and images

  // First, create the pane
  const id = "textTab_"+String(Date.now());
  const overlayId = id + "_overlay";
  let pane = document.createElement("div");
  pane.setAttribute("id", id);
  pane.setAttribute("class", "tab-pane fade show active");
  $(pane).data("user-content", content);
  $(pane).data("user-tabName", tabName);
  $("#nav-tabContent").append(pane);

  let row = document.createElement("div");
  row.setAttribute("class", "row mx-1 align-items-center");
  $("#"+id).append(row);

  let col = document.createElement("div");
  col.setAttribute("class", "col-12 textCol mt-3");
  col.setAttribute("id", id + "Content");
  row.append(col);

  localizeTextTab(id);

  textTabs.push(id);
}

function localizeTextTab(id) {

  // Use the user-supplied data to supply the content in the current langauge;

  let content = $("#" + id).data("user-content");
  let tabName = $("#" + id).data("user-tabName");

  // Convert the Markdown to HTML
  let converter = new showdown.Converter({parseImgDimensions: true});
  let html = converter.makeHtml(content["text_" + currentLang]);
  $("#" + id + "Content").html(html);

  // Create button for this tab
  createButton(tabName[currentLang], id);

}

function createVideoTab(content, tabName) {

  // Create a pane that displays a grid of video. 'content' should be an array
  // of objects with the following properties:
  // 'video', 'thumb', 'title_en', 'title_es', 'caption_en', 'caption_es', 'credit_en', 'credit_es'

  // First, create the pane
  const id = "videoTab_"+String(Date.now());
  const overlayId = id + "_overlay";
  let pane = document.createElement("div");
  pane.setAttribute("id", id);
  pane.setAttribute("class", "tab-pane fade show active");
  $("#nav-tabContent").append(pane);

  let row = document.createElement("div");
  row.setAttribute("class", "row mx-1 align-items-center");
  $("#"+id).append(row);

  // Then, iterate through the content and build a card for each image
  content.forEach((item, i) => {
    let col = document.createElement("div");
    col.setAttribute("class", "col-4 mt-3");
    row.append(col);

    let card = createCard(item);
    card.setAttribute("onclick", `videoOverlayShow("${id}", this)`);
    col.append(card);

  });

  // Then, create the overlay that will show the media
  let overlay = document.createElement("div");
  overlay.setAttribute("class", "row overlay mx-0 align-items-center");
  overlay.setAttribute("id", overlayId);
  overlay.setAttribute("onclick", `videoOverlayHide("${id}")`);
  $("#"+id).append(overlay);
  $(overlay).hide();

  let bigVidCol = document.createElement("div");
  bigVidCol.setAttribute("class", "offset-1 col-10 text-center");
  overlay.append(bigVidCol);

  let bigVid = document.createElement("video");
  bigVid.setAttribute("class", "bigImage");
  bigVid.setAttribute("id", id+"_video");
  bigVid.setAttribute("onended", `videoOverlayHide("${id}")`);
  bigVid.src = content[0].video;
  bigVidCol.append(bigVid);

  let title = document.createElement("p");
  title.setAttribute('class', "overlayTitle text-center");
  title.setAttribute("id", id+"_title");
  $(title).html(content[0].title_en);
  bigVidCol.append(title);

  let caption = document.createElement("p");
  caption.setAttribute("class", "overlayCaption text-start");
  caption.setAttribute("id", id+"_caption");
  $(caption).html(content[0].caption_en);
  bigVidCol.append(caption);

  let credit = document.createElement("p");
  credit.setAttribute("class", "overlayCredit fst-italic text-start");
  credit.setAttribute("id", id+"_credit");
  $(credit).html(content[0].credit_en);
  bigVidCol.append(credit);

  // Create button for this tab
  createButton(tabName, id);
}

function fontSizeDecrease(animate=false) {

  // Take the given number of font ticks and convert it into the proper
  // font size for each kind of elements

  var duration = 0;
  if (animate) {
    duration = 50;
  }

  $("p, h1, h2, h3, h4, h5, h6, button, .card-title, li").animate({fontSize: "-=3", queue: false}, duration);
}

function fontSizeDecreaseButtonPressed() {

  if (fontTicks > 0) {
    fontTicks -= 1;
    fontSizeDecrease(true);
  }
}

function fontSizeReset() {

  while (fontTicks > 0) {
    fontSizeDecrease();
    fontTicks -= 1;
  }
}

function fontSizeIncrease(animate=false, amount=3) {

  // Take the given number of font ticks and convert it into the proper
  // font size for each kind of elements

  var duration = 0;
  if (animate) {
    duration = 50;
  }
  $("p, h1, h2, h3, h4, h5, h6, button, .card-title, li").animate({fontSize: "+="+String(amount), queue: false}, duration);
}

function fontSizeIncreaseButtonPressed() {

  if (fontTicks < 10) {
    fontTicks += 1;
    fontSizeIncrease(true);
  }
}

function gotoTab(id, button) {

  // Swap the active tab

  // Make sure the tab is scrolled to the top
  $("#nav-tabContent").scrollTop(0);
  $(".tab-pane.active").removeClass("active");
  $("#"+id).addClass("active");

  // Chance button color
  $(".tabButton").removeClass("btn-primary").addClass("btn-secondary");
  $(button).removeClass("btn-secondary").addClass("btn-primary");
}

function hideAttractor() {

  // Make the attractor layer invisible

    $("#attractorOverlay").fadeOut(100, result => {
    document.getElementById("attractorVideo").pause();
    currentlyActive = true;
    resetActivityTimer();
  });
}

function imageOverlayHide(id) {
    $("#"+id+"_overlay").fadeOut(100);
}

function imageOverlayShow(id, card) {

  // Retreive the details from the card data
  let details = $(card).data("details");

  // Use the details to fill out the overlay
  $("#"+id+"_image").attr("src", details.image);
  if (details.title_en != null) {
    $("#"+id+"_title").html(details.title_en);
  } else {
    $("#"+id+"_title").html("");
  }
  if (details.caption_en != null) {
    $("#"+id+"_caption").html(details.caption_en);
  } else {
    $("#"+id+"_caption").html("");
  }
  if (details.credit_en != null) {
    $("#"+id+"_credit").html(details.credit_en);
  } else {
    $("#"+id+"_credit").html("");
  }

  $("#"+id+"_overlay").fadeIn(100);
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
  if ("helperAddress" in update) {
    helperAddress = update.helperAddress;
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
}

function resetActivityTimer() {

  // Cancel the existing activity timer and set a new one

  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(showAttractor, 30000);
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

function sendPing() {

  // Contact the control server and ask for any updates

  if (serverAddress != "") {
    requestDict = {"class": "exhibitComponent",
                   "id": id,
                   "type": type,
                   "helperPort": helperAddress.split(":")[2], // Depreciated
                   "helperAddress": helperAddress,
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

function setLanguages(langDict) {

  languageDict = langDict;
  currentLang = langDict.default;
}

function setMasthead(dataDict) {

  // Helper function to set the masthead content (usually text)

  $("#masthead").data("user-data", dataDict);
  $("#masthead").html(dataDict[languageDict.default]);
}

function localizeMasthead() {

  // Update the masthead with content matching the current language.

  let dataDict = $("#masthead").data("user-data");
  $("#masthead").html(dataDict[currentLang]);
}

function showAttractor() {

  // Make the attractor layer visible

  document.getElementById("attractorVideo").play()
  .then(result => {
    $("#attractorOverlay").fadeIn(100);
    currentlyActive = false;
  }).then(result => {
    toggleLang(languageDict.default);
    fontSizeReset();
    $("#nav-tabContent").scrollTop(0);
  });
}

function sleepDisplays() {

  // Send a message to the local helper process and ask it to sleep the
  // displays

  var requestString = JSON.stringify({"action": "sleepDisplays"});

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

function toggleLang(lang) {

  // Switch the currentLang and rebuild the interface.

  currentLang = lang;

  // First, record the current text size and reset everything to the default.
  let sizeToSet = fontTicks;
  fontSizeReset(); // Clear size so all elements are equally affected

  localizeMasthead();

  if (currentLang == "en") {
    $("#langToggleButton").html(languageDict.es);
    $("#langToggleButton").attr("onclick", "toggleLang('es')");
  } else {
    $("#langToggleButton").html(languageDict.en);
    $("#langToggleButton").attr("onclick", "toggleLang('en')");
  }

  textTabs.forEach((item, i) => {
    localizeTextTab(item);
  });
  videoTabs.forEach((item, i) => {
    localizeVideoTab(item);
  });
  imageTabs.forEach((item, i) => {
    localizeImageTab(item);
  });

  // Finally, update all elements to the previous text size.
  fontSizeIncrease(false, 3*sizeToSet);
  fontTicks = sizeToSet;
}

function videoOverlayHide(id) {
    videoPlaying = false;
    $("#"+id+"_overlay").fadeOut(100);
    document.getElementById(id+"_video").pause();
    document.getElementById(id+"_video").currentTime = 0;
}

function videoOverlayShow(id, card) {

  videoPlaying = true;

  // Retreive the details from the card data
  let details = $(card).data("details");

  // Use the details to fill out the overlay
  $("#"+id+"_video").attr("src", details.video);
  if (details.title_en != null) {
    $("#"+id+"_title").html(details.title_en);
  } else {
    $("#"+id+"_title").html("");
  }
  if (details.caption_en != null) {
    $("#"+id+"_caption").html(details.caption_en);
  } else {
    $("#"+id+"_caption").html("");
  }
  if (details.credit_en != null) {
    $("#"+id+"_credit").html(details.credit_en);
  } else {
    $("#"+id+"_credit").html("");
  }

  $("#"+id+"_overlay").fadeIn(100);
  document.getElementById(id+"_video").play();
}

function wakeDisplays() {

  // Send a message to the local helper process and ask it to sleep the
  // displays

  var requestString = JSON.stringify({"action": "wakeDisplays"});

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


var videoPlaying = false; // Is a video currently playing?
var errorDict = {};
const SOFTWARE_VERSION = 1.0;
var inactivityTimer = 0;
var currentlyActive = false;
var fontTicks = 0; // Number of times we have increased the font size
var languageDict = {default: "en"};
var currentLang = "en";
var textTabs = []; // Holds ids of textTabs.
var videoTabs = [];
var imageTabs = [];

// These will be replaced by values from the helper upon loading
var id = "UNKNOWN";
var type = "INFOSTATION";
var serverAddress = ""; // The address of the main control server
var allowedActionsDict = {"refresh": "true"};
var contentPath = "";
var current_exhibit = "";

$(document).bind("touchstart", resetActivityTimer);

askForDefaults();
checkForSoftwareUpdate();
sendPing();
setInterval(sendPing, 5000);

// var videoContent = [{video: 'videos/test_video.mp4', thumb: 'thumbs/test_video.jpg', caption_en: 'This is a test video.', caption_es: "Ésta es una imagen de prueba.", title_en: "Test 1", credit_en: "Public Domain."},];
// createVideoTab(videoContent, "Videos");
//
// var imageContent = [
//   {image: 'images/test_1.jpeg', thumb: 'thumbs/test_1.jpeg', caption_en: 'This is a test image.', caption_es: "Ésta es una imagen de prueba.", title_en: "Test 1", credit_en: "Public Domain."},
//   {image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "Test 2"},{image: 'images/test_2.jpeg', thumb: 'thumbs/test_2.jpeg', caption_en: 'This is another test image.', caption_es: "Esta es otra imagen de prueba.", title_en: "A very long title with words."},{image: 'images/test_3.jpeg', thumb: 'thumbs/test_3.jpeg', caption_en: 'Very Wide Image is here.', caption_es: "Esta es otra imagen de prueba.", title_en: "Very Wide Image"},{image: 'images/test_4.jpeg', thumb: 'thumbs/test_4.jpeg', caption_en: 'This is another test image that is very tall.', caption_es: "Esta es otra imagen de prueba.", title_en: "Very Tall Image"},
// ];
// createImageTab(imageContent, "Images");
