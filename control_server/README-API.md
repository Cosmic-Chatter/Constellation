# Integrating with **_Constellation_**
Control Server communicates with `component`s using HTTP requests. Connecting a custom `component` is as simple as sending and receiving the appropriate requests.

## Required actions

### Pings

Control Server does not search for new `component`s. Rather, each `component` must send a request to the known static IP of the server. This is called a _ping_. A ping should be sent to the endpoint `/system/ping` every five seconds as a POST request containing a JSON object with the following properties.


| Field   | Type | Value | Required | Meaning |
| -----   | --------- |--------- | --------- | --------- |
| id | String | A unique, user-defined value| Yes | - |
| type | String | A user-defined value | Yes | - |
| allowed_actions | array of strings | Any subset of ["restart", "shutdown", "sleep"] | No | Sending these values indicates that the `component` is able and willing to respond to their corresponding commands. Don't send an action if you have not implemented a method of responding to it. |
| currentInteraction | String | "true" or "false" | No | Send "true" if the `component` has been interacted with in the last 30 seconds. Send "false" if it has not. For a `component` with an attractor, you can also send "true" if the attractor is not displayed. |
| error | JSON object | The keys of the stringified object should be the names of the errors, with the values being a short error message | No | This field allows you to report errors or warnings, which will be displayed on the web console. |
| helperAddress | String | An HTTP address, including the port, of a server capable of responding to requests | No | This is required for the `component` to respond to certain commands, such as shutting down or restarting. |


### Commands

Your system should implement as many of these commands as makes sense for your use case. These actions enable **_Constellation_** to remotely control your `component` and integrate it into schedules.

Commands are passed to the `component` as responses to a ping. The returned JSON object will have a `commands` field containing a list of string commands. If you implement any of `power_on`, `power_off`, `restart`, `shutdown`, or `sleepDisplays`, make sure you have indicated this in the `allowed_actions` field of every ping.

| Command                      | Intended action                                                  | Notes |
|------------------------------|------------------------------------------------------------------| ----- |
| `disableAutoplay`            | Stop any automatic cycling of the `content`                      | - |
| `enableAutoplay`             | Resume any automatic cycling of the `content`                    | - |
| `pauseVideo`                 | Pause any currently playing video                                | -|
| `playVideo`                  | Start or resume play of a video                                  | - |
| `power_off`                  | Alias of `shutdown`                                              | - |
| `power_on`                   | Alias of `wakeDisplay`                                           | If you want to wake the PC from a shutdown, make sure it is capable of wake on LAN and add the MAC address to the `[WAKE_ON_LAN]` section of  `currentExhibitConfiguration` |
| `refresh_page`               | Refresh the browser window or reset the current screen           | - |
| `reloadDefaults`             | Reset the `component` to its initial condition                   | - |
| `restart`                    | Initiate a restart of the PC                                     | - |
| `seekVideo_[back/forward]_X` | Seek video X% in the given directoni | For example, `seekVideo_back_10` will rewind by amount equal to 10% of the video's length. |
| `shutdown`                   | Shutdown the PC                                                  | This command should only be implemented if the PC can be woken by wake on LAN. If `shutdown` is not implemented, but `sleep` is, then make `shutdown` an alias of `sleep` so that the display can be put to sleep on a `shutdown` command. |
| `sleepDisplay`               | Put the PC's display to sleep                                    | - |
| `toggleAutoplay`             | If `content` is automatically cycling, stop that. If not, start it | - |
| `wakeDisplay`                | Wake the PC's display                                            | - |

### Example

To send a ping, you create a JSON object as shown below and send it to the IP address and port of the Control Server.

```json
{
  "id": "YOUR_ID",
  "type": "YOUR_TYPE",
  "helperAddress": "10.8.0.12:8082",
  "allowed_actions": ["sleep", "restart"]
 }
```

Control Server will send a response to this request with the following form:

```json
{
  "commands": ["wakeDisplay"]
}
```

## Optional actions

Your `component` may also send commands to Control Server to manipulate the state of the server or other `components`. These commands are sent as HTTP requests to the appropriate endpoint.

When Control Server receives a command, it will respond with an acknowledgement in the form of a JSON object. Check the `success` field to determine if the command ran successfully. It will be either `true` or `false`. If `success === false`, there will be a `reason` field indicating why the operation failed.

### General

#### `/system/reloadConfiguration`
Instruct Control Server to reload its state from `galleryConfiguration.ini`.

Method: `GET`

| Required fields | Optional fields | Response fields      | Notes    |
|-----------------|-----------------|----------------------|----------|
| -               | -               | `success`: [`true` \ | `false`] | - |

### Exhibit components

#### `/exhibit/queueCommand`

Send a command to a specific `component`. The _Commands_ section above defines commands that should be widely available in **_Constellation_**. In addition, you can specify custom commands as a single string that your custom `component` can understand. Control Server will route them without needing to understand them.

Method: `POST`

| Required fields                                                                                         | Optional fields | Response fields                           | Notes    |
|---------------------------------------------------------------------------------------------------------|-----------------|-------------------------------------------|----------|
| `command`: (string) The command to queue <p> `id`: (string) The component the command should be sent to | -               | `reason`: String <p> `success`: [`true` \ | `false`] | - |

### Projectors

#### `/projectors/getUpdate`
Retrieve the current state of the specified projector.

Method: `POST`

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `id`: (string) The projector to query | - | `reason`: string <p> `state`: A JSON object of projector properties <p> `status`: [`"DELETE"` \| `null`] <p>`success`: [`true` \| `false`] | If `status  == "DELETE"`, the projector no longer exists and should be removed. |


