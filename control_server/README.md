# Control Server

## Introduction

<img src="images/Components_overview_tab.png" style="width: 40%; float: right; border: 2px solid gray; margin: 5px;"></img>

Control Server coordinates communication between **_Constellation_** components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.


## Terminology

* `gallery`: A physical space in which exhibits take place.
* `exhibit`: A configuration for a `gallery` that assigns a `definition` to each `component`.
* `component`: A single display element within a `gallery`. This could be a projector, a screen, an iPad, or a hands-on mechanical interactive.
* `content`: Files such as text, images, videos, or spreadsheets that make up part of a `definition`.
* `definition`: The specific configuration of a given `component`, made up of `content` and settings.
* `id`: A unique identifier for a given `component`. No two components can have the same `id`.
* `group`: A user-defined grouping of components. For example, if you have multiple screens each displaying similar information, you might assign them all the group of "INFO SCREEN". Groups allow you to send the same command to multiple devices. Every component must have a group.

## Setting up Control Server

### Configuring your environment
Many **_Constellation_** `components` will lose functionality if they cannot connect to Control Server. Thus, it is paramount that Control Server runs in a computing environment that is as stable as possible.

#### Environment requirements
* A static IP address
* On Windows, some secondary functionality requires running Control Server with administrator privileges

#### Environment recommendations
* A wired network connection is important to ensure a consistent connection.
* No aspect of **_Constellation_** requires access to the public internet (except checking for updates), although Control Server should be on a machine with accurate network time.

### First-time setup
The first time you launch Control Server, the terminal will launch an interactive setup wizard to walk you through basic configuration.

Once the wizard has completed, the server will start. After this point, all configuration will take place via the web console.

### Connecting to the web console
To access the web console from any device on the same subnet, open a browser and enter `http://[static_ip]:[port]`. Note that **_Constellation_** does not support HTTPS.

For example, if your static IP is 10.8.2.100, and your port is the default 8082, your web address would be `http://10.8.2.100:8082`. You can bookmark this address for future access.

### Configuration
_**Constellation**_ is configured using a series of pop-up dialogs accessible from the _Settings_ tab. The available dialogs are:

* _Server Settings_, for basic configuration;
* _Projectors_, for setting up PJLink and serial projectors;
* _Descriptions_, for providing short text descriptions for each component;
* _Wake on LAN_, for configuring machines to be controlled via Wake on LAN
* _Static Components_, for listing non-_**Constellation**_ exhibit pieces you wish to track.

These options are described in the sections below.

#### Controlling projectors
Control Server can manage projectors over IP using the PJLink protocol.

The PJLink protocol returns a defined set of information about the state of the connected projector. Each manufacturer implements the protocol slightly differently, so the available information may vary marginally.

To configure a PJLink projector, it should have a static IP address. Some projectors require a password, which you can also specify here.

#### Wake on LAN

Control Server can send Wake on LAN magic packets to power on machines connected to its network. 

To configure a component for Wake on LAN, you must specify its MAC address. If the given machine has a static IP address, you can also provide it. Control Server will ping that address at intervals to check if the machine is powered on. **To send pings on Windows, you must run Control Server with administrator privileges.**

#### Static Components

In order to view the real-time status of a component, it must be either running a **_Constellation_** app or sending pings that conform to the API. However, non-**_Constellation_** components can be added in order to make use of the maintenance tracking system.

#### Component descriptions

You can optionally specify a description for a component, which is displayed in the web console on that component's status page.

## Using the web console

The web console provides an interface for managing settings and seeing the real-time status of every component. It can be accessed through any web browser at the address `http://<control_server_ip>:<control_server_port>`.

Multiple users may access the web console simultaneously. However, if multiple users are editing settings at the same time, changes may get accidentally overwritten. It is recommended to assign one PC or one user to manage Control Server settings.

### Components tab

The _Components_ tab lists every managed component and projector. Each receives its own tile, which is color-coded by the device's current state. States update automatically, so there is no need to refresh the page.


#### States

| State     | Component                                                                                                                      | Projector                                | Wake on LAN                                                                               |
|-----------|--------------------------------------------------------------------------------------------------------------------------------|------------------------------------------|-------------------------------------------------------------------------------------------|
| ACTIVE    | Component is currently being interacted with                                                                                   | -                                        | -                                                                                         |
| ONLINE    | Component is responding                                                                                                        | Projector is responding, and powered on  | -                                                                                         |
| OFFLINE   | Component is not responding                                                                                                    | Projector is not responding              | WoL system is not responding                                                              |
| STANDBY   | -                                                                                                                              | Projector is responding, but powered off | -                                                                                         |
| STATIC    | Component has been added for maintenance tracking purposes.                                                                    | -                                        | -                                                                                         |
| SYSTEM ON | The computer is on, but no **_Constellation_** software is responding.                                                         | -                                        | The WoL system is responding to pings                                                     |
| WAITING   | The component was recently ONLINE. There may only be a temporary connectivity issue.  This is common if a display is sleeping. | -                                        | -                                                                                         |
| UNKNOWN   | -                                                                                                                              | -                                        | No IP address was supplied for this WoL system, so we cannot ping it to check its status. |

### Component status view

<img src="images/component_status_page.jpg" style="width: 40%; float: right; border: 2px solid gray; margin: 5px;"></img>

Clicking on a component opens its status view. Here, you can see a snapshot of the remote system's performance, select a definition, change settings, and add maintenance details.

#### Definitions pane

The definition pane allows you to select the app definition that you want to display. A given `component` can have only one active definition. If the definition you selected belongs to an app other than the one that is currently active, the app will be changed before the new definition is applied.

