# Standard modules
import copy
import errno
import functools
import psutil
import os
import socket
import urllib, urllib.request, urllib.error
import uuid
import shutil
import sys
from typing import Any, Union

# Non-standard modules
from PIL import ImageGrab
from PIL.Image import Image

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

    return "http://" + IP + ":" + str(config.defaults["system"]["port"])


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


def read_defaults() -> bool:
    """Load config.json and set up Constellation Apps based on its contents."""

    defaults_path = helper_files.get_path(["configuration", "config.json"], user_file=True)
    config.defaults = helper_files.load_json(defaults_path)
    if config.defaults is None:
        return False

    if "smart_restart" in config.defaults:
        config.smart_restart["mode"] = config.defaults["smart_restart"]["state"]
        config.smart_restart["interval"] = float(config.defaults["smart_restart"]["interval"])
        config.smart_restart["threshold"] = float(config.defaults["smart_restart"]["threshold"])
    if "active_hours" in config.defaults["system"]:
        config.smart_restart["active_hours_start"] = config.defaults["system"]["active_hours"]["start"]
        config.smart_restart["active_hours_end"] = config.defaults["system"]["active_hours"]["end"]

    return True


def update_defaults(data: dict[str, Any], cull: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed.

    If cull == True, remove any entries not included in 'data'
    """

    prior_defaults = copy.deepcopy(config.defaults)

    if prior_defaults is not None and "app" in prior_defaults and "uuid" in prior_defaults["app"]:
        uuid_str = prior_defaults["app"]["uuid"]
    else:
        uuid_str = str(uuid.uuid4())
    if cull is True or prior_defaults is None:
        # Replace the current dictionary with the new one
        new_defaults = data
    else:
        # Merge the new dictionary into the current one
        new_defaults = copy.deepcopy(prior_defaults)
        deep_merge(data, new_defaults)
    new_defaults["app"]["uuid"] = uuid_str

    if new_defaults == prior_defaults:
        if config.debug:
            print("helper_utilities.update_defaults: no changes to write.")
        return

    config.defaults = new_defaults
    defaults_path = helper_files.get_path(["configuration", "config.json"], user_file=True)
    helper_files.write_json(config.defaults, defaults_path)

    if config.debug:
        print("helper_utilities.update_defaults: update written.")


def deep_merge(source, destination):
    """ Merge  a series of nested dictionaries. Merge source INTO destination

    From https://stackoverflow.com/questions/20656135/python-deep-merge-dictionary-data/20666342#20666342
    """

    for key, value in source.items():
        if isinstance(value, dict):
            # get node or create one
            node = destination.setdefault(key, {})
            deep_merge(value, node)
        else:
            destination[key] = value


def clear_terminal():
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def capture_screenshot() -> Image | None:
    """Capture a screenshot of the primary display."""

    try:
        image = ImageGrab.grab().convert("RGB")
    except Exception as e:
        print("capture_screenshot: error:", e)
        image = None
    return image


def command_line_setup_print_gui() -> None:
    """Helper to print the header content for the setup tool"""

    clear_terminal()
    print("################################################################################")
    print("                      Welcome to Constellation Apps!")
    print("")
    print("Constellation Apps is a collection of software that helps you put your digital")
    print("content front-and-center. It's a powerful yet intuitive way to build guest-")
    print("facing digital interactives for use on the museum floor.")
    print("")
    print("Since this is your first time running Apps in this directory, we need to set up")
    print("a few things before you can get started. If you don't know the answer, or wish")
    print("to accept the default, just press the enter key.")
    print("################################################################################")
    print("")


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    """Prompt the user for several pieces of information on first-time setup"""

    defaults = {
        "app": {},
        "control_server": {},
        "permissions": {},
        "system": {
            "remote_display": True
        }
    }

    command_line_setup_print_gui()

    print("Press Enter to continue...")
    _ = input()

    command_line_setup_print_gui()

    print("--- Control Server ---")
    print("")
    print("Constellation Control Server helps you configure and control multiple")
    print("interactives from anywhere in your museum. With Control Server, you can:")
    print("  - See the status of every interactive using Apps.")
    print("  - Power on or off many types of projectors.")
    print("  - Create daily schedules that automatically power on or off devices, change")
    print("    digital signage, or even switch interactives.")
    print("  - Collect and log evaluation data and analytics.")
    print("  - Track exhibit maintenance.")
    print("")

    control_server = input("Use Control Server [Y/N] (default: N): ").strip()
    if control_server.lower() == "y":
        defaults["system"]["standalone"] = False
    else:
        defaults["system"]["standalone"] = True

    if defaults["system"]["standalone"] is False:
        command_line_setup_print_gui()

        print("--- Control Server ---")
        print("")
        ip = input("Enter the Control Server's static IP address (default=localhost): ").strip()
        if ip == "":
            ip = "localhost"
        port = input("Enter the Control Server's port (default=8082): ").strip()
        if port == "":
            port = 8082
        defaults["control_server"]["ip_address"] = ip
        defaults["control_server"]["port"] = int(port)

    command_line_setup_print_gui()

    print("--- Select a port ---")
    print("")
    print("After completing setup, you will access Constellation Apps using the web address")
    print("http://localhost:[port]. Which network port would you like to use?")
    default_port = find_available_port()

    port_to_use = input(f"Enter port (default={default_port}): ").strip()
    if port_to_use == "":
        port_to_use = default_port
    defaults["system"]["port"] = int(port_to_use)

    if defaults["system"]["standalone"] is False:
        command_line_setup_print_gui()
        print("--- Component Details ---")
        print("")
        print(" Since we're using Control Server, we need to identify this component. Each app")
        print("instance needs:")
        print("  - An ID, which uniquely identifies this component. A good ID might be")
        print("    something like 'Sports Intro Video'.")
        print("  - A group, which collects together related components. You might choose to")
        print("    group by gallery, such as 'Sports Gallery', by purpose, like 'Video', or")
        print("    something else.")

        this_id = ""
        while this_id == "":
            this_id = input("Enter ID: ").strip()
        group = ""
        while group == "":
            group = input("Enter group: ").strip()
        defaults["app"]["id"] = this_id
        defaults["app"]["group"] = group

        command_line_setup_print_gui()

        print("--- Screenshots ---")
        print("")
        print("Through the web console on Constellation Control Server, you can peek at the")
        print("current state of the app by viewing a screenshot. These screenshots are  not")
        print("stored and never leave your local network.")
        print("")

        print("Constellation Apps will now check for permission to capture screenshots.")
        _ = input("Press Enter to continue...")
        _ = capture_screenshot()

    update_defaults(defaults, cull=True)


def find_available_port(start=8000):
    """Find the next available port and return it."""

    this_port = start
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
    return this_port


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
