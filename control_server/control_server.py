# Constellation Control Server
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
import configparser
import datetime
from fastapi import FastAPI, Depends, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
from typing import Any
import urllib.request
import uvicorn

# Non-standard modules
import aiofiles
import dateutil.parser

# Constellation modules
import config as c_config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_maintenance as c_maint
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tools as c_tools
import constellation_tracker as c_track


def send_webpage_update():
    """Function to collect the current exhibit status, format it, and send it back to the web client to update the page."""

    component_dict_list = []
    for item in c_config.componentList:
        temp = {"id": item.id,
                "type": item.type}
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
        temp["class"] = "exhibitComponent"
        temp["status"] = item.current_status()
        temp["lastContactDateTime"] = item.last_contact_datetime
        temp["ip_address"] = item.ip
        temp["helperPort"] = item.helperPort
        temp["helperAddress"] = item.helperAddress
        temp["constellation_app_id"] = item.constellation_app_id
        temp["platform_details"] = item.platform_details
        component_dict_list.append(temp)

    for item in c_config.projectorList:
        temp = {"id": item.id,
                "type": 'PROJECTOR',
                "ip_address": item.ip}
        if "allowed_actions" in item.config:
            temp["allowed_actions"] = item.config["allowed_actions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        temp["class"] = "exhibitComponent"
        temp["status"] = item.state["status"]
        component_dict_list.append(temp)

    for item in c_config.wakeOnLANList:
        temp = {"id": item.id,
                "type": 'WAKE_ON_LAN',
                "ip_address": item.ip}
        if "allowed_actions" in item.config:
            temp["allowed_actions"] = item.config["allowed_actions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        temp["class"] = "exhibitComponent"
        temp["status"] = item.state["status"]
        component_dict_list.append(temp)

    # Also include an object with the status of the overall gallery
    temp = {"class": "gallery",
            "currentExhibit": c_config.currentExhibit,
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


def clear_terminal():
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def command_line_setup():
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    clear_terminal()
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
    settings_dict["server_ip_address"] = ip_address

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
    settings_dict["server_port"] = port

    settings_dict["current_exhibit"] = "default.exhibit"

    return {"CURRENT": settings_dict}


def load_default_configuration():
    """Read the current exhibit configuration from file and initialize it"""

    global server_port
    global ip_address

    # First, retrieve the config filename that defines the desired gallery
    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)

    with c_config.galleryConfigurationLock:
        config_reader.read(gal_path)
    try:
        current = config_reader["CURRENT"]
    except KeyError:
        # We don't have a config file, so let's get info from the user to create one
        settings_dict = command_line_setup()
        config_reader.read_dict(settings_dict)
        with open(c_tools.get_path(["galleryConfiguration.ini"], user_file=True), "w", encoding="UTF-8") as f:
            config_reader.write(f)
        current = config_reader["CURRENT"]
    server_port = current.getint("server_port", 8080)
    ip_address = current.get("server_ip_address", socket.gethostbyname(socket.gethostname()))
    c_config.gallery_name = current.get("gallery_name", "Constellation")
    staff_list = current.get("assignable_staff", "")
    c_config.debug = current.getboolean("debug", False)
    if c_config.debug:
        c_tools.print_debug_details(loop=True)

    if len(staff_list) > 0:
        c_config.assignable_staff = [x.strip() for x in staff_list.split(",")]
    else:
        c_config.assignable_staff = []

    c_sched.retrieve_json_schedule()

    c_config.projectorList = []

    # Load the component descriptions. Do this first, so they are available when
    # creating the various components
    try:
        print("Reading component descriptions...", end="", flush=True)
        c_config.componentDescriptions = dict(config_reader["COMPONENT_DESCRIPTIONS"])
        print(" done")
    except KeyError:
        print("None found")
        c_config.componentDescriptions = {}

    # Parse list of PJLink projectors
    try:
        pjlink_projectors = config_reader["PJLINK_PROJECTORS"]
        print("Connecting to PJLink projectors...", end="\r", flush=True)
    except KeyError:
        print("No PJLink projectors specified")
        pjlink_projectors = []

    n_proj = len(pjlink_projectors)
    cur_proj = 0
    for key in pjlink_projectors:
        cur_proj += 1
        print(f"Connecting to PJLink projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if c_proj.get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, password"
            split = pjlink_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a password
                ip = split[0].strip()
                password = split[1].strip()
                if password == "":
                    password = None
                new_proj = c_proj.Projector(key, ip, "pjlink", password=password)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = c_proj.Projector(key, pjlink_projectors[key], "pjlink")
            else:
                print("Invalid PJLink projector entry:", pjlink_projectors[key])
                break
            c_config.projectorList.append(new_proj)
    print("Connecting to PJLink projectors... done                      ")

    # Parse list of serial projectors
    try:
        serial_projectors = config_reader["SERIAL_PROJECTORS"]
        print("Connecting to serial projectors...", end="\r", flush=True)
    except KeyError:
        print("No serial projectors specified")
        serial_projectors = []

    n_proj = len(serial_projectors)
    cur_proj = 0
    for key in serial_projectors:
        cur_proj += 1
        print(f"Connecting to serial projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if c_proj.get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, password"
            split = serial_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a make
                ip = split[0].strip()
                make = split[1].strip()
                if make == "":
                    make = None
                new_proj = c_proj.Projector(key, ip, "serial", make=make)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = c_proj.Projector(key, serial_projectors[key], "serial")
            else:
                print("Invalid serial projector entry:", serial_projectors[key])
                break
            c_config.projectorList.append(new_proj)
    print("Connecting to serial projectors... done                      ")

    # Parse list of Wake on LAN devices
    try:
        wol = config_reader["WAKE_ON_LAN"]
        print("Collecting Wake on LAN devices...", end="", flush=True)

        for key in wol:
            if c_exhibit.get_exhibit_component(key) is None:
                # If 'get_exhibit_component' is not None, this key corresponds
                # to a WoL device with a matching exhibit component ID and
                # we have already loaded that component from the pickle file
                value_split = wol[key].split(",")
                if len(value_split) == 2:
                    # We have been given a MAC address and IP address
                    device = c_exhibit.WakeOnLANDevice(key,
                                                       value_split[0].strip(),
                                                       ip_address=value_split[1].strip())
                elif len(value_split) == 1:
                    # We have been given only a MAC address
                    device = c_exhibit.WakeOnLANDevice(key, value_split[0].strip())
                else:
                    print(f"Wake on LAN device specified with unknown format: {wol[key]}")
                    continue
                c_config.wakeOnLANList.append(device)
        print(" done")
    except KeyError:
        print("No wake on LAN devices specified")
        c_config.wakeOnLANList = []

    # Build any existing issues
    try:
        issue_file = c_tools.get_path(["issues", "issues.json"], user_file=True)
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)
        print("Reading stored issues...", end="", flush=True)

        for issue in issues:
            new_issue = c_issues.Issue(issue)
            c_config.issueList.append(new_issue)
        print(" done")
    except FileNotFoundError:
        print("No stored issues to read")

    # Parse list of static components
    try:
        static_components = config_reader["STATIC_COMPONENTS"]
        print("Adding static components... ", end="\r", flush=True)
        for this_type in static_components:
            split = static_components[this_type].split(",")
            for this_id in split:
                this_id = this_id.strip()
                if c_exhibit.get_exhibit_component(this_id) is None:
                    static_component = c_exhibit.add_exhibit_component(this_id, this_type, category="static")
                    static_component.constellation_app_id = "static_component"
        print("done")
    except KeyError:
        print("none specified")

    # Parse the reboot_time if necessary
    if "reboot_time" in current:
        reboot_time = dateutil.parser.parse(current["reboot_time"])
        if reboot_time < datetime.datetime.now():
            reboot_time += datetime.timedelta(days=1)
        c_config.serverRebootTime = reboot_time
        print("Server will reboot at:", c_config.serverRebootTime.isoformat())

    # Then, load the configuration for that exhibit
    c_exhibit.read_exhibit_configuration(current["current_exhibit"])

    # Update the components that the configuration has changed
    for component in c_config.componentList:
        component.update_configuration()


def quit_handler(*args):
    """Handle cleanly shutting down the server"""

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

    with c_config.logLock:
        logging.info("Server shutdown")

    with c_config.galleryConfigurationLock:
        with c_config.scheduleLock:
            with c_config.trackingDataWriteLock:
                sys.exit(exit_code)


def error_handler(*exc_info):
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with c_config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see control_server.log for more details ({datetime.datetime.now()})")


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/control_server/version.txt"):
            if float(line.decode('utf-8')) > SOFTWARE_VERSION:
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

server_port: int = 8080  # Default; should be set in galleryConfiguration.ini
ip_address: str = socket.gethostbyname(socket.gethostname())  # Default; should be set in galleryConfiguration.ini
ADDR: str = ""  # Accept connections from all interfaces
SOFTWARE_VERSION = 2.0

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


@lru_cache()
def get_config():
    return c_config


# Exhibit component actions
@app.post("/exhibit/create")
async def create_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Create a new exhibit INI file.

    If 'data' includes the 'clone' field, the specified 'clone'.ini file will be copied.
    """

    if "name" not in data or data["name"] == "":
        response = {"success": False,
                    "reason": "Request missing 'name' field or name is blank."}
        return response
    clone = None
    if "cloneFrom" in data and data["cloneFrom"] != "":
        clone = data["cloneFrom"]
    c_exhibit.create_new_exhibit(data["name"], clone)
    return {"success": True, "reason": ""}


@app.post("/exhibit/delete")
async def delete_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the specified exhibit."""

    if "name" not in data or data["name"] == "":
        response = {"success": False,
                    "reason": "Request missing 'name' field or name is empty."}
        return response
    c_exhibit.delete_exhibit(data["name"])
    response = {"success": True, "reason": ""}
    return response
    

@app.post("/exhibit/queueCommand")
async def queue_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Queue the specified command for the exhibit component to retrieve."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueWOLCommand")
async def queue_WOL_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Queue the Wake on Lan command for the exhibit component to retrieve."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_wake_on_LAN_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


@app.post("/exhibit/set")
async def set_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Set the specified exhibit as the current one."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    print("Changing exhibit to:", data["name"])
    c_exhibit.read_exhibit_configuration(data["name"], update_default=True)

    # Update the components that the configuration has changed
    for component in c_config.componentList:
        component.update_configuration()
    return {"success": True, "reason": ""}


@app.post("/exhibit/setComponentContent")
async def set_component_content(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Change the active content for the given exhibit component."""

    if "id" not in data or "content" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' or 'content' field."}
        return response
    content_to_set = data["content"]
    print(f"Changing content for {data['id']}:", content_to_set)
    if not isinstance(content_to_set, list):
        content_to_set = [data["content"]]
    c_exhibit.set_component_content(data['id'], content_to_set)
    return {"success": True, "reason": ""}


# Flexible Tracker actions
@app.post("/tracker/{tracker_type}/createTemplate")
async def create_tracker_template(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def delete_tracker_data(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def delete_tracker_template(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def get_available_tracker_data(tracker_type: str, config: c_config = Depends(get_config)):
    """Send a list of all the available data files for the given tracker type."""

    data_path = c_tools.get_path([tracker_type, "data"], user_file=True)
    data_list = []
    for file in os.listdir(data_path):
        if file.lower().endswith(".txt"):
            data_list.append(file)
    response = {"success": True,
                "data": data_list}
    return response


@app.get("/tracker/{tracker_type}/getAvailableDefinitions")
async def get_available_tracker_definitions(tracker_type: str, config: c_config = Depends(get_config)):
    """Send a list of all the available definitions for the given tracker type (usually flexible-tracker)."""

    definition_list = []
    template_path = c_tools.get_path([tracker_type, "templates"], user_file=True)
    for file in os.listdir(template_path):
        if file.lower().endswith(".ini"):
            definition_list.append(file)

    return definition_list


@app.post("/tracker/{tracker_type}/getDataAsCSV")
async def get_tracker_data_csv(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
    """Return the requested data file as a CSV string."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    name = data["name"]
    if not name.lower().endswith(".txt"):
        name += ".txt"
    data_path = c_tools.get_path([tracker_type, "data", name], user_file=True)
    result = c_track.create_CSV(data_path)
    response = {"success": True,
                "csv": result}
    return response



@app.post("/tracker/{tracker_type}/getLayoutDefinition")
async def get_tracker_layout_definition(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def get_tracker_raw_text(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
    """Load the contents of the appropriate file and return them."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    result, success, reason = c_track.get_raw_text(data["name"] + ".txt", tracker_type)
    response = {"success": success, "reason": reason, "text": result}
    return response


@app.post("/tracker/submitAnalytics")
async def submit_analytics(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def submit_tracker_data(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def submit_tracker_raw_text(data: dict[str, Any], tracker_type: str, config: c_config = Depends(get_config)):
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
async def create_issue(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Create a new issue."""

    if "details" in data:
        with c_config.issueLock:
            new_issue = c_issues.Issue(data["details"])
            c_config.issueList.append(new_issue)
            c_issues.save_issueList()
        response_dict = {"success": True}
    else:
        response_dict = {"success": False,
                         "reason": "Must include field 'details'"}
    return response_dict


@app.post("/issue/delete")
async def delete_issue(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete an issue."""

    if "id" in data:
        c_issues.remove_issue(data["id"])
        c_issues.save_issueList()
        response_dict = {"success": True, "reason": ""}
    else:
        response_dict = {"success": False, "reason": "Must include field 'id'"}
    return response_dict


@app.post("/issue/deleteMedia")
async def delete_issue_media(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the media file linked to an issue and remove the reference."""

    if "filename" not in data:
        response = {"success": False,
                    "reason": "Request missing 'filename' field."}
        return response
    this_id = None
    if "id" in data:
        this_id = data["id"]
    c_issues.delete_issue_media_file(data["filename"], owner=this_id)
    response = {"success": True}
    return response


@app.post("/issue/edit")
async def edit_issue(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Make changes to an existing issue."""

    if "details" in data and "id" in data["details"]:
        c_issues.edit_issue(data["details"])
        c_issues.save_issueList()
        response_dict = {"success": True}
    else:
        response_dict = {
            "success": False,
            "reason": "Must include field 'details' with proper"
                      "ty 'id'"
        }
    return response_dict


@app.get("/issue/list")
async def get_issue_list(config: c_config = Depends(get_config)):
    """Return a list of open issues."""

    response = {
        "success": True,
        "issueList": [x.details for x in c_config.issueList]
    }
    return response


@app.post("/issue/uploadMedia")
async def upload_issue_media(files: list[UploadFile] = File(), config: c_config = Depends(get_config)):
    """Upload a media file and attach it to a specific issue."""

    filename = None
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = str(round(time.time()*1e6)) + ext
        file_path = c_tools.get_path(["issues", "media", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with c_config.issueMediaLock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
    return {"success": True, "filename": filename}


# Maintenance actions
@app.post("/maintenance/deleteRecord")
async def delete_maintenance_record(data: dict[str, Any], config: c_config = Depends(get_config)):
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
async def get_all_maintenance_statuses(config: c_config = Depends(get_config)):
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
async def get_maintenance_status(data: dict[str, Any], config: c_config = Depends(get_config)):
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
async def update_maintenance_status(data: dict[str, Any], config: c_config = Depends(get_config)):
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
@app.post("/projector/getUpdate")
async def get_projector_update(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Poll the projector for an update and return it"""

    if "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id'.",
                         "status": None}
        return response_dict
    proj = c_proj.get_projector(data["id"])
    if proj is not None:
        response_dict = {"success": True,
                         "state": proj.state}
    else:
        response_dict = {"success": False,
                         "reason": f"Projector {data['id']} does not exist",
                         "status": "DELETE"}
    return response_dict


@app.post("/projector/queueCommand")
async def queue_projector_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Send a command to the specified projector."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


# Schedule actions
@app.post("/schedule/convert")
async def convert_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Convert between date- and day-specific schedules."""

    if "date" not in data or "from" not in data:
        response = {"success": False,
                    "reason": "Request missing 'date' or 'from' field."}
        return response

    with c_config.scheduleLock:
        shutil.copy(c_tools.get_path(["schedules", data["from"].lower() + ".json"], user_file=True),
                    c_tools.get_path(["schedules", data["date"] + ".json"], user_file=True))

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteAction")
async def delete_schedule_action(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the given action from the specified schedule."""

    if "from" not in data or "scheduleID" not in data:
        response = {"success": False,
                    "reason": "Request missing 'from' or 'scheduleID' field."}
        return response

    c_sched.delete_json_schedule_event(data["from"] + ".json", data["scheduleID"])
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteSchedule")
async def delete_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the given schedule."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    with c_config.scheduleLock:
        json_schedule_path = c_tools.get_path(["schedules", data["name"] + ".json"], user_file=True)
        os.remove(json_schedule_path)

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.get("/schedule/refresh")
async def refresh_schedule(config: c_config = Depends(get_config)):
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
async def update_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    if "name" not in data \
            or "timeToSet" not in data \
            or "actionToSet" not in data \
            or "targetToSet" not in data \
            or "valueToSet" not in data \
            or "isAddition" not in data \
            or "scheduleID" not in data:
        response_dict = {"success": False,
                         "reason": "Missing one or more required keys"}
        return response_dict

    # Make sure we were given a valid time to parse
    try:
        dateutil.parser.parse(data["timeToSet"])
    except dateutil.parser._parser.ParserError:
        response_dict = {"success": False,
                         "reason": "Time not valid"}
        return response_dict

    c_sched.update_json_schedule(data["name"] + ".json", {
        data["scheduleID"]: {"time": data["timeToSet"], "action": data["actionToSet"],
                             "target": data["targetToSet"], "value": data["valueToSet"]}})

    error = False
    error_message = ""

    response_dict = {}
    if not error:
        # Reload the schedule from disk
        c_sched.retrieve_json_schedule()

        # Send the updated schedule back
        with c_config.scheduleLock:
            response_dict["class"] = "schedule"
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
async def begin_synchronization(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Initiate a synchronization attempt between the specified components."""

    if "synchronizeWith" not in data:
        response = {"success": False,
                    "reason": "Request missing 'synchronizeWith' field."}
        return response

    c_exhibit.update_synchronization_list(data["id"], data["synchronizeWith"])

    return {"success": True}


@app.get("/system/checkConnection")
async def check_connection(config: c_config = Depends(get_config)):
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@app.get("/system/getConfiguration")
async def get_configuration(config: c_config = Depends(get_config)):
    """Return a dictionary with galleryConfiguration.ini."""

    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    with c_config.galleryConfigurationLock:
        config_reader.read(gal_path)

    config_dict = {}
    for section in config_reader.sections():
        config_dict[section] = {}
        for key, val in config_reader.items(section):
            config_dict[section][key] = val
    return {"success": True, "configuration": config_dict}


@app.get("/system/getConfigurationRawText")
async def get_configuration_raw_text(config: c_config = Depends(get_config)):
    """Return the raw text for galleryConfiguration.ini."""

    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    with open(gal_path, 'r', encoding='UTF-8') as f:
        text = f.read()
    return {"success": True, "configuration": text}


@app.get("/system/getHelpText")
async def get_help_text(config: c_config = Depends(get_config)):
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
async def get_update(config: c_config = Depends(get_config)):
    """Retrieve an update of everything being managed by Control Server"""

    return send_webpage_update()


@app.get("/system/reloadConfiguration")
async def reload_configuration(config: c_config = Depends(get_config)):
    """Reload galleryConfiguration.ini"""

    load_default_configuration()
    return {"success": True}


@app.post("/system/ping")
async def handle_ping(data: dict[str, Any], request: Request, config: c_config = Depends(get_config)):
    """Respond to an incoming heartbeat signal with ahy updates."""

    if "id" not in data or "type" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' or 'type' field."}
        return response

    this_id = data['id']
    c_exhibit.update_exhibit_component_status(data, request.client.host)

    dict_to_send = c_exhibit.get_exhibit_component(this_id).config.copy()
    if len(c_exhibit.get_exhibit_component(this_id).config["commands"]) > 0:
        # Clear the command list now that we are sending
        c_exhibit.get_exhibit_component(this_id).config["commands"] = []
    return dict_to_send


@app.post("/system/updateConfigurationRawText")
async def update_configuration_raw_text(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Use the given plain text to rewrite galleryConfiguration.ini."""

    if "configuration" not in data:
        return {"success": False, "reason": "Missing required field 'configuration'"}

    response_dict = {"success": True}
    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    try:
        # Try to parse the raw text to look for errors
        config_reader.read_string((data["configuration"]))
        config_reader.get("CURRENT", "server_ip_address")
        config_reader.get("CURRENT", "server_port")
        config_reader.get("CURRENT", "current_exhibit")
        config_reader.get("CURRENT", "gallery_name")

        gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
        with open(gal_path, 'w', encoding='UTF-8') as f:
            f.write(data["configuration"])
    except configparser.MissingSectionHeaderError:
        response_dict["success"] = False
        response_dict["reason"] = "You must have at least a [CURRENT] section"
    except configparser.ParsingError as e:
        error = e.errors[0]
        err_line = error[0]
        err_msg = error[1].replace('\\n', '')
        response_dict["success"] = False
        response_dict["reason"] = f"Error in line {err_line}: {err_msg}"
    except configparser.DuplicateOptionError as e:
        response_dict["success"] = False
        response_dict[
            "reason"] = f"Section [{e.section}] has a repeated option: {e.option} (line {e.lineno})"
    except configparser.NoSectionError:
        response_dict["success"] = False
        response_dict["reason"] = "You must have a [CURRENT] section"
    except configparser.NoOptionError as e:
        response_dict["success"] = False
        response_dict["reason"] = f"You must have the {e.option} setting in the [{e.section}] section"
    return response_dict


@app.post("/")
async def do_post(data: dict[str, Any], request: Request, config: c_config = Depends(get_config)):
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

    # Must use only one worker, since we are relying on the config module being in global)
    uvicorn.run(app,
                host=ADDR,
                port=int(server_port),
                reload=False, workers=1)
