"""Helper functions for Control Server."""

# Standard imports
import json
import logging
import os
import sys
import threading
import _thread
from typing import Any, Union

# Non-standard imports
import psutil

# Constellation imports
import config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.APP_PATH, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.EXEC_PATH, *path_list)

    return _path


def clear_terminal() -> None:
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def load_json(path: str):
    """Load the requested JSON file from disk and return it as a dictionary."""

    if not os.path.exists(path):
        if config.debug:
            print(f"load_json: file does not exist: {path}")
        return None

    with config.galleryConfigurationLock:
        with open(path, 'r', encoding='UTF-8') as f:
            try:
                result = json.load(f)
            except json.decoder.JSONDecodeError:
                result = None
            return result


def write_json(data, path: str, append: bool = False) -> None:
    """Take the given object and try to write it to a JSON file."""

    if append:
        mode = 'a'
    else:
        mode = 'w'

    with config.galleryConfigurationLock:
        with open(path, mode, encoding='UTF-8') as f:
            json.dump(data, f, indent=2, sort_keys=True)


def load_system_configuration(from_dict: Union[dict[str, Any], None] = None) -> None:
    """Read system.json and set up c_config."""

    if from_dict is None:
        config_path = get_path(["configuration", "system.json"], user_file=True)
        system = load_json(config_path)
    else:
        system = from_dict

    config.current_exhibit = system.get("current_exhibit", "default.exhibit")
    config.port = system.get("port", 8082)
    config.ip_address = system.get("ip_address", "localhost")
    config.gallery_name = system.get("gallery_name", "")
    config.debug = system.get("debug", False)

    if config.debug:
        logging.getLogger('uvicorn').setLevel(logging.DEBUG)
    else:
        logging.getLogger('uvicorn').setLevel(logging.ERROR)


def update_system_configuration(update: dict[str, Any]) -> None:
    """Take a dictionary of updates and use it to update system.json"""

    system_path = get_path(["configuration", "system.json"], user_file=True)
    new_config = load_json(system_path) | update  # Use new merge operator
    write_json(new_config, system_path)

    load_system_configuration(from_dict=new_config)


def reboot_server(*args, **kwargs) -> None:
    """Send the necessary messages to trigger a server restart"""

    config.rebooting = True
    _thread.interrupt_main()


def start_debug_loop() -> None:
    """Begin printing debug information"""

    timer = threading.Timer(10, print_debug_details)
    timer.daemon = True
    timer.start()


def print_debug_details() -> None:
    """Print useful debug info to the console"""

    if config.debug is False:
        timer = threading.Timer(10, print_debug_details)
        timer.daemon = True
        timer.start()
        return

    print("================= Debug details =================")
    print(f"Active threads: {threading.active_count()}")
    print([x.name for x in threading.enumerate()])
    print(f"Memory used: {psutil.Process().memory_info().rss/1024/1024} Mb")
    print("=================================================", flush=True)

    timer = threading.Timer(10, print_debug_details)
    timer.daemon = True
    timer.start()


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


def check_file_structure() -> None:
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = get_path(["schedules"], user_file=True)
    exhibits_dir = get_path(["exhibits"], user_file=True)

    misc_dirs = {"analytics": get_path(["analytics"], user_file=True),
                 "components": get_path(["components"], user_file=True),
                 "configuration": get_path(["configuration"], user_file=True),
                 "flexible-tracker": get_path(["flexible-tracker"], user_file=True),
                 "flexible-tracker/data": get_path(["flexible-tracker", "data"], user_file=True),
                 "flexible-tracker/templates": get_path(["flexible-tracker", "templates"], user_file=True),
                 "issues": get_path(["issues"], user_file=True),
                 "issues/media": get_path(["issues", "media"], user_file=True),
                 "maintenance-logs": get_path(["maintenance-logs"], user_file=True),
                 "static": get_path(["static"], user_file=True)}

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
                    f.write("[]")
        except PermissionError:
            print("Error: unable to create 'schedules' directory. Do you have write permission?")

    try:
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            with open(os.path.join(exhibits_dir, "Default.json"), 'w', encoding="UTF-8") as f:
                f.write("{}")
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

