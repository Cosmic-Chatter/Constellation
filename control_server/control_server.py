# Constellation Control Server
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
import configparser
import datetime
import threading
from functools import lru_cache
import json
import logging
import os
import pickle
import shutil
import signal
import socket
import sys
import time
import traceback
from typing import Any, Union
import urllib.request
import uvicorn

# Non-standard modules
import aiofiles
import dateutil.parser
from fastapi import FastAPI, Body, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Constellation modules
import config as c_config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_maintenance as c_maint
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tools as c_tools
import constellation_tracker as c_track


# Set up the automatic documentation
def constellation_schema():
    # Cached version
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Constellation Control Server",
        version=str(c_config.software_version),
        description="Control Server coordinates communication between Constellation components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.",
        routes=app.routes,
    )
    openapi_schema["info"] = {
        "title": "Constellation Control Server",
        "version": str(c_config.software_version),
        "description": "Control Server coordinates communication between Constellation components and provides a web-based interface for controlling them. It also provides tools for collecting qualitative and quantitative data, tracking maintenance, and logging exhibit issues.",
        "contact": {
            "name": "Morgan Rehnberg",
            "url": "https://cosmicchatter.org/constellation/constellation.html",
            "email": "MRehnberg@adventuresci.org"
        },
        "license": {
            "name": "MIT License",
            "url": "https://opensource.org/licenses/MIT"
        },
    }
    app.openapi_schema = openapi_schema
    return app.openapi_schema


