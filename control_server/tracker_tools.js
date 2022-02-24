/*jshint esversion: 6 */

function getAvailableDefinitions(complete) {

  // Ask the control server to send a list of availble definition files
  // Pass a function and it will be called with the list as the
  // only parameter

  var requestDict = {"class": "tracker",
                     "action": "getAvailableDefinitions"};

  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", serverIP, true);
  xhr.timeout = 3000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var definitionList = JSON.parse(this.responseText);
      if (typeof complete == "function") {
        complete(definitionList);
      }
    }
  };
  xhr.send(requestString);
}

function loadLayoutDefinition(name, complete) {

  // Ask the control server to send a JSON dict with the layout definition
  // from the file with `name`
  // After the layout is retrieved, the function `complete` will be called
  // with the layout as the only parameter



  var requestDict = {"class": "tracker",
                     "action": "getLayoutDefinition",
                     "name": name};

  var requestString = JSON.stringify(requestDict);

  var xhr = new XMLHttpRequest();
  xhr.open("POST", serverIP, true);
  xhr.timeout = 1000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
  xhr.onreadystatechange = function () {
    if (this.readyState != 4) return;

    if (this.status == 200) {
      var definition = JSON.parse(this.responseText);
      if ("success" in definition) {
        if (definition.success == true) {
          if (typeof complete == "function") {
            complete(definition.layout);
          }
        } else {
          console.log("Error: could not load layout definition:", definition.reason);
        }
      } else {
          console.log("Error: Did not receive valid JSON");
      }
    }
  };
  xhr.send(requestString);
}
