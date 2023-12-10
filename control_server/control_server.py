# Constellation Control Server
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
import asyncio
from contextlib import asynccontextmanager
import datetime
import threading
import uuid
from functools import lru_cache
import json
import logging
import os
import shutil
import signal
import socket
import sys
import time
import traceback
from typing import Annotated, Any, Union
import urllib.request
import uvicorn

# Non-standard modules
import aiofiles
import dateutil.parser
from fastapi import Body, FastAPI, File, Response, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

# Constellation modules
import config as c_config
import constellation_exhibit as c_exhibit
import constellation_group as c_group
import constellation_issues as c_issues
import constellation_legacy as c_legacy
import constellation_maintenance as c_maint
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tools as c_tools
import constellation_tracker as c_track
import constellation_users as c_users


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

    update_dict = {}

    component_dict_list = []
    for item in c_config.componentList:
        temp = {"class": "exhibitComponent",
                "constellation_app_id": item.config["app_name"],
                "helperAddress": item.helperAddress,
                "id": item.id,
                "ip_address": item.ip_address,
                "group": item.group,
                "lastContactDateTime": item.last_contact_datetime,
                "latency": item.latency,
                "platform_details": item.platform_details,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.current_status(),
                "uuid": item.uuid}
        if "content" in item.config:
            temp["content"] = item.config["content"]
        if "definition" in item.config:
            temp["definition"] = item.config["definition"]
        if "error" in item.config:
            temp["error"] = item.config["error"]
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        if "autoplay_audio" in item.config:
            temp["autoplay_audio"] = item.config["autoplay_audio"]
        component_dict_list.append(temp)

    for item in c_config.projectorList:
        temp = {"class": "projector",
                "group": item.group,
                "id": item.id,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "password": item.password,
                "protocol": item.connection_type,
                "state": item.state,
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    for item in c_config.wakeOnLANList:
        temp = {"class": "wolComponent",
                "id": item.id,
                "group": item.group,
                "ip_address": item.ip_address,
                "latency": item.latency,
                "mac_address": item.mac_address,
                "maintenance_status": item.config.get("maintenance_status", "Off floor, not working"),
                "status": item.state["status"],
                "uuid": item.uuid}
        if "permissions" in item.config:
            temp["permissions"] = item.config["permissions"]
        if "description" in item.config:
            temp["description"] = item.config["description"]
        component_dict_list.append(temp)

    update_dict["components"] = component_dict_list
    update_dict["gallery"] = {"current_exhibit": c_config.current_exhibit,
                              "availableExhibits": c_config.exhibit_list,
                              "galleryName": c_config.gallery_name,
                              "softwareVersion": str(c_config.software_version),
                              "softwareVersionAvailable": c_config.software_update_available_version,
                              "updateAvailable": str(c_config.software_update_available).lower()}

    update_dict["issues"] = {"issueList": [x.details for x in c_config.issueList],
                             "lastUpdateDate": c_config.issueList_last_update_date}

    update_dict["groups"] = {"group_list": c_config.group_list,
                             "last_update_date": c_config.group_list_last_update_date}

    with c_config.scheduleLock:
        update_dict["schedule"] = {"updateTime": c_config.scheduleUpdateTime,
                                   "schedule": c_config.json_schedule_list,
                                   "nextEvent": c_config.json_next_event}

    return update_dict


def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    c_tools.clear_terminal()
    print("##########################################################")
    print("Welcome to Constellation Control Server!")
    print("")
    print("This appears to be your first time running Control Server.")
    print("In order to set up your configuration, let's answer a few")
    print("questions. If you don't know the answer, or wish to")
    print("accept the default, just press the enter key.")
    print("")


def command_line_setup() -> None:
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    command_line_setup_print_gui()
    c_config.gallery_name = input("Enter a name for the gallery (default: Constellation): ").strip()
    if c_config.gallery_name == "":
        c_config.gallery_name = "Constellation"
    settings_dict["gallery_name"] = c_config.gallery_name

    command_line_setup_print_gui()
    default_ip = socket.gethostbyname(socket.gethostname())
    ip_address = input(f"Enter this computer's static IP address (default: {default_ip}): ").strip()
    if ip_address == "":
        ip_address = default_ip
    settings_dict["ip_address"] = ip_address

    command_line_setup_print_gui()
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
    if not os.path.exists(c_tools.get_path(["exhibits", "Default.json"], user_file=True)):
        c_exhibit.create_new_exhibit("default", None)

    # Write new system config to file
    config_path = c_tools.get_path(["configuration", "system.json"], user_file=True)
    c_tools.write_json(settings_dict, config_path)

    command_line_setup_print_gui()
    print("Setup is complete! Control Server will now start.")
    print("")


def load_default_configuration() -> None:
    """Initialize the server in a default state."""

    # Check if there is a configuration file
    config_path = c_tools.get_path(["configuration", "system.json"], user_file=True)
    if not os.path.exists(config_path):
        # We don't have a config file, so let's get info from the user to create one
        command_line_setup()
    c_users.check_for_root_admin()
    c_tools.load_system_configuration()

    # Handle legacy conversions
    c_legacy.convert_legacy_projector_configuration()
    c_legacy.convert_legacy_static_configuration()
    c_legacy.convert_legacy_WOL_configuration()

    c_tools.start_debug_loop()
    c_sched.retrieve_json_schedule()
    c_exhibit.read_descriptions_configuration()
    # c_proj.read_projector_configuration()
    # c_exhibit.read_wake_on_LAN_configuration()
    # c_exhibit.read_static_components_configuration()
    c_exhibit.read_exhibit_configuration(c_config.current_exhibit)

    # Update the components that their configuration may have changed
    for component in c_config.componentList:
        component.update_configuration()

    # Build any existing issues
    c_issues.read_issue_list()

    # Save the current software version in .last_ver
    last_ver_path = c_tools.get_path(["configuration", ".last_ver"], user_file=True)
    with open(last_ver_path, 'w', encoding='UTF-8') as f:
        f.write(str(c_config.software_version))


def quit_handler(*args) -> None:
    """Handle cleanly shutting down the server."""

    for key in c_config.polling_thread_dict:
        c_config.polling_thread_dict[key].cancel()

    for component in c_config.componentList:
        component.clean_up()
        component.save()
    for component in c_config.projectorList:
        component.clean_up()
        component.save()
    for component in c_config.wakeOnLANList:
        component.clean_up()
        component.save()

    with c_config.logLock:
        logging.info("Server shutdown")

    # with c_config.galleryConfigurationLock:
    #     with c_config.scheduleLock:
    #         with c_config.trackingDataWriteLock:
    #             sys.exit(exit_code)


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
                c_config.software_update_available_version = line.decode('utf-8').strip()
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
# signal.signal(signal.SIGINT, quit_handler)
# signal.signal(signal.SIGTERM, quit_handler)
sys.excepthook = error_handler

with c_config.logLock:
    logging.info("Server started")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    yield
    # Clean up actions
    quit_handler()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.openapi = constellation_schema


@lru_cache()
def get_config():
    return c_config


# User account actions

@app.post("/user/login")
def log_in(response: Response,
           request: Request,
           credentials: tuple[str, str] = Body(description="A tuple containing the username and password.",
                                               default=("", ""), embed=True)
           ):
    """Authenticate the user and return the permissions and an authentication token."""

    token = request.cookies.get("authToken", "")

    success, username = c_users.authenticate_user(token=token, credentials=credentials)
    if success is False:
        return {"success": False, "reason": "authentication_failed"}

    user = c_users.get_user(username=username)
    if token == "":
        token = c_users.encrypt_token(username)
        print(token)
        response.set_cookie(key="authToken", value=token, max_age=int(3e7))  # Expire cookie in approx 1 yr
    return {"success": True, "user": user.get_dict()}


@app.post("/user/{username}/create")
def create_user(request: Request,
                username: str,
                password: str = Body(description="The password for the account to create."),
                display_name: str = Body(description="The name of the account holder."),
                permissions: dict | None = Body(description="A dictionary of permissions for the new account.",
                                                default=None)):
    """Create a new user account."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("users", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success, user_dict = c_users.create_user(username, display_name, password, permissions=permissions)

    response = {"success": success, "user": user_dict}
    if success is False:
        response["reason"] = "username_taken"
    return response


@app.post("/users/list")
def list_users(permissions: dict[str, str] = Body(description="A dictionary of permissions to match.",
                                                  default={},
                                                  embed=True)):
    """Return a list of users matching the provided criteria"""

    matched_users = []

    for user in c_config.user_list:
        error = False
        for key in permissions:

            if user.check_permission(key, permissions[key]) is False:
                error = True
        if not error:
            matched_users.append(user.get_dict())

    return {"success": True, "users": matched_users}


@app.get("/user/{username}/getDisplayName")
def get_user_display_name(username: str):
    """Get the display name for a user account."""

    user = c_users.get_user(username=username)
    if user is None:
        return {"success": False, "reason": "username_does_not_exist"}
    return {"success": True, "display_name": user.display_name}


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


@app.post("/component/{component_id}/setApp")
async def set_component_app(component_id: str,
                            app_name: str = Body(description="The app to be set.", embed=True)):
    """Set the app for the component."""

    c_exhibit.update_exhibit_configuration(component_id, {"app_name": app_name})

    return {"success": True}


@app.post("/component/{component_id}/setDefinition")
async def set_component_definition(component_id: str,
                                   uuid: str = Body(description="The UUID of the definition file to be set.",
                                                    embed=True)):
    """Set the definition for the component."""

    c_exhibit.update_exhibit_configuration(component_id, {"definition": uuid})

    return {"success": True}


@app.get("/group/{uuid_str}/getDetails")
async def get_group_details(request: Request, uuid_str: str):
    """Return the details for the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = c_group.get_group(uuid_str)

    if group is None:
        return {"success": False, "reason": "Group does not exist."}
    return {"success": True, "details": group}


@app.post("/group/create")
async def create_group(request: Request,
                       name: str = Body(description="The name of the group to create"),
                       description: str = Body("The description for the group to create.")):
    """Create a group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    group = c_group.create_group(name, description)
    return {"success": True, "uuid": group["uuid"]}


@app.post("/group/{uuid_str}/edit")
async def edit_group(request: Request,
                     uuid_str: str,
                     name: str = Body(description="The name of the group to create", default=None),
                     description: str = Body(description="The description for the group to create.", default=None)):
    """Edit a group"""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    success = c_group.edit_group(uuid_str, name=name, description=description)
    return {"success": success}


@app.get("/group/{uuid_str}/delete  ")
async def delete_group(request: Request, uuid_str: str):
    """Return the details for the given group."""

    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_group.delete_group(uuid_str)
    return {"success": True}


@app.post("/exhibit/create")
async def create_exhibit(request: Request,
                         exhibit: Exhibit,
                         clone_from: Union[str, None] = Body(default=None,
                                                             description="The name of the exhibit to clone.")):
    """Create a new exhibit JSON file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_exhibit.create_new_exhibit(exhibit.name, clone_from)
    return {"success": True, "reason": ""}


@app.post("/exhibit/delete")
async def delete_exhibit(request: Request, exhibit: Exhibit = Body(embed=True)):
    """Delete the specified exhibit."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("exhibits", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
async def remove_component(component: ExhibitComponent = Body(embed=True)):
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


@app.post("/exhibit/setComponentApp")
async def set_component_app(component: ExhibitComponent,
                            app_name: str = Body(description="The app to be set")):
    """Change the active app for the given exhibit component."""

    print(f"Changing app for {component.id}:", app_name)
    c_exhibit.update_exhibit_configuration(component.id, {"app_name": app_name})
    return {"success": True, "reason": ""}


@app.get("/exhibit/getAvailable")
async def get_available_exhibits():
    """Return a list of available exhibits."""

    return {"success": True, "available_exhibits": c_config.exhibit_list}


@app.post("/exhibit/getDetails")
async def get_exhibit_details(name: str = Body(description='The name of the exhibit to fetch.', embed=True)):
    """Return the JSON for a particular exhibit."""

    if not name.endswith('.json'):
        name += '.json'
    exhibit_path = c_tools.get_path(["exhibits", name], user_file=True)
    result = c_tools.load_json(exhibit_path)
    if result is None:
        return {"success": False, "reason": "Exhibit does not exist."}
    return {"success": True, "exhibit": result}


# Flexible Tracker actions
@app.post("/tracker/{tracker_type}/createTemplate")
async def create_tracker_template(request: Request, data: dict[str, Any], tracker_type: str):
    """Create a new tracker template, overwriting if necessary."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
async def delete_tracker_data(request: Request, data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker data file."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
async def delete_tracker_template(request: Request, data: dict[str, Any], tracker_type: str):
    """Delete the specified tracker template."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("analytics", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
        return {"success": False, "reason": f"File {data['name']}.txt does not exist!", "csv": ""}
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
async def create_issue(request: Request, details: dict[str, Any] = Body(embed=True)):
    """Create a new issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_issues.create_issue(details, username=authorizing_user)
    c_issues.save_issue_list()
    return {"success": True}


@app.get("/issue/{issue_id}/delete")
async def delete_issue(request: Request, issue_id: str):
    """Delete an issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_issues.remove_issue(issue_id)
    return {"success": True, "reason": ""}


@app.get("/issue/{issue_id}/archive")
async def archive_issue(request: Request, issue_id: str):
    """Move the given issue to the archive."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_issues.archive_issue(issue_id, authorizing_user)
    return {"success": True}


@app.get("/issue/{issue_id}/restore")
async def restore_issue(request: Request, issue_id: str):
    """Move the given issue from the archive to the issue list."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_issues.restore_issue(issue_id)
    return {"success": True}


@app.post("/issue/deleteMedia")
async def delete_issue_media(request: Request,
                             filenames: list[str] = Body(description="The filenames to be deleted."),
                             owner: Union[str, None] = Body(default=None,
                                                            description="The ID of the Issue this media file belonged to.")):
    """Delete the media files linked to an issue and remove the reference."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_issues.delete_issue_media_file(filenames, owner=owner)
    return {"success": True}


@app.post("/issue/edit")
async def edit_issue(request: Request,
                     details: dict[str, Any] = Body(description="The details to be changed.", embed=True)):
    """Make changes to an existing issue."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" in details:
        c_issues.edit_issue(details, authorizing_user)
        c_issues.save_issue_list()
        response_dict = {"success": True}
    else:
        response_dict = {
            "success": False,
            "reason": "'details' must include property 'id'"
        }
    return response_dict


@app.get("/issue/list/{match_id}")
async def get_issue_list(request: Request, match_id: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if match_id != "__all":
        matched_issues = []
        for issue in c_config.issueList:
            if match_id in issue.details["relatedComponentIDs"]:
                matched_issues.append(issue.details)
    else:
        matched_issues = [x.details for x in c_config.issueList]

    response = {
        "success": True,
        "issueList": matched_issues
    }
    return response


@app.get("/issue/archive/list/{match_id}")
async def get_archived_issues(request: Request, match_id: str):
    """Return a list of open issues."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    archive_file = c_tools.get_path(["issues", "archived.json"], user_file=True)

    with c_config.issueLock:
        try:
            with open(archive_file, 'r', encoding='UTF-8') as file_object:
                archive_list = json.load(file_object)
        except (FileNotFoundError, json.JSONDecodeError):
            archive_list = []

    if match_id != "__all":
        matched_issues = []
        for issue in archive_list:
            if match_id in issue["relatedComponentIDs"]:
                matched_issues.append(issue)
    else:
        matched_issues = archive_list

    response = {
        "success": True,
        "issues": matched_issues
    }
    return response


@app.get("/issue/{issue_id}/getMedia")
async def get_issue_media(request: Request, issue_id: str):
    """Return a list of media files connected to the given ID."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    issue = c_issues.get_issue(issue_id)

    if issue is None:
        return {"success": False, "reason": f"Issue does not exist: {issue_id}"}

    return {"success": True, "media": issue.details["media"]}


@app.post("/issue/uploadMedia")
async def upload_issue_media(request: Request, files: list[UploadFile] = File()):
    """Upload issue media files."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    filenames = []
    for file in files:
        ext = os.path.splitext(file.filename)[1]
        filename = str(uuid.uuid4()) + ext
        filenames.append(filename)
        file_path = c_tools.get_path(["issues", "media", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with c_config.issueMediaLock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
    return {"success": True, "filenames": filenames}


# Maintenance actions
@app.post("/maintenance/deleteRecord")
async def delete_maintenance_record(request: Request, data: dict[str, Any]):
    """Delete the specified maintenance record."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" not in data:
        return {"success": False, "reason": "Request missing 'id' field."}

    file_path = c_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    with c_config.maintenanceLock:
        response = c_tools.delete_file(file_path)
    c_config.last_update_time = time.time()
    return response


@app.get("/maintenance/getAllStatuses")
async def get_all_maintenance_statuses(request: Request):
    """Send a list of all the maintenance statuses for known components"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
async def get_maintenance_status(request: Request, data: dict[str, Any]):
    """Return the specified maintenance status"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
        return response
    file_path = c_tools.get_path(["maintenance-logs", data["id"] + ".txt"], user_file=True)
    with c_config.maintenanceLock:
        response_dict = c_maint.get_maintenance_report(file_path)
    return response_dict


@app.post("/maintenance/updateStatus")
async def update_maintenance_status(request: Request,
                                    component_id: str = Body(description='The ID of the component to update.'),
                                    notes: str = Body(description="Text notes about this component."),
                                    status: str = Body(description="The status of the component.")):
    """Update the given maintenance status."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("maintenance", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    file_path = c_tools.get_path(["maintenance-logs", component_id + ".txt"], user_file=True)
    record = {"id": component_id,
              "date": datetime.datetime.now().isoformat(),
              "status": status,
              "notes": notes}
    with c_config.maintenanceLock:
        try:
            with open(file_path, 'a', encoding='UTF-8') as f:
                f.write(json.dumps(record) + "\n")
            success = True
            reason = ""
            c_config.last_update_time = time.time()
        except FileNotFoundError:
            success = False
            reason = f"File path {file_path} does not exist"
        except PermissionError:
            success = False
            reason = f"You do not have write permission for the file {file_path}"

    if success is True:
        c_exhibit.get_exhibit_component(component_id).config["maintenance_status"] = status

    return {"success": success, "reason": reason}


@app.post("/projector/create")
async def create_projector(request: Request,
                           id: str = Body(description="The ID of the projector to add."),
                           group: str = Body(description="The group of the projector to add."),
                           ip_address: str = Body(description="The IP address for the projector."),
                           password: str = Body(description="The PJLink password", default="")):
    """Create a new projector."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    proj = c_exhibit.add_projector(id, group, ip_address, password=password)
    print("PROJECTOR CREATED")
    return {"success": True, "uuid": proj.uuid}


@app.post("/projector/{uuid_str}/edit")
async def edit_projector(request: Request,
                         uuid_str: str,
                         id: str | None = Body(description="The ID of the projector to add.", default=None),
                         group: str | None = Body(description="The group of the projector to add.", default=None),
                         ip_address: str | None = Body(description="The IP address for the projector.", default=None),
                         password: str | None = Body(description="The PJLink password", default=None)):
    """Edit the given projector."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("settings", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    proj = c_proj.get_projector(projector_uuid=uuid_str)
    if proj is None:
        return {"success": False, "reason": "Projector does not exist"}

    if id is not None:
        proj.id = id
    if ip_address is not None:
        proj.ip_address = ip_address
    if password is not None:
        proj.password = password
    proj.save()

    return {"success": True}


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
        request: Request,
        date: str = Body(description="The date of the schedule to create, in the form of YYYY-MM-DD."),
        convert_from: str = Body(description="The name of the schedule to clone to the new date.")):
    """Convert between date- and day-specific schedules."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    with c_config.scheduleLock:
        shutil.copy(c_tools.get_path(["schedules", convert_from.lower() + ".json"], user_file=True),
                    c_tools.get_path(["schedules", date + ".json"], user_file=True))

    c_config.last_update_time = time.time()
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
async def delete_schedule_action(request: Request,
                                 schedule_name: str = Body(description="The schedule to delete the action from."),
                                 schedule_id: str = Body(
                                     description="The unique identifier of the action to be deleted.")):
    """Delete the given action from the specified schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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
async def delete_schedule(request: Request,
                          name: str = Body(description="The name of the schedule to delete.", embed=True)):
    """Delete the given schedule."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    with c_config.scheduleLock:
        json_schedule_path = c_tools.get_path(["schedules", name + ".json"], user_file=True)
        os.remove(json_schedule_path)
    c_config.last_update_time = time.time()

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
async def refresh_schedule(request: Request):
    """Reload the schedule from disk and return it."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.get("/schedule/availableDateSpecificSchedules")
async def get_date_specific_schedules(request: Request):
    """Retrieve a list of available date-specific schedules"""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    return {"success": True, "schedules": c_sched.get_available_date_specific_schedules()}


@app.get("/schedule/{schedule_name}/get")
async def get_specific_schedule(request: Request, schedule_name: str):
    """Retrieve the given schedule and return it as a dictionary."""

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "view", token=token)
    if success is False:
        return {"success": False, "reason": reason}

    if not schedule_name.endswith('.json'):
        schedule_name += '.json'
    success, schedule = c_sched.load_json_schedule(schedule_name)

    return {"success": success, "schedule": schedule}


@app.post("/schedule/update")
async def update_schedule(
        request: Request,
        name: str = Body(),
        time_to_set: str = Body(description="The time of the action to set, expressed in any normal way."),
        action_to_set: str = Body(description="The action to set."),
        target_to_set: list | str = Body(description="The ID(s) of the component(s) that should be acted upon."),
        value_to_set: str = Body(default="", description="A value corresponding to the action."),
        schedule_id: str = Body(description="A unique identifier corresponding to the schedule entry.")):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    # Check permission
    token = request.cookies.get("authToken", "")
    success, authorizing_user, reason = c_users.check_user_permission("schedule", "edit", token=token)
    if success is False:
        return {"success": False, "reason": reason}

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

@app.get("/system/checkConnection")
async def check_connection():
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@app.get("/system/{target}/getConfiguration")
async def get_json_configuration(target: str):
    """Return the requested JSON configuration."""

    config_path = c_tools.get_path(["configuration", f"{target}.json"], user_file=True)
    configuration = c_tools.load_json(config_path)
    if configuration is not None:
        return {"success": True, "configuration": configuration}
    return {"success": False, "reason": "File does not exist."}


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
    except PermissionError:
        # For some reason, Pyinstaller insists on placing the README in a directory of the same name on Windows.
        try:
            readme_path = c_tools.get_path(["README.md", "README.md"])
            with open(readme_path, 'r', encoding='UTF-8') as f:
                text = f.read()
            response = {"success": True, "text": text}
        except (FileNotFoundError, PermissionError):
            with c_config.logLock:
                logging.error("Unable to read README.md")
            response = {"success": False, "reason": "Unable to read README.md"}

    return response


@app.get('/system/getSoftwareVersion')
async def get_version():
    """Send the current software version."""

    response = {
        "success": True,
        "version": str(c_config.software_version)
    }
    return response


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
async def update_configuration(target: str,
                               configuration=Body(description="A JSON object specifying the configuration.",
                                                  embed=True)):
    """Write the given object to the matching JSON file as the configuration."""

    if target == "system":
        c_tools.update_system_configuration(configuration)
    else:
        config_path = c_tools.get_path(["configuration", f"{target}.json"], user_file=True)
        c_tools.write_json(configuration, config_path)

        if target == "descriptions":
            c_exhibit.read_descriptions_configuration()
            c_config.last_update_time = time.time()

    return {"success": True}


@app.get('/system/updateStream')
async def send_update_stream(request: Request):
    """Create a server-side event stream to send updates to the client."""

    async def event_generator():
        last_update_time = None
        while True:
            # If client closes connection, stop sending events
            if await request.is_disconnected():
                break

            # Checks for new updates and return them to client
            if c_config.last_update_time != last_update_time:
                last_update_time = c_config.last_update_time

                yield {
                    "event": "update",
                    "id": str(last_update_time),
                    "retry": 5000,  # milliseconds
                    "data": json.dumps(send_webpage_update(), default=str)
                }
            await asyncio.sleep(0.5)  # seconds

    return EventSourceResponse(event_generator())


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
try:
    app.mount("/issues", StaticFiles(directory=c_tools.get_path(["issues"], user_file=True)),
              name="issues")
except RuntimeError:
    # Directory does not exist, so create it
    os.mkdir(c_tools.get_path(["issues"], user_file=True))
    app.mount("/issues", StaticFiles(directory=c_tools.get_path(["issues"], user_file=True)),
              name="issues")
app.mount("/",
          StaticFiles(directory=c_tools.get_path([""]), html=True),
          name="root")

if __name__ == "__main__":
    c_tools.check_file_structure()
    c_exhibit.check_available_exhibits()
    load_default_configuration()
    c_users.load_users()
    c_group.load_groups()
    c_exhibit.load_components()
    c_proj.poll_projectors()
    c_exhibit.poll_wake_on_LAN_devices()
    check_for_software_update()

    log_level = "warning"
    if c_config.debug:
        log_level = "debug"

    print(f"Launching Control Server for {c_config.gallery_name}.")
    print(f"To access the server, visit http://{c_config.ip_address}:{c_config.port}")

    # Must use only one worker, since we are relying on the config module being in global
    uvicorn.run(app,
                host="",  # Accept connections on all interfaces
                log_level=log_level,
                port=int(c_config.port),
                reload=False, workers=1)