#### `/projector/queueCommand`

Send a command to a specific projector.

Method: `POST`

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `queueCommand` <p> `class`: `webpage` <p> `command`: (string) The command to queue <p> `id`: (string) The projector the command should be sent to| - | `reason`: String <p> `success`: [`true` \| `false`] | - |

For projectors that support PJLink, the following commands are supported:
* `error_status`
* `get_model`
* `lamp_status`
* `power_off`
* `power_on`
* `power_state`

For projectors connected via serial commands over Ethernet, command support is manufacturer dependent. Even for supported manufacturers, every model may not be supported.

| Command | Manufacturer support |
| ------- | -------------------- |
| `error_status` | Barco, Christie, Optoma, Viewsonic |
| `get_model` | Barco, Christie, Optoma, Viewsonic |
| `get_source` | Barco |
| `lamp_status` | Barco, Christie |
| `power_off` | Barco, Christie, Optoma, Viewsonic |
| `power_on` | Barco, Christie, Optoma, Viewsonic |
| `power_state` | Barco, Christie, Optoma, Viewsonic |
| `set_dvi_1` | Barco |
| `set_dvi_2` | Barco |
| `set_hdmi_1` | Barco |
| `set_hdmi_2` | Barco |
| `set_vga_1` | Barco |
| `set_vga_2` | Barco |
| `shutter_close` | Christie |
| `shutter_open` | Christie |
| `shutter_state` | Christie |
| `video_mute` | Christie |
| `video_mute_state` | Christie |
| `video_unmute` | Christie |



##### `updateSchedule`

Create a new schedule entry or update an existing one.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `updateSchedule` <p> `action_to_set`: (string) the name of the scheduled action <p> `class`: `webpage` <p> `isAddition`: [`true` \| `false`] <p> `timeToSet`: (string) The time for the scheduled action | `targetToSet`: (string) Some commands, such as "set_exhibit" need to specify a value to be set. | `class`: `"schedule"` <p> `nextEvent`: (JSON object) The next scheduled event <p> `reason`: String <p> `schedule`: (array) The updated schedule <p> `success`: [`true` \| `false`] <p> `updateTime`: (int) A time value to check the order of schedule changes | No two items on the same schedule can have the same time. |

##### `refreshSchedule`

Retrieve the current schedule.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `refreshSchedule` <p> `class`: `webpage` | - | `class`: `"schedule"` <p> `nextEvent`: (JSON object) The next scheduled event <p> `schedule`: (array) The updated schedule <p> `success`: [`true` \| `false`] <p> `updateTime`: (int) A time value to check the order of schedule changes | - |

##### `convertSchedule`

Convert a recurring schedule to a date-specific schedule. Converting a schedule is non-destructive; a date-specific schedule is created that supercedes the recurring schedule, but the existing recurring schedule is not altered.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `convertSchedule` <p> `class`: `webpage` <p> `date`: (string) The date of the requested date-specific schedule <p> `from`: (string) The recurring schedule that should be converted. | - | `class`: `"schedule"` <p> `nextEvent`: (JSON object) The next scheduled event <p> `reason`: String <p> `schedule`: (array) The updated schedule <p> `success`: [`true` \| `false`] <p> `updateTime`: (int) A time value to check the order of schedule changes | - |

##### `deleteSchedule`

Delete a specific schedule.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `deleteSchedule` <p> `class`: `webpage` <p> `name`: (string) The name of the schedule that should be deleted | - | `class`: `"schedule"` <p> `nextEvent`: (JSON object) The next scheduled event <p> `reason`: String <p> `schedule`: (array) The updated schedule <p> `success`: [`true` \| `false`] <p> `updateTime`: (int) A time value to check the order of schedule changes | - |

##### `deleteScheduleAction`

Delete an action from a specified schedule. The action is identified by its scheduled time.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `deleteScheduleAction` <p> `class`: `webpage` <p> `from`: (string) The  schedule from which the action should be deleted. <p> `time`: (string) The time of the action that should be deleted| - | `class`: `"schedule"` <p> `nextEvent`: (JSON object) The next scheduled event <p> `reason`: String <p> `schedule`: (array) The updated schedule <p> `success`: [`true` \| `false`] <p> `updateTime`: (int) A time value to check the order of schedule changes | - |

##### `setExhibit`

Instruct Control Server to change the `exhibit`.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `setExhibit` <p> `class`: `webpage` <p> `name`: (string) The exhibit that should be set | - | `reason`: (string) <p> `success`: [`true` \| `false`] | - |

##### `createExhibit`

Create a new `exhibit` definition. This can be created as an empty file or cloned from an existing `exhibit`.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `createExhibit` <p> `class`: `webpage` <p> `name`: (string) The name of the exhibit to be created | `cloneFrom`: (string) The name of an exhibit that should be cloned. | `reason`: (string) <p> `success`: [`true` \| `false`] | - |

##### `deleteExhibit`

Instruct Control Server to delete an `exhibit`.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `deleteExhibit` <p> `class`: `webpage` <p> `name`: (string) The exhibit that should be deleted | - | `reason`: (string) <p> `success`: [`true` \| `false`] | - |

##### `setComponentContent`

Change the active `content` for a `component`.

| Required fields | Optional fields | Response fields | Notes |
| --------------- | --------------- | --------------------- | ----- |
| `action`: `setComponentContent` <p> `class`: `webpage` <p> `content`: (array of strings) The `content` to set <p> `id`: (string) The `component` that is being changed | - | `reason`: (string) <p> `success`: [`true` \| `false`] | - |

#### Tracker actions
