# Standard modules
import configparser
import errno
import psutil
import os
import socket
import urllib, urllib.request, urllib.error
import shutil
import sys
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
            webbrowser.open(f"http://localhost:{config.defaults_dict['helper_port']}")
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


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    # Determine an available port
    port = 8000
    port_available = False
    while port_available is False:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", port))
            port_available = True
        except socket.error as e:
            if e.errno == errno.EADDRINUSE:
                port += 1
            else:
                # Something else raised the socket.error exception
                print(e)

        s.close()

    # Add bare-bones defaults to get things off the ground
    config.defaults_dict = {
        "id": "TEMP",
        "type": "TEMP",
        "current_exhibit": "default",
        "helper_port": port,
        "server_ip_address": "240.0.0.0",
        "server_port": 8082
    }
    config.defaults_object.read_dict({"CURRENT": config.defaults_dict})
    update_defaults(config.defaults_dict, force=True)


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


def update_defaults(data: dict, force: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed."""

    update_made = force
    if "content" in data:
        if isinstance(data["content"], str):
            content = data["content"]
        elif isinstance(data["content"], list):
            content = ""
            for i in range(len(data["content"])):
                file = (data["content"])[i]
                if i != 0:
                    content += ', '
                content += file
        else:
            # Unsupported data type, so don't make a change
            content = config.defaults_dict["content"]

        # If content has changed, update our configuration
        if ("content" not in config.defaults_dict) or (content != config.defaults_dict["content"]):
            config.defaults_object.set("CURRENT", "content", content)
            config.defaults_dict["content"] = content
            update_made = True
    if "current_exhibit" in data:
        if ("current_exhibit" not in config.defaults_dict) \
                or (data["current_exhibit"] != config.defaults_dict["current_exhibit"]):
            config.defaults_object.set("CURRENT", "current_exhibit", data["current_exhibit"])
            config.defaults_dict["current_exhibit"] = data["current_exhibit"]
            update_made = True

    # Update file
    if update_made:
        with config.defaults_file_lock:
            defaults_path = helper_files.get_path(['defaults.ini'], user_file=True)
            with open(defaults_path, 'w', encoding='UTF-8') as f:
                config.defaults_object.write(f)