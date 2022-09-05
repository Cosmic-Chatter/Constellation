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
from typing import Union
import webbrowser

# Constellation modules
import config
import helper_files


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/system_helper/version.txt",
                timeout=1):
            if float(line.decode('utf-8')) > config.HELPER_SOFTWARE_VERSION:
                config.helper_software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("network connection unavailable")
        return
    if config.helper_software_update_available:
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
        else:
            handle_missing_defaults_file()
            read_default_configuration(check_directories=check_directories, dict_to_read=dict_to_read)
            threading.Timer(5, functools.partial(webbrowser.open, f"http://localhost:{config.defaults_dict['helper_port']}")).start()
            return

    default = config.defaults_object["CURRENT"]
    config.defaults_dict = dict(default.items())

    if "autoplay_audio" in config.defaults_dict \
            and str_to_bool(config.defaults_dict["autoplay_audio"]) is True:
        print(
            "Warning: You have enabled audio. Make sure the file is whitelisted in the browser or media will not play.")

    # Make sure we have the appropriate file system set up
    if check_directories:
        helper_files.check_directory_structure()


def clear_terminal():
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {"current_exhibit": "default"}

    clear_terminal()
    print("##########################################################")
    print("Welcome to Constellation Apps!")
    print("")
    print("This appears to be your first time running an app in this")
    print("directory. In order to set up your configuration, you will")
    print("be asked a few questions. If you don't know the answer, or")
    print("wish to accept the default, just press the enter key.")
    print("")
    this_id = input("Enter a unique ID for this app (default: TEMP): ").strip()
    if this_id == "":
        this_id = "TEMP"
    settings_dict["id"] = this_id

    this_type = input("Enter a type for this app (no spaces, default: TEMP): ").strip().replace(' ', '-')
    if this_type == "":
        this_type = "TEMP"
    settings_dict["type"] = this_type

    ip_address = input(f"Enter the static Constellation Control Server IP address. If you do not know what this is, ask your system administrator. (default: localhost): ").strip()
    if ip_address == "":
        ip_address = 'localhost'
    settings_dict["server_ip_address"] = ip_address

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
    helper_port = input(
        f"Enter the port for this app. If you do not know what this is, ask your system administrator. (default: {this_port}): ").strip()
    if helper_port == "":
        helper_port = str(this_port)
    settings_dict["helper_port"] = helper_port

    config.defaults_object.read_dict({"CURRENT": settings_dict})
    update_defaults(settings_dict, force=True)


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
            print("strToBool: Warning: ambiguous string, returning False", val)
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


def update_defaults(data: dict, force: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed."""

    update_made = force
    if "content" in data:
        if isinstance(data["content"], list):
            content = ""
            for i in range(len(data["content"])):
                file = (data["content"])[i]
                if i != 0:
                    content += ', '
                content += file
            data["content"] = content
        else:
            # Unsupported data type, so don't make a change
            content = config.defaults_dict["content"]

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