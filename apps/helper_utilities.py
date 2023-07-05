# Standard modules
import configparser
import errno
import functools
import psutil
import os
import socket
import urllib, urllib.request, urllib.error
import shutil
import sys
import threading
from typing import Any, Union
import webbrowser

# Non-standard modules
from PIL import ImageGrab
from pydantic.utils import deep_update as update_dictionary

# Constellation modules
import config
import helper_files


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                'https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/apps/_static/version.txt',
                timeout=1):
            available_version = float(line.decode('utf-8'))
            if available_version > config.HELPER_SOFTWARE_VERSION:
                config.software_update = {
                    "update_available": True,
                    "current_version": str(config.HELPER_SOFTWARE_VERSION),
                    "available_version": str(available_version)
                }
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("network connection unavailable")
        return
    if config.software_update["update_available"]:
        print("update available!")
    else:
        print("up to date.")


def get_local_address() -> str:
    """Return the IP address and port of this helper"""

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        # Doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except:
        IP = '127.0.0.1'
    finally:
        s.close()

    return "http://" + IP + ":" + str(config.defaults_dict["helper_port"])


def get_system_stats() -> dict[str, Union[int, float]]:
    """Return a dictionary with disk space, CPU load, and RAM amount"""

    result = {}

    # Get the percentage the disk is full
    total, used, free = shutil.disk_usage(os.path.abspath(config.application_path))

    result["disk_pct_free"] = round((free / total) * 100)
    result["disK_free_GB"] = round(free / (2 ** 30))  # GB

    # Get CPU load (percent used in the last 1, 5, 15 min) Doesn't work on Windows
    if sys.platform != "win32":
        cpu_load = [x / psutil.cpu_count() * 100 for x in psutil.getloadavg()]
        result["cpu_load_pct"] = round(cpu_load[1])
    else:
        result["cpu_load_pct"] = 0

    # Get memory usage
    result["ram_used_pct"] = round(psutil.virtual_memory().percent)

    return result


def read_default_configuration(check_directories: bool = True, dict_to_read: dict = None):
    """Load configuration parameters from defaults.ini"""

    config.defaults_object = configparser.ConfigParser(delimiters="=")

    if dict_to_read is not None:
        # Build the meta-dict required by configparser
        meta_dict = {"CURRENT": dict_to_read}
        config.defaults_object.read_dict(meta_dict)
    else:
        # Read defaults.ini
        defaults_path = os.path.join(config.application_path, "defaults.ini")

        if os.path.isfile(defaults_path):
            config.defaults_object.read(defaults_path)

            if "type" in config.defaults_object["CURRENT"]:
                # Replace 'type' key with 'group' key
                config.defaults_object.set("CURRENT", "group", config.defaults_object["CURRENT"].get('type'))
                settings_dict = dict(config.defaults_object["CURRENT"])
                # Remove 'type'
                settings_dict.pop("type")
                update_defaults(settings_dict, force=True)
        else:
            handle_missing_defaults_file()
            read_default_configuration(check_directories=check_directories, dict_to_read=dict_to_read)
            return

    default = config.defaults_object["CURRENT"]
    config.defaults_dict = dict(default.items())

    if "autoplay_audio" in config.defaults_dict \
            and str_to_bool(config.defaults_dict["autoplay_audio"]) is True:
        print(
            "Warning: You have enabled audio. Make sure the file is whitelisted in the browser or media will not play.")

    if "smart_restart" in config.defaults_dict:
        config.smart_restart["mode"] = config.defaults_dict["smart_restart"]
    if "active_hours_start" in config.defaults_dict:
        config.smart_restart["active_hours_start"] = config.defaults_dict["active_hours_start"]
    if "active_hours_end" in config.defaults_dict:
        config.smart_restart["active_hours_end"] = config.defaults_dict["active_hours_end"]
    if "smart_restart_interval" in config.defaults_dict:
        config.smart_restart["interval"] = float(config.defaults_dict["smart_restart_interval"])
    if "smart_restart_threshold" in config.defaults_dict:
        config.smart_restart["threshold"] = float(config.defaults_dict["smart_restart_threshold"])

    # Make sure we have the appropriate file system set up
    if check_directories:
        helper_files.check_directory_structure()


def clear_terminal():
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def capture_screenshot():
    """Capture a screenshot of the primary display."""

    return ImageGrab.grab().convert("RGB")

def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    clear_terminal()
    print("##########################################################")
    print("Welcome to Constellation Apps!")
    print("")
    print("This appears to be your first time running an app in this")
    print("directory. In order to set up your configuration, let's")
    print("answer a few questions. If you don't know the answer, or")
    print("wish to accept the default, just press the enter key.")
    print("##########################################################")
    print("")


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {"current_exhibit": "default"}

    command_line_setup_print_gui()
    
    this_id = input("Enter a unique ID for this app (default: TEMP): ").strip()
    if this_id == "":
        this_id = "TEMP"
    settings_dict["id"] = this_id

    command_line_setup_print_gui()

    print("Groups are used to organize multiple related apps (for")
    print("example, apps in the same gallery.) Every app must be")
    print("part of a group.")
    print("")

    this_group = input("Enter a group for this app (default: Default): ").strip()
    if this_group == "":
        this_group = "Default"
    settings_dict["group"] = this_group

    command_line_setup_print_gui()

    print("Constellation apps are controlled by Constellation Control")
    print("Server. You must run Control Server, either on this PC or")
    print("on another PC on this network. When setting up Control")
    print("Server, you will select a static IP address and a port,")
    print("which you need to provide to Constellation Apps now.")
    print("")


    ip_address = input(f"Enter the static Constellation Control Server IP address. If you do not know what this is, ask your system administrator. (default: localhost): ").strip()
    if ip_address == "":
        ip_address = 'localhost'
    settings_dict["server_ip_address"] = ip_address

    command_line_setup_print_gui()

    print("Constellation apps are controlled by Constellation Control")
    print("Server. You must run Control Server, either on this PC or")
    print("on another PC on this network. When setting up Control")
    print("Server, you will select a static IP address and a port,")
    print("which you need to provide to Constellation Apps now.")
    print("")

    server_port = input(
        f"Enter the port for the Constellation Control Server. If you do not know what this is, ask your system administrator. (default: 8082): ").strip()
    if server_port == "":
        server_port = '8082'
    settings_dict["server_port"] = server_port

    this_port = 8000
    port_available = False
    while port_available is False:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", this_port))
            port_available = True
        except socket.error as e:
            if e.errno == errno.EADDRINUSE:
                this_port += 1
            else:
                # Something else raised the socket.error exception
                print(e)

        s.close()

    command_line_setup_print_gui()

    print("Constellation Apps commuicates with the browser through a")
    print("network port. The same port cannot be used by multiple")
    print("apps on the same PC.")
    print("")

    helper_port = input(
        f"Enter the port for this app. If you do not know what this is, ask your system administrator. (default: {this_port}): ").strip()
    if helper_port == "":
        helper_port = str(this_port)
    settings_dict["helper_port"] = helper_port

    location = ""
    while location.lower() != 'local' and location.lower() != 'remote':
        command_line_setup_print_gui()

        print("If this PC will host the interface for the app, it is")
        print("a 'local' app. If the interface for this app will be")
        print("on another device (such as an iPad), this is a")
        print("'remote' app.")
        print("")

        location = input(
            "Will the app be displayed on this local computer or on a remote device? [local | remote] (default: local): "
        )
        if location == "":
            location = "local"

    if location == 'local':
        settings_dict["remote_display"] = False
    else:
        settings_dict["remote_display"] = True

    config.defaults_object.read_dict({"CURRENT": settings_dict})
    update_defaults(settings_dict, force=True)

    command_line_setup_print_gui()

    print("Through the web console on Constellation Control Server,")
    print("you can peek at the current state of the app by viewing")
    print("a screenshot. These screenshots are not stored and never")
    print("leave your local network.")
    print("")

    _ = input("Constellation Apps will now check for permission to capture screenshots (Press Enter to continue).")
    _ = capture_screenshot()


def str_to_bool(val: str) -> bool:
    """Take a string value like "false" and convert it to a bool"""

    if isinstance(val, bool):
        val_to_return = val
    else:
        val = str(val).strip()
        if val in ["false", "False", 'FALSE']:
            val_to_return = False
        elif val in ["true", "True", 'TRUE']:
            val_to_return = True
        else:
            val_to_return = False
            print("strToBool: Warning: ambiguous string, returning False:", val)
    return val_to_return


def check_dict_equality(dict1: dict, dict2: dict):
    """Return True if every key/value pair in both dicts is the same and False otherwise"""

    for key in dict1:
        if key in dict2 and dict1[key] == dict2[key]:
            pass
        else:
            return False

    for key in dict2:
        if key in dict1 and dict1[key] == dict2[key]:
            pass
        else:
            return False
    return True


def update_defaults(data: dict, cull: bool = False, force: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed.

    If cull == True, remove any entries not included in 'data'
    """

    if "content" in data:
        if isinstance(data["content"], list):
            content = ""
            for i in range(len(data["content"])):
                file = (data["content"])[i]
                if i != 0:
                    content += ', '
                content += file
            data["content"] = content

    if cull:
        new_dict = data
    else:
        new_dict = config.defaults_dict.copy()
        new_dict.update(data)

    # Update file
    if check_dict_equality(new_dict, config.defaults_dict) is False:
        config.defaults_dict = new_dict
        read_default_configuration(check_directories=False, dict_to_read=new_dict)
        with config.defaults_file_lock:
            defaults_path = helper_files.get_path(['defaults.ini'], user_file=True)
            with open(defaults_path, 'w', encoding='UTF-8') as f:
                config.defaults_object.write(f)


def convert_defaults_ini():
    """Convert from the legacy defaults.ini file to the JSON-based configuration files"""

    # Read defaults.ini
    config_reader = configparser.ConfigParser(delimiters="=")
    defaults_path = os.path.join(config.application_path, "defaults.ini")

    if not os.path.isfile(defaults_path):
        return

    config_reader.read(defaults_path)

    defaults_dict = dict(config_reader["CURRENT"].items())
    result = {
        "app": {
            "id": defaults_dict["id"],
            "group": defaults_dict["group"]
        },
        "control_server": {
            "ip_address": defaults_dict["server_ip_address"],
            "port": int(defaults_dict["server_port"])
        },
        "permissions": {},
        "system": {
            "port": int(defaults_dict["helper_port"]),
            "standalone": False,
            "remote_display": False
        }
    }

    # Cycle through the possible default keys and migrate each appropriately
    if "active_hours_start" in defaults_dict:
        result = update_dictionary(result, {"system": {"active_hours": {"start": defaults_dict["active_hours_start"]}}})
    if "active_hours_end" in defaults_dict:
        result = update_dictionary(result, {"system": {"active_hours": {"end": defaults_dict["active_hours_end"]}}})
    if "anydesk_id" in defaults_dict:
        result = update_dictionary(result, {"system": {"remote_viewers": {"anydesk": defaults_dict["anydesk_id"]}}})
    if "smart_restart_interval" in defaults_dict:
        result = update_dictionary(result, {"smart_restart": {"interval": int(defaults_dict["smart_restart_interval"])}})
    if "smart_restart_threshold" in defaults_dict:
        result = update_dictionary(result, {"smart_restart": {"threshold": int(defaults_dict["smart_restart_threshold"])}})
    if "smart_restart" in defaults_dict:
        result = update_dictionary(result, {"smart_restart": {"state": defaults_dict["smart_restart"]}})
    if "allow_refresh" in defaults_dict:
        result = update_dictionary(result, {"permissions": {"refresh": str_to_bool(defaults_dict["allow_refresh"])}})
    if "allow_restart" in defaults_dict:
        result = update_dictionary(result, {"permissions": {"restart": str_to_bool(defaults_dict["allow_restart"])}})
    if "allow_sleep" in defaults_dict:
        result = update_dictionary(result, {"permissions": {"sleep": str_to_bool(defaults_dict["allow_sleep"])}})
    if "allow_shutdown" in defaults_dict:
        result = update_dictionary(result, {"permissions": {"shutdown": str_to_bool(defaults_dict["allow_shutdown"])}})
    if "autoplay_audio" in defaults_dict:
        result = update_dictionary(result, {"permissions": {"audio": str_to_bool(defaults_dict["autoplay_audio"])}})

    config_path = helper_files.get_path(["configuration", "config.json"])
    try:
        helper_files.write_json(result, config_path)
    except FileNotFoundError:
        helper_files.check_directory_structure()
        helper_files.write_json(result, config_path)