def send_webpage_update():
    """Collect the current exhibit status, format it, and send it back to the web client to update the page."""

    component_dict_list = []
    for item in c_config.componentList:
        temp = {"id": item.id,
                "group": item.group}
        if "content" in item.config:
            temp["content"] = item.config["content"]
        if "error" in item.config:
            temp["error"] = item.config["error"]
        if "allowed_actions" in item.config:
            temp["allowed_actions"] = item.config["allowed_actions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        if "AnyDeskID" in item.config:
            temp["AnyDeskID"] = item.config["AnyDeskID"]
        if "image_duration" in item.config:
            temp["image_duration"] = item.config["image_duration"]
        if "autoplay_audio" in item.config:
            temp["autoplay_audio"] = item.config["autoplay_audio"]
        temp["class"] = "exhibitComponent"
        temp["status"] = item.current_status()
        temp["lastContactDateTime"] = item.last_contact_datetime
        temp["ip_address"] = item.ip_address
        temp["helperAddress"] = item.helperAddress
        temp["constellation_app_id"] = item.config["app_name"]
        temp["platform_details"] = item.platform_details
        temp["latency"] = item.latency
        component_dict_list.append(temp)

    for item in c_config.projectorList:
        temp = {"id": item.id,
                "group": item.group,
                "ip_address": item.ip_address}
        if "allowed_actions" in item.config:
            temp["allowed_actions"] = item.config["allowed_actions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        temp["class"] = "projector"
        temp["state"] = item.state
        temp["protocol"] = item.connection_type
        temp["status"] = item.state["status"]
        temp["latency"] = item.latency
        component_dict_list.append(temp)

    for item in c_config.wakeOnLANList:
        temp = {"id": item.id,
                "group": 'WAKE_ON_LAN',
                "ip_address": item.ip_address}
        if "allowed_actions" in item.config:
            temp["allowed_actions"] = item.config["allowed_actions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        temp["class"] = "wolComponent"
        temp["status"] = item.state["status"]
        temp["latency"] = item.latency
        component_dict_list.append(temp)

    # Also include an object with the status of the overall gallery
    temp = {"class": "gallery",
            "current_exhibit": c_config.current_exhibit,
            "availableExhibits": c_config.exhibit_list,
            "galleryName": c_config.gallery_name,
            "updateAvailable": str(c_config.software_update_available).lower()}
    component_dict_list.append(temp)

    # Also include an object containing the current issues
    temp = {"class": "issues",
            "issueList": [x.details for x in c_config.issueList],
            "lastUpdateDate": c_config.issueList_last_update_date,
            "assignable_staff": c_config.assignable_staff}
    component_dict_list.append(temp)

    # Also include an object containing the current schedule
    c_sched.retrieve_json_schedule()
    with c_config.scheduleLock:
        temp = {"class": "schedule",
                "updateTime": c_config.scheduleUpdateTime,
                "schedule": c_config.json_schedule_list,
                "nextEvent": c_config.json_next_event}
        component_dict_list.append(temp)

    return component_dict_list


def command_line_setup() -> None:
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    c_tools.clear_terminal()
    print("##########################################################")
    print("Welcome to Constellation Control Server!")
    print("")
    print("This appears to be your first time running Control Server.")
    print("In order to set up your configuration, you will be asked")
    print("a few questions. If you don't know the answer, or wish to")
    print("accept the default, just press the enter key.")
    print("")
    c_config.gallery_name = input("Enter a name for the gallery (default: Constellation): ").strip()
    if c_config.gallery_name == "":
        c_config.gallery_name = "Constellation"
    settings_dict["gallery_name"] = c_config.gallery_name

    default_ip = socket.gethostbyname(socket.gethostname())
    ip_address = input(f"Enter this computer's static IP address (default: {default_ip}): ").strip()
    if ip_address == "":
        ip_address = default_ip
    settings_dict["ip_address"] = ip_address

    default_port = 8082
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((ip_address, default_port)) != 0:
                # Port is free
                break
            else:
                default_port += 1
    port = input(f"Enter the desired port (default: {default_port}): ").strip()
    if port == "":
        port = default_port
    else:
        port = int(port)
    settings_dict["port"] = port

    settings_dict["current_exhibit"] = "default"
    # Create this exhibit file if it doesn't exist
    if not os.path.exists(c_tools.get_path(["exhibits", "default.json"], user_file=True)):
        c_exhibit.create_new_exhibit("default", None)

    # Write new system config to file
    config_path = c_tools.get_path(["configuration", "system.json"], user_file=True)
    c_tools.write_json(settings_dict, config_path)


def convert_galleryConfigurationINI_to_json(ini: configparser.ConfigParser) -> None:
    """Take a legacy galleryConfiguration.ini file and convert it to the appropriate JSON files."""

    current = ini["CURRENT"]
    new_config = {
        "current_exhibit": os.path.splitext(current.get("current_exhibit", "default.exhibit"))[0],
        "debug": current.getboolean("debug", False),
        "gallery_name": current.get("gallery_name", "Constellation"),
        "ip_address": current.get("server_ip_address", "localhost"),
        "port": current.getint("server_port", 8080),
    }
    staff_list = current.get("assignable_staff", "")
    new_config["assignable_staff"] = [x.strip() for x in staff_list.split(",")]

    # Write new system config to file
    config_path = c_tools.get_path(["configuration", "system.json"], user_file=True)
    c_tools.write_json(new_config, config_path)

    # Then, check for other sections that also need to be converted
    try:
        component_descriptions = dict(ini["COMPONENT_DESCRIPTIONS"])
        # We have found legacy description definitions
        c_exhibit.convert_descriptions_config_to_json(component_descriptions)
    except KeyError:
        pass

    try:
        pjlink_projectors = ini["PJLINK_PROJECTORS"]
        # We have found legacy PJLink projector configuration... convert this to the new JSON format
        c_proj.convert_config_to_json(dict(pjlink_projectors), "pjlink")
    except KeyError:
        pass

    try:
        serial_projectors = ini["SERIAL_PROJECTORS"]
        # We have found legacy serial projector configuration... convert this to the new JSON format
        c_proj.convert_config_to_json(dict(serial_projectors), "serial")
    except KeyError:
        pass

    try:
        wol = ini["WAKE_ON_LAN"]
        # We have a legacy Wake on LAN device definition
        c_exhibit.convert_wake_on_LAN_to_json(dict(wol))
    except KeyError:
        pass

    try:
        static = ini["STATIC_COMPONENTS"]
        # We have a legacy static components definition
        c_exhibit.convert_static_config_to_json(dict(static))
    except KeyError:
        pass

    # Rename galleryConfiguration.ini
    shutil.move(c_tools.get_path(["galleryConfiguration.ini"], user_file=True),
                c_tools.get_path(["galleryConfiguration.old.ini"], user_file=True))


def load_default_configuration() -> None:
    """Initialize the server in a default state."""

    # First, check for a legacy configuration file
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    if os.path.exists(gal_path):
        config_reader = configparser.ConfigParser(delimiters="=")
        config_reader.optionxform = str  # Override default, which is case in-sensitive

        with c_config.galleryConfigurationLock:
            config_reader.read(gal_path)
        try:
            _ = config_reader["CURRENT"]
            # We gave a legacy configuration file; convert it to JSON
            convert_galleryConfigurationINI_to_json(config_reader)
        except KeyError:
            pass

    # Also check for legacy exhibit files
    exhibit_path = c_tools.get_path(["exhibits"], user_file=True)
    for file in os.listdir(exhibit_path):
        if os.path.splitext(file)[1].lower() == '.exhibit':
            c_exhibit.convert_exhibits_ini_to_json(c_tools.get_path(["exhibits", file], user_file=True))

    # Check if there is a configuration file
    config_path = c_tools.get_path(["configuration", "system.json"], user_file=True)
    if not os.path.exists(config_path):
        # We don't have a config file, so let's get info from the user to create one
        command_line_setup()
    c_tools.load_system_configuration()

    c_tools.start_debug_loop()
    c_sched.retrieve_json_schedule()
    c_exhibit.read_descriptions_configuration()
    c_proj.read_projector_configuration()
    c_exhibit.read_wake_on_LAN_configuration()
    c_exhibit.read_static_components_configuration()
    c_exhibit.read_exhibit_configuration(c_config.current_exhibit)

    # Update the components that their configuration may have changed
    for component in c_config.componentList:
        component.update_configuration()

    # Build any existing issues
    c_issues.read_issue_list()


def quit_handler(*args) -> None:
    """Handle cleanly shutting down the server."""

    try:
        if c_config.rebooting is True:
            exit_code = 1
            print("\nRebooting server...")
        else:
            exit_code = 0
            print('\nKeyboard interrupt detected. Cleaning up and shutting down...')
    except RuntimeError:
        exit_code = 0

    # Save the current component lists to a pickle file so that
    # we can resume from the current state
    path_to_write = c_tools.get_path(["current_state.dat"], user_file=True)
    with open(path_to_write, 'wb') as f:
        pickle.dump(c_config.componentList, f)

    for key in c_config.polling_thread_dict:
        c_config.polling_thread_dict[key].cancel()

    for component in c_config.componentList:
        component.clean_up()
    for component in c_config.projectorList:
        component.clean_up()
    for component in c_config.wakeOnLANList:
        component.clean_up()

    with c_config.logLock:
        logging.info("Server shutdown")

    with c_config.galleryConfigurationLock:
        with c_config.scheduleLock:
            with c_config.trackingDataWriteLock:
                sys.exit(exit_code)


def error_handler(*exc_info) -> None:
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with c_config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see control_server.log for more details ({datetime.datetime.now()})")


def check_for_software_update() -> None:
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/control_server/version.txt"):
            if float(line.decode('utf-8')) > c_config.software_version:
                c_config.software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("cannot connect to update server")
        return
    if c_config.software_update_available:
        print("update available!")
    else:
        print("the server is up to date.")


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
c_config.EXEC_PATH = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    c_config.APP_PATH = os.path.dirname(sys.executable)
else:
    c_config.APP_PATH = c_config.EXEC_PATH

# Set up log file
log_path: str = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
signal.signal(signal.SIGINT, quit_handler)
sys.excepthook = error_handler

with c_config.logLock:
    logging.info("Server started")

# Try to reload the previous state from the pickle file current_state.dat
try:
    state_path = c_tools.get_path(["current_state.dat"], user_file=True)
    with open(state_path, "rb") as previous_state:
        c_config.componentList = pickle.load(previous_state)
        print("Previous server state loaded")
except (FileNotFoundError, EOFError):
    print("Could not load previous server state")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.openapi = constellation_schema


@lru_cache()
def get_config():
    return c_config


# Exhibit component actions

class Exhibit(BaseModel):
    name: str = Field(
        description="The name of the exhibit"
    )


class ExhibitComponent(BaseModel):
    id: str = Field(
        description="A unique identifier for this component",
        title="ID"
    )


@app.post("/exhibit/create")
async def create_exhibit(exhibit: Exhibit,
                         clone_from: Union[str, None] = Body(default=None,
                                                             description="The name of the exhibit to clone.")):
    """Create a new exhibit JSON file."""

    c_exhibit.create_new_exhibit(exhibit.name, clone_from)
    return {"success": True, "reason": ""}


@app.post("/exhibit/delete")
async def delete_exhibit(exhibit: Exhibit = Body(embed=True)):
    """Delete the specified exhibit."""

    c_exhibit.delete_exhibit(exhibit.name)
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueCommand")
async def queue_command(component: ExhibitComponent,
                        command: str = Body(description="The command to be sent to the specified component")):
    """Queue the specified command for the exhibit component to retrieve."""

    c_exhibit.get_exhibit_component(component.id).queue_command(command)
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueWOLCommand")
async def queue_WOL_command(component: ExhibitComponent,
                            command: str = Body(description="The command to be sent to the specified component")):
    """Queue the Wake on Lan command for the exhibit component to retrieve."""

    c_exhibit.get_wake_on_LAN_component(component.id).queue_command(command)
    return {"success": True, "reason": ""}


@app.post("/exhibit/removeComponent")
async def queue_command(component: ExhibitComponent = Body(embed=True)):
    """Queue the specified command for the exhibit component to retrieve."""

    to_remove = c_exhibit.get_exhibit_component(component.id)
    print("Removing component:", component.id)
    to_remove.remove()
    return {"success": True, "reason": ""}


@app.post("/exhibit/set")
async def set_exhibit(exhibit: Exhibit = Body(embed=True)):
    """Set the specified exhibit as the current one."""

    print("Changing exhibit to:", exhibit.name)
    c_tools.update_system_configuration({"current_exhibit": exhibit.name})
    c_exhibit.read_exhibit_configuration(exhibit.name)

    # Update the components that the configuration has changed
    for component in c_config.componentList:
        component.update_configuration()
    return {"success": True, "reason": ""}


@app.post("/exhibit/setComponentContent")
async def set_component_content(component: ExhibitComponent,
                                content: list[str] = Body(description="The content to be set")):
    """Change the active content for the given exhibit component."""

    if c_config.debug:
        print(f"Changing content for {component.id}:", content)
    c_exhibit.update_exhibit_configuration(component.id, {"content": content})
    return {"success": True, "reason": ""}


@app.post("/exhibit/setComponentApp")
async def set_component_app(component: ExhibitComponent,
                            app_name: str = Body(description="The app to be set")):
    """Change the active app for the given exhibit component."""

    print(f"Changing app for {component.id}:", app_name)
    c_exhibit.update_exhibit_configuration(component.id, {"app_name": app_name})
    return {"success": True, "reason": ""}


# Flexible Tracker actions
@app.post("/tracker/{tracker_type}/createTemplate")
async def create_tracker_template(data: dict[str, Any], tracker_type: str):
    """Create a new tracker template, overwriting if necessary."""

    if "name" not in data or "template" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' or 'template' field."}
        return response
    name = data["name"]
    if not name.lower().endswith(".ini"):
        name += ".ini"
    file_path = c_tools.get_path([tracker_type, "templates", name], user_file=True)
    success = c_track.create_template(file_path, data["template"])
    response = {"success": success}
    return response


@app.post("/tracker/{tracker_type}/deleteData")
async def delete_tracker_data(data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker data file."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    name = data["name"]
    if name is None or name.strip() == "":
        response = {"success": False,
                    "reason": "'name' field is blank."}
        return response
    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = c_tools.get_path([tracker_type, "data", name], user_file=True)
    success = True
    reason = ""
    with c_config.trackingDataWriteLock:
        try:
            os.remove(data_path)
        except PermissionError:
            success = False
            reason = f"You do not have write permission for the file {data_path}"
        except FileNotFoundError:
            success = True  # This error results in the user's desired action!
            reason = f"File does not exist: {data_path}"
    if reason != "":
        print(reason)
    response = {"success": success,
                "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/deleteTemplate")
async def delete_tracker_template(data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker template."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    file_path = c_tools.get_path([tracker_type, "templates", data["name"] + ".ini"], user_file=True)
    with c_config.trackerTemplateWriteLock:
        response = c_tools.delete_file(file_path)
    return response


@app.get("/tracker/{tracker_type}/getAvailableData")
async def get_available_tracker_data(tracker_type: str):
    """Send a list of all the available data files for the given tracker group."""

    data_path = c_tools.get_path([tracker_type, "data"], user_file=True)
    data_list = []
    for file in os.listdir(data_path):
        if file.lower().endswith(".txt"):
            data_list.append(file)
    response = {"success": True,
                "data": data_list}
    return response


@app.get("/tracker/{tracker_type}/getAvailableDefinitions")
async def get_available_tracker_definitions(tracker_type: str):
    """Send a list of all the available definitions for the given tracker group (usually flexible-tracker)."""

    definition_list = []
    template_path = c_tools.get_path([tracker_type, "templates"], user_file=True)
    for file in os.listdir(template_path):
        if file.lower().endswith(".ini"):
            definition_list.append(file)

    return definition_list


@app.post("/tracker/{tracker_type}/getDataAsCSV")
async def get_tracker_data_csv(data: dict[str, Any], tracker_type: str):
    """Return the requested data file as a CSV string."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    name = data["name"]
    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = c_tools.get_path([tracker_type, "data", name], user_file=True)
    if not os.path.exists(data_path):
        return {"success": False, "reason": f"File {data['name']}.json does not exist!", "csv": ""}
    result = c_track.create_CSV(data_path)
    return {"success": True, "csv": result}


@app.post("/tracker/{tracker_type}/getLayoutDefinition")
async def get_tracker_layout_definition(data: dict[str, Any], tracker_type: str):
    """Load the requested INI file and return it as a dictionary."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response

    layout_definition, success, reason = c_track.get_layout_definition(data["name"] + ".ini", kind=tracker_type)

    response = {"success": success,
                "reason": reason,
                "layout": layout_definition}
    return response


@app.post("/tracker/{tracker_type}/getRawText")
async def get_tracker_raw_text(data: dict[str, Any], tracker_type: str):
    """Load the contents of the appropriate file and return them."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    result, success, reason = c_track.get_raw_text(data["name"] + ".txt", tracker_type)
    response = {"success": success, "reason": reason, "text": result}
    return response


@app.post("/tracker/submitAnalytics")
async def submit_analytics(data: dict[str, Any]):
    """Write the provided analytics data to file."""

    if "data" not in data or 'name' not in data:
        response = {"success": False,
                    "reason": "Request missing 'data' or 'name' field."}
        return response
    file_path = c_tools.get_path(["analytics", data["name"] + ".txt"], user_file=True)
    success, reason = c_track.write_JSON(data["data"], file_path)
    response = {"success": success, "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/submitData")
async def submit_tracker_data(data: dict[str, Any], tracker_type: str):
    """Record the submitted data to file."""

    if "data" not in data or "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'data' or 'name' field."}
        return response
    file_path = c_tools.get_path([tracker_type, "data", data["name"] + ".txt"], user_file=True)
    success, reason = c_track.write_JSON(data["data"], file_path)
    response = {"success": success, "reason": reason}
    return response


@app.post("/tracker/{tracker_type}/submitRawText")
async def submit_tracker_raw_text(data: dict[str, Any], tracker_type: str):
    """Write the raw text in data['text'] to file.

    Set data['mode'] == 'a' to append or 'w' to overwrite the file.
    """

    if "text" not in data or "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'text' or 'name' field."}
        return response
    mode = data.get("mode", "a")
    if mode != "a" and mode != "w":
        response = {"success": False,
                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
        return response
    success, reason = c_track.write_raw_text(data["text"], data["name"] + ".txt", kind=tracker_type, mode=mode)
    response = {"success": success, "reason": reason}
    return response


# Issue actions
@app.post("/issue/create")
async def create_issue(details: dict[str, Any] = Body(embed=True)):
    """Create a new issue."""

    c_issues.create_issue(details)
    c_issues.save_issue_list()
    return {"success": True}


@app.post("/issue/delete")
async def delete_issue(id_to_delete: str = Body(description="The ID of the issue to delete.", embed=True)):
    """Delete an issue."""

    c_issues.remove_issue(id_to_delete)
    c_issues.save_issue_list()
    return {"success": True, "reason": ""}


@app.post("/issue/deleteMedia")
async def delete_issue_media(filename: str = Body(description="The filename to be deleted."),
                             owner: Union[str, None] = Body(default=None, description="The ID of the Issue this media file belonged to.")):
    """Delete the media file linked to an issue and remove the reference."""

    c_issues.delete_issue_media_file(filename, owner=owner)
    return {"success": True}


@app.post("/issue/edit")
async def edit_issue(details: dict[str, Any] = Body(description="The details to be changed.", embed=True)):
    """Make changes to an existing issue."""

    if "id" in details:
        c_issues.edit_issue(details)
        c_issues.save_issue_list()
        response_dict = {"success": True}
    else:
        response_dict = {
            "success": False,
            "reason": "'details' must include property 'id'"
        }
    return response_dict


@app.get("/issue/list")
async def get_issue_list():
    """Return a list of open issues."""

    response = {
        "success": True,
        "issueList": [x.details for x in c_config.issueList]
    }
    return response


@app.post("/issue/uploadMedia")
async def upload_issue_media(files: list[UploadFile] = File()):
    """Upload a media file and attach it to a specific issue."""

    filename = None
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = str(round(time.time() * 1e6)) + ext
        file_path = c_tools.get_path(["issues", "media", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with c_config.issueMediaLock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
    return {"success": True, "filename": filename}


# Maintenance actions
@app.post("/maintenance/deleteRecord")
async def delete_maintenance_record(data: dict[str, Any]):
    """Delete the specified maintenance record."""

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
    else:
        file_path = c_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
        with c_config.maintenanceLock:
            response = c_tools.delete_file(file_path)
    return response


@app.get("/maintenance/getAllStatuses")
async def get_all_maintenance_statuses():
    """Send a list of all the maintenance statuses for known components"""

    record_list = []
    maintenance_path = c_tools.get_path(["maintenance-logs"], user_file=True)
    for file in os.listdir(maintenance_path):
        if file.lower().endswith(".txt"):
            with c_config.maintenanceLock:
                file_path = os.path.join(maintenance_path, file)
                record_list.append(c_maint.get_maintenance_report(file_path))
    response_dict = {"success": True,
                     "records": record_list}
    return response_dict


@app.post("/maintenance/getStatus")
async def get_maintenance_status(data: dict[str, Any]):
    """Return the specified maintenance status"""

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
        return response
    file_path = c_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    with c_config.maintenanceLock:
        response_dict = c_maint.get_maintenance_report(file_path)
    return response_dict


@app.post("/maintenance/updateStatus")
async def update_maintenance_status(data: dict[str, Any]):
    """Poll the projector for an update and return it"""

    if "id" not in data or "status" not in data or "notes" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id', 'status', or 'notes' field."}
        return response
    file_path = c_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    record = {"id": data["id"],
              "date": datetime.datetime.now().isoformat(),
              "status": data['status'],
              "notes": data["notes"]}
    with c_config.maintenanceLock:
        try:
            with open(file_path, 'a', encoding='UTF-8') as f:
                f.write(json.dumps(record) + "\n")
            success = True
            reason = ""
        except FileNotFoundError:
            success = False
            reason = f"File path {file_path} does not exist"
        except PermissionError:
            success = False
            reason = f"You do not have write permission for the file {file_path}"
    return {"success": success, "reason": reason}


# Projector actions

# @app.post("/projector/getUpdate")
# async def get_projector_update(projector: ExhibitComponent = Body(embed=True)):
#     """Poll the projector for an update and return it"""
#
#     proj = c_proj.get_projector(projector.id)
#     if proj is not None:
#         response_dict = {"success": True,
#                          "state": proj.state}
#     else:
#         response_dict = {"success": False,
#                          "reason": f"Projector {projector.id} does not exist",
#                          "status": "DELETE"}
#     return response_dict


@app.post("/projector/queueCommand")
async def queue_projector_command(component: ExhibitComponent,
                                  command: str = Body(
                                      description="The command to be sent to the specified projector.")):
    """Send a command to the specified projector."""

    c_exhibit.get_exhibit_component(component.id).queue_command(command)
    return {"success": True, "reason": ""}


# Schedule actions
@app.post("/schedule/convert")
async def convert_schedule(
        date: str = Body(description="The date of the schedule to create, in the form of YYYY-MM-DD."),
        convert_from: str = Body(description="The name of the schedule to clone to the new date.")):
    """Convert between date- and day-specific schedules."""

    with c_config.scheduleLock:
        shutil.copy(c_tools.get_path(["schedules", convert_from.lower() + ".json"], user_file=True),
                    c_tools.get_path(["schedules", date + ".json"], user_file=True))

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteAction")
async def delete_schedule_action(schedule_name: str = Body(description="The schedule to delete the action from."),
                                 schedule_id: str = Body(
                                     description="The unique identifier of the action to be deleted.")):
    """Delete the given action from the specified schedule."""

    c_sched.delete_json_schedule_event(schedule_name + ".json", schedule_id)
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteSchedule")
async def delete_schedule(name: str = Body(description="The name of the schedule to delete.", embed=True)):
    """Delete the given schedule."""

    with c_config.scheduleLock:
        json_schedule_path = c_tools.get_path(["schedules", name + ".json"], user_file=True)
        os.remove(json_schedule_path)

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.get("/schedule/refresh")
async def refresh_schedule():
    """Reload the schedule from disk and return it."""

    # This command reloads the schedule from disk. Normal schedule changes are passed during /system/getUpdate
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/update")
async def update_schedule(name: str = Body(),
                          time_to_set: str = Body(
                              description="The time of the action to set, expressed in any normal way."),
                          action_to_set: str = Body(description="The action to set."),
                          target_to_set: str = Body(description="The ID of the component that should be acted upon."),
                          value_to_set: list = Body(default="", description="A value corresponding to the action."),
                          schedule_id: str = Body(
                              description="A unique identifier corresponding to the schedule entry.")):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    # Make sure we were given a valid time to parse
    try:
        dateutil.parser.parse(time_to_set)
    except dateutil.parser._parser.ParserError:
        response_dict = {"success": False,
                         "reason": "Time not valid"}
        return response_dict

    c_sched.update_json_schedule(name + ".json", {
        schedule_id: {"time": time_to_set, "action": action_to_set,
                      "target": target_to_set, "value": value_to_set}})

    error = False
    error_message = ""

    response_dict = {}
    if not error:
        # Reload the schedule from disk
        c_sched.retrieve_json_schedule()

        # Send the updated schedule back
        with c_config.scheduleLock:
            response_dict["updateTime"] = c_config.scheduleUpdateTime
            response_dict["schedule"] = c_config.json_schedule_list
            response_dict["nextEvent"] = c_config.json_next_event
            response_dict["success"] = True
    else:
        response_dict["success"] = False
        response_dict["reason"] = error_message
    return response_dict


# System actions
@app.post("/system/beginSynchronization")
async def begin_synchronization(data: dict[str, Any]):
    """Initiate a synchronization attempt between the specified components."""

    if "synchronizeWith" not in data:
        response = {"success": False,
                    "reason": "Request missing 'synchronizeWith' field."}
        return response

    c_exhibit.update_synchronization_list(data["id"], data["synchronizeWith"])

    return {"success": True}


@app.get("/system/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@app.get("/system/{target}/getConfiguration")
async def get_json_configuration(target: str):
    """Return the requested JSON configuration."""

    config_path = c_tools.get_path(["configuration", f"{target}.json"], user_file=True)
    return {"configuration": c_tools.load_json(config_path)}


@app.get("/system/getHelpText")
async def get_help_text():
    """Send the contents of README.md"""
    try:
        readme_path = c_tools.get_path(["README.md"])
        with open(readme_path, 'r', encoding='UTF-8') as f:
            text = f.read()
        response = {"success": True, "text": text}
    except FileNotFoundError:
        with c_config.logLock:
            logging.error("Unable to read README.md")
        response = {"success": False, "reason": "Unable to read README.md"}
    return response


@app.get("/system/getUpdate")
async def get_update():
    """Retrieve an update of everything being managed by Control Server"""

    return send_webpage_update()


@app.post("/system/ping")
async def handle_ping(data: dict[str, Any], request: Request):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if "id" not in data or "group" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' or 'group' field."}
        return response

    this_id = data['id']
    c_exhibit.update_exhibit_component_status(data, request.client.host)

    dict_to_send = c_exhibit.get_exhibit_component(this_id).config.copy()
    if len(c_exhibit.get_exhibit_component(this_id).config["commands"]) > 0:
        # Clear the command list now that we are sending
        c_exhibit.get_exhibit_component(this_id).config["commands"] = []
    return dict_to_send


@app.post("/system/{target}/updateConfiguration")
async def update_configuration(target: str, configuration=Body(
        description="A JSON object specifying the configuration.",
        embed=True)):
    """Write the given object to the matching JSON file as the configuration."""

    if target == "system":
        c_tools.update_system_configuration(configuration)
    else:
        config_path = c_tools.get_path(["configuration", f"{target}.json"], user_file=True)
        c_tools.write_json(configuration, config_path)

        if target == "projectors":
            # Use a separate thread for this one, as connecting to projectors is blocking
            th = threading.Thread(target=c_proj.read_projector_configuration,
                                  name='c_proj.read_projector_configuration()')
            th.start()
        elif target == "descriptions":
            c_exhibit.read_descriptions_configuration()
        elif target == "wake_on_LAN":
            c_exhibit.read_wake_on_LAN_configuration()
        elif target == "static":
            c_exhibit.read_static_components_configuration()

    return {"success": True}


@app.post("/")
async def do_post(data: dict[str, Any], request: Request):
    """POST requests to / are Constellation 1 legacy calls."""

    client_ip = request.client.host
    if client_ip == "::1":
        client_ip = "localhost"
    print(f"Received unexpected legacy connection from ip {client_ip}:", data)
    logging.error(f"Received unexpected legacy connection from ip {client_ip}:", data)
    return {"success": False, "reason": "Must conform to Constellation 2.0 API."}


app.mount("/js",
          StaticFiles(directory=c_tools.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=c_tools.get_path(["css"])),
          name="css")
try:
    app.mount("/static", StaticFiles(directory=c_tools.get_path(["static"], user_file=True)),
              name="static")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(c_tools.get_path(["static"], user_file=True))
    app.mount("/static", StaticFiles(directory=c_tools.get_path(["static"], user_file=True)),
              name="static")
app.mount("/",
          StaticFiles(directory=c_tools.get_path([""]), html=True),
          name="root")

if __name__ == "__main__":
    c_tools.check_file_structure()
    c_exhibit.check_available_exhibits()
    load_default_configuration()
    c_proj.poll_projectors()
    c_exhibit.poll_wake_on_LAN_devices()
    check_for_software_update()

    log_level = "warning"
    if c_config.debug:
        log_level = "debug"

    # Must use only one worker, since we are relying on the config module being in global
    uvicorn.run(app,
                host="",  # Accept connections on all interfaces
                log_level=log_level,
                port=int(c_config.port),
                reload=False, workers=1)
