""""""

# Standard imports
from functools import partial
import os
import sys
import threading
import _thread

# Non-standard imports
import psutil

# Constellation imports
import config
import constellation_schedule as c_sched


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.APP_PATH, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.EXEC_PATH, *path_list)

    return _path


def reboot_server(*args, **kwargs) -> None:
    """Send the necessary messages to trigger a server restart"""

    config.rebooting = True
    _thread.interrupt_main()


def print_debug_details(loop: bool = False) -> None:
    """Print useful debug info to the console"""

    print("================= Debug details =================")
    print(f"Active threads: {threading.active_count()}")
    print([x.name for x in threading.enumerate()])
    print(f"Memory used: {psutil.Process().memory_info().rss/1024/1024} Mb")
    print("=================================================", flush=True)

    if loop:
        threading.Timer(10, partial(print_debug_details, loop=True)).start()


def delete_file(file_path) -> dict:
    """Delete the specified file and return a dictionary with the result"""

    response = {"success": False}
    try:
        os.remove(file_path)
        response["success"] = True
    except FileNotFoundError:
        response["reason"] = f"File {file_path} does not exist"
    except PermissionError:
        response["reason"] = f"You do not have permission for the file f{file_path}"
    return response


def send_webpage_update():
    """Function to collect the current exhibit status, format it, and send it back to the web client to update the page."""

    component_dict_list = []
    for item in config.componentList:
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

    for item in config.projectorList:
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

    for item in config.wakeOnLANList:
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
            "currentExhibit": config.currentExhibit,
            "availableExhibits": config.exhibit_list,
            "galleryName": config.gallery_name,
            "updateAvailable": str(config.software_update_available).lower()}
    component_dict_list.append(temp)

    # Also include an object containing the current issues
    temp = {"class": "issues",
            "issueList": [x.details for x in config.issueList],
            "lastUpdateDate": config.issueList_last_update_date,
            "assignable_staff": config.assignable_staff}
    component_dict_list.append(temp)

    # Also include an object containing the current schedule
    c_sched.retrieve_json_schedule()
    with config.scheduleLock:
        temp = {"class": "schedule",
                "updateTime": config.scheduleUpdateTime,
                "schedule": config.json_schedule_list,
                "nextEvent": config.json_next_event}
        component_dict_list.append(temp)

    # json_string = json.dumps(component_dict_list, default=str)
    return component_dict_list


def check_file_structure():
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = get_path(["schedules"], user_file=True)
    exhibits_dir = get_path(["exhibits"], user_file=True)

    misc_dirs = {"analytics": get_path(["analytics"], user_file=True),
                 "flexible-tracker": get_path(["flexible-tracker"], user_file=True),
                 "flexible-tracker/data": get_path(["flexible-tracker", "data"], user_file=True),
                 "flexible-tracker/templates": get_path(["flexible-tracker", "templates"], user_file=True),
                 "issues": get_path(["issues"], user_file=True),
                 "issues/media": get_path(["issues", "media"], user_file=True),
                 "maintenance-logs": get_path(["maintenance-logs"], user_file=True)}

    try:
        os.listdir(schedules_dir)
    except FileNotFoundError:
        print("Missing schedules directory. Creating now...")
        try:
            os.mkdir(schedules_dir)
            default_schedule_list = ["monday.json", "tuesday.json",
                                     "wednesday.json", "thursday.json",
                                     "friday.json", "saturday.json",
                                     "sunday.json"]

            for file in default_schedule_list:
                with open(os.path.join(schedules_dir, file), 'w', encoding="UTF-8") as f:
                    f.write("{}")
        except PermissionError:
            print("Error: unable to create 'schedules' directory. Do you have write permission?")

    try:
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            with open(os.path.join(exhibits_dir, "default.exhibit"), 'w', encoding="UTF-8") as f:
                f.write("")
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    for key in misc_dirs:
        try:
            os.listdir(misc_dirs[key])
        except FileNotFoundError:
            print(f"Missing {key} directory. Creating now...")
            try:
                os.mkdir(misc_dirs[key])
            except PermissionError:
                print(f"Error: unable to create '{key}' directory. Do you have write permission?")