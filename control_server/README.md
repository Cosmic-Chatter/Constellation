# Control Server

## Introduction

<img src="images/Components_overview_tab.png" style="width: 40%; float: right; border: 2px solid gray; margin: 5px;"></img>

Control Server coordinates communication between **_Constellation_** components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.


## Terminology

* `gallery`: A physical space in which `exhibit`s take place.
* `exhibit`: The particular configuration of a `gallery`, including the inclusion or exclusion of specific `component`s and the `content` displayed by each `component`.
* `component`: A single display element within a `gallery`. This could be a projector, a screen, an iPad, or a hands-on mechanical interactive.
* `content`: The information being used by a `component`, such as text, images, video, and local configurations. Content specifies the file(s) on the component machine that should be used.
* `id`: A unique identifier for a given `component`. No two `component`s can have the same `id`.
* `type`: A user-defined grouping of `component`s. For example, if you have multiple screens each displaying similar information, you might assign them all the `type` of "INFO_SCREEN". `type`s allow you to send the same command to multiple devices. Every component must have a `type`.

## Setting up Control Server

### Configuring your environment
Many **_Constellation_** `components` will lose functionality if they cannot connect to Control Server. Thus, it is paramount that Control Server runs in a computing environment that is as stable as possible.

#### Environment requirements
* A static IP address
* On Windows, some secondary functionality requires running Control Server with administrator privileges

#### Environment recommendations
* Linux is strongly recommended as the operating system, followed by macOS. Everything should work under Windows, but testing is less thorough and the OS has lower uptime.
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
Control Server can manage projectors over IP using the PJLink protocol or serial commands (select models).

##### PJLink
The PJLink protocol returns a defined set of information about the state of the connected projector. Each manufacturer implements the protocol slightly differently, so the available information may vary marginally.

To configure a PJLink projector, it should have a static IP address. Some projectors require a password, which you can also specify here.

##### Serial (RS-232)
Control Server can also manage projectors that implement a serial-over-IP interface. You can also use a wireless serial adapter for projectors that do not implement serial-over-IP. Because every manufacturer implements a different set of functionality, the returned information is much more variable than over PJLink. **If PJLink is available, it is highly recommended.**

In addition to their IP address, you must specify the manufacturer (_Make_) of your device. Because some manufacturers vary their serial commands over generation, there is no guarantee that Control Server supports your model, even if your manufacturer is supported. The following makes are at least partially supported:

| Make      | Known compatible models |
|-----------|-------------------------|
| Barco     | F35                     |
| Christie  | DHD850-GS, Mirage HD8   |
| Optoma    |                         |
| Viewsonic |                         |

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

Clicking on a component opens its status view. Here, you can see a snapshot of the remote system's performance; manipulate its content and settings; and add maintenance details.

#### System status

The system status area, located at the top, provides a summary of the performance of the computer running the component. These values are only estimates—if a component is behaving inconsistently, use the operating system's tools to diagnose the problem.

Note that CPU usage is not properly reported for PCs running Windows.

#### Content pane

##### Content management

The content management area allows you to manipulate the displayed content for components that support it. Note that this panel only shows files managed by _**Constellation**_, including all content uploaded through the web console.

Content highlighted in blue is currently selected. To add or remove a piece of content, click it to toggle it. These changes are not saved until the _Save changes_ button is pressed.

By default, only content compatible with your _**Constellation**_ app is displayed. Uncheck the _Compatible_ box to see all the stored content.

Content can also be deleted from the system using the item's dropdown menu. Note that deleting content takes effect immediately and cannot be undone.

##### Content upload

New content can be uploaded using the bottom part of the Content pane. Click _Choose files_ and select one or more files that you wish to upload.

**Note that uploaded filenames cannot contain an equals sign (=).** If you upload a file with the same filename as a piece of existing content, the old file will be overwritten. The name of the file on your device will be carried over to the client.

#### Maintenance pane

The maintenance pane allow you to track the maintenance status of the component. Four states are available:

* On floor, working
* On floor, not working
* Off floor, working
* Off floor, not working

In addition, you may add notes using the provided text box. Changes to the notes or status are not saved until the _Save changes_ button has been pressed.

Changes to the maintenance status of a component are logged. These logs are in plain-text format in the `maintenance-logs` directory. Each line of a log is a JSON object containing the state at the time of submission.

#### Settings pane

The settings pane allows you to quickly update certain component settings, as well as launch the full settings page for that component.

Using the dropdown, you can change which _**Constellation**_ app is active on the component.

#### Projector status view

Clicking on a projector that is `ONLINE` or `STANDBY` will bring up its status page. Here, you can see an array of information reported by the projector using the PJLink protocol.

### Schedule tab

The _Schedule_ tab allows you to set recurring or one-off events within the gallery. The following options are available:

* Send power on, power off, and restart commands
* Refresh components
* Set the exhibit
* Set content for a single component

Note that sending power off and power on commands may affect different components differently. For projectors, this will sleep or wake them. For Wake on LAN devices with shutdown permitted, the machine will be shutdown.

### Issues tab

<img src="images/issue_creation_modal.jpg" style="width: 50%; float: left; border: 2px solid gray; margin: 5px;"></img>

The issues tab organizes information about the current state of the gallery and its components. It provides an easy interface for non-technical users to alert maintenance staff about a problem, as well as to see a summary of the overall gallery health.

#### Issues

Issues are not tied to a specific exhibit, but are a property of the overall space. They can be connected to a **_Constellation_** component or simply a note about the state of the facility. When creating an issue, you can give it a priority, assign it to a specific person, and connect it with a component. You can also upload a photo for reference. If you're using the web console on a mobile device, you can even take the picture directly from within the interface.

Known issues can be filtered by priority and who they are assigned to.

#### Maintenance overview

The maintenance overview summarizes the current state of the components. From the component status view on the _Components_ tab, maintenance staff can enter notes about various pieces, as well as categorize them into one of four groups:

- On the floor and working
- On the floor and not working
- Off the floor and working
- Off the floor and not working

The various components are grouped into these categories on the maintenance overview. The status bar underneath each `id` shows the fraction of time the component has been working or not working.

### Settings tab

#### Changing the exhibit

Use the _Set current exhibit_ dropdown box to change the exhibit being displayed. **This change takes immediate effect and may result in an unsightly transition in public view.**

#### Creating and deleting exhibits

You can create and delete exhibits from the settings tab. When creating an exhibit, you can either create an empty exhibit (no content for any component), or you can clone the existing exhibit.

### Hiding tabs

The tabs can be hidden from view by modifying the URL. For example, to hide the schedule tab, change the URL to read `http://[Your IP]:[Your Port]/webpage.html?hideSchedule`. To hide both the help and settings tabs, use `http://[Your IP]:[Your Port]/webpage.html?hideHelp&hideSettings`.

Hiding tabs can be useful when creating a status console for certain staff, without showing them the deeper configuration options. **Note that these options can be re-enabled simply by modifying the URL, so this is not a secure method of limiting access.**

## Using the Flexible Tracker

<img src="images/tracker_example.jpg" style="width: 50%; float: right; border: 2px solid gray; margin: 5px;"></img>

The Flexible Tracker enables the collection of a wide variety of quantitative and qualitative data using Control Server. Collected data can then be downloaded as a standard CSV file for opening in any spreadsheet software.

### Collection types
Flexible Tracker can collect a variety of data types. Each type provides a widget that makes inputting the data easy and reliable.

| Type       | Description                                                                                                                              | Required keywords                           | Optional keywords                                                                                                                                                                  |
|------------|------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `counter`  | Count by whole numbers, like a traditional tally counter.                                                                                | -                                           | `label`: string                                                                                                                                                                    |
| `dropdown` | Select one or more options from a list                                                                                                   | `options`: comma-separated list of strings. | `multiple`: true/false (default: false) `label`: string                                                                                                                            |
| `number`   | Record a single number, including decimals                                                                                               | -                                           | `label`: string                                                                                                                                                                    |
| `slider`   | Record a single number, bounded in a user-defined range. The value is selected using a slider.                                           | -                                           | `min`: number (default: 1) <br> `max`: number (default: 100) <br> `step`: number (default: 1) <br> `start`: Inital slider position (default: `(min + max)/2`) <br> `label`: string |
| `text`     | A textbox for inputting any text                                                                                                         | -                                           | `lines`: The height of the box in lines (default: 5) <br> `label`: string                                                                                                          |
| `timer`    | Records the number of seconds. Can be started and stopped by the user. "Exclusive" timers pause all other exclusive timers when started. | -                                           | `exclusive`: true/false (default: false) <br> `label`: string                                                                                                                      |

### Creating a template

<img src="images/tracker_template_edit.jpg" style="width: 50%; float: right; border: 2px solid gray; margin: 5px;"></img>

A _template_ defines the collection types available for a given session. It allows you to customize Flexible Tracker for your specific needs. The recommended way to create a template is through the web console.

#### Using the web console

To create a template, navigate to the settings tab. In the Flexible Tracker section, select the template you want to edit, first creating it if necessary. Then, click _Edit_ to pop up the template editor. The left column contains the possible collection type widgets. Click on one to add it to the current layout, and customize its parameters using the fields in the right column.

With the left and right arrows, you can reorder how the widgets will appear. Because Flexible Tracker is a responsive web page, the exact arrangement of the widgets will depend on your device's screen size and shape.

### Recording data

To use Flexible Tracker for data collection, select your desired template from the web console settings view and click the _Launch_ button. All available templates will be available from the dropdown list. Once you are ready to send a session (one set of observations), press the Record button. This will transmit the data to Control Server for storage. Please note that a network connection to the server is required to send data; if such a connection is not available, a popup will appear and the Record button will be disabled.

Data are stored in Control Server under `flexible-tracker/data/<template name>.txt`. Each row is a single JSON object representing one session.

### Downloading and managing data

Once you have collected some data, you can easily download it as a comma-separated values (CSV) file that cane be read by Microsoft Excel or another data analysis app. To do so, go to the settings view from the web console and select the appropriate template. Then, click the "Download data" button and a CSV download will be initiated in your browser.

By clicking the _Clear data_ button, you can erase the existing data. This action cannot be undone.