#### Maintenance pane

The maintenance pane allow you to track the maintenance status of the component. Four states are available:

* On floor, working
* On floor, not working
* Off floor, working
* Off floor, not working

In addition, you may add notes using the provided text box. Changes to the notes or status are not saved until the _Save changes_ button has been pressed.

##### System status

The system status area, located at the top of the maintenance pane, provides a summary of the performance of the computer running the component. These values are only estimates—if a component is behaving inconsistently, use the operating system's tools to diagnose the problem.

Note that CPU usage is not properly reported for PCs running Windows.

#### Settings pane

The settings pane allows you to quickly update certain component settings, as well as launch the full settings page for that component.

#### Projector status view

Clicking on a projector that is `ONLINE` or `STANDBY` will bring up its status page. Here, you can see an array of information reported by the projector using the PJLink protocol.

### Schedule tab

The _Schedule_ tab allows you to set recurring or one-off events within the gallery. The following options are available:

* Send power on, power off, and restart commands
* Refresh components
* Set the exhibit
* Set the definition for a component
* Set a DMX scene for a component
* Add an explanatory note

Note that sending power off and power on commands may affect different components differently. For projectors, this will sleep or wake them.

### Maintenance tab

<img src="images/issue_creation_modal.jpg" style="width: 50%; float: left; border: 2px solid gray; margin: 5px;"></img>

The Maintenance tab organizes information about the current state of the gallery and its components. It provides an easy interface for non-technical users to alert maintenance staff about a problem, as well as to see a summary of the overall gallery health.

#### Issues

Issues are not tied to a specific exhibit, but are a property of the overall space. They can be connected to a **_Constellation_** component or simply a note about the state of the facility. When creating an issue, you can give it a priority, assign it to a specific person, and connect it with a component. You can also upload images or videos for reference. If you're using the web console on a mobile device, you can even take the picture directly from within the interface.

Known issues can be filtered by priority and who they are assigned to.

### Analytics tab

The analytics tab allows you to configure Flexible Tracker, a powerful tool for creating data-collection interfaces.

<img src="images/tracker_example.jpg" style="width: 50%; float: right; border: 2px solid gray; margin: 5px;"></img>

Flexible Tracker enables the collection of a wide variety of quantitative and qualitative data using Control Server. Collected data can then be downloaded as a standard CSV file for opening in any spreadsheet software.

### Collection types
Flexible Tracker can collect a variety of data types. Each type provides a widget that makes inputting the data easy and reliable.

| Type     | Description                                                                                                                              |
|----------|------------------------------------------------------------------------------------------------------------------------------------------|
| Counter  | Count by whole numbers, like a traditional tally counter.                                                                                |
| Dropdown | Select one or more options from a list                                                                                                   |
| Number   | Record a single number, including decimals                                                                                               |
| Slider   | Record a single number, bounded in a user-defined range. The value is selected using a slider.                                           | -                                           |
| Text     | A textbox for inputting any text                                                                                                         |
| Timer    | Records the number of seconds. Can be started and stopped by the user. "Exclusive" timers pause all other exclusive timers when started. |

### Creating a template

<img src="images/tracker_template_edit.jpg" style="width: 50%; float: right; border: 2px solid gray; margin: 5px;"></img>

A _template_ defines the collection types available for a given session. It allows you to customize Flexible Tracker for your specific needs.

To create a template, navigate to the settings tab. In the Flexible Tracker section, select the template you want to edit, first creating it if necessary. Then, click _Edit_ to pop up the template editor. The left column contains the possible collection type widgets. Click on one to add it to the current layout, and customize its parameters using the fields in the right column.

With the left and right arrows, you can reorder how the widgets will appear. Because Flexible Tracker is a responsive web page, the exact arrangement of the widgets will depend on your device's screen size and shape.

### Recording data

To use Flexible Tracker for data collection, select your desired template from the web console settings view and click the _Launch_ button. All available templates will be available from the dropdown list. Once you are ready to send a session (one set of observations), press the Record button. This will transmit the data to Control Server for storage. Please note that a network connection to the server is required to send data; if such a connection is not available, a popup will appear and the Record button will be disabled.

Data are stored in Control Server under `flexible-tracker/data/<template name>.txt`. Each row is a single JSON object representing one session.

### Downloading and managing data

Once you have collected some data, you can easily download it as a comma-separated values (CSV) file that cane be read by Microsoft Excel or another data analysis app. To do so, go to the settings view from the web console and select the appropriate template. Then, click the "Download data" button and a CSV download will be initiated in your browser.

By clicking the _Clear data_ button, you can erase the existing data. This action cannot be undone.


### Settings tab

#### Changing the exhibit

Use the _Set current exhibit_ dropdown box to change the exhibit being displayed. **This change takes immediate effect and may result in an unsightly transition in public view.**

#### Creating and deleting exhibits

You can create and delete exhibits from the settings tab. When creating an exhibit, you can either create an empty exhibit (no definition for any component), or you can clone the existing exhibit.

### Hiding tabs

The tabs can be hidden from view by modifying the URL. For example, to hide the schedule tab, change the URL to read `http://[Your IP]:[Your Port]/webpage.html?hideSchedule`. To hide both the help and settings tabs, use `http://[Your IP]:[Your Port]/webpage.html?hideHelp&hideSettings`.

Hiding tabs can be useful when creating a status console for certain staff, without showing them the deeper configuration options. **Note that these options can be re-enabled simply by modifying the URL, so this is not a secure method of limiting access.**


