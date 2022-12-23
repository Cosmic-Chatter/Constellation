"""A program to provide basic Constellation services"""

# Standard imports
import platform
import time
import json

# Non-standard imports
import requests

# Constellation imports
import config


def get_defaults():

    """Get the user-set defaults from helper.py"""

    request_dict = {"action": "getDefaults"}

    headers = {'Content-type': 'application/json'}

    try:
        result = requests.post(config.helper_address, headers=headers, json=request_dict, timeout=2)
    except ConnectionRefusedError:
        print("Connection refused. Retrying...")
        time.sleep(3)
        return get_defaults()
    except requests.exceptions.ConnectionError:
        print("Unable to connect. Retrying...")
        time.sleep(3)
        return get_defaults()

    try:
        read_update(result.json())
    except json.decoder.JSONDecodeError:
        print("Did not receive valid JSON with defaults. Content received: ", result.text)
        return False

    return True


def read_update(update: dict):

    """Take a dictionary returned by the control server and perform any requested actions."""

    if "commands" in update:
        for cmd in update["commands"]:
            if cmd == "restart":
                send_command("restart")
            elif cmd in ["shutdown", "power_off"]:
                send_command("shutdown")
            elif cmd == "sleepDisplay":
                send_command("sleepDisplay")
            elif cmd in ["wakeDisplay", "power_on"]:
                send_command("wakeDisplay")
            elif cmd == "reloadDefaults":
                get_defaults()

    if "id" in update:
        config.this_id = update["id"]
    if "group" in update:
        config.this_group = update["group"]
    if "server_ip_address" in update and "server_port" in update:
        config.server_address = "http://" + update["server_ip_address"] + ":" + update["server_port"]
    if "helperAddress" in update:
        config.helper_address = update["helperAddress"]
    if "allow_sleep" in update:
        config.allowed_actions["sleep"] = update["allow_sleep"]
    if "allow_restart" in update:
        config.allowed_actions["restart"] = update["allow_restart"]
    if "allow_shutdown" in update:
        config.allowed_actions["shutdown"] = update["allow_shutdown"]
    if "helperSoftwareUpdateAvailable" in update:
        if update["helperSoftwareUpdateAvailable"] == "true":
            config.error_dict["helperSoftwareUpdateAvailable"] = "true"
    if "anydesk_id" in update:
        config.AnyDesk_id = update["anydesk_id"]


def send_command(command: str):

    """Send a message to the helper asking it to perform a command"""

    request_dict = {"action": command}

    headers = {'Content-type': 'application/json'}

    try:
        requests.post(config.helper_address, headers=headers, json=request_dict, timeout=2)
    except ConnectionRefusedError:
        print(f"Connection to helper refused (command: {command})")
    except requests.exceptions.ConnectionError:
        print(f"Unable to connect to helper (command: {command})")


def get_platform():
    """Format a string representing the current operating system"""

    os = platform.system()

    if os == "Darwin":
        return "macOS " + platform.mac_ver()[0]
    if os == "Linux":
        return os
    if os == "Windows":
        return "Windows " + platform.win32_ver()[0]


def send_ping():

    """Send a packet to the control server """

    request_dict = {"class": "exhibitComponent",
                    "id": config.this_id,
                    "group": config.this_group,
                    "helperAddress": config.helper_address,
                    "allowed_actions": config.allowed_actions,
                    "constellation_app_id": "heartbeat",
                    "platform_details": {"operating_system": get_platform()},
                    "AnyDeskID": config.AnyDesk_id}

    headers = {'Content-type': 'application/json'}

    try:
        result = requests.post(config.server_address, headers=headers, json=request_dict, timeout=1)
    except ConnectionRefusedError:
        print("send_ping(): Control Server connection refused")
        return
    except requests.exceptions.ConnectTimeout:
        print("send_ping(): Response from Control Server timed out (requests.exceptions.ConnectionTimeout)")
        return
    except requests.exceptions.ConnectionError:
        print("send_ping(): Unable to connect to Control Server")
        return
    except requests.exceptions.HTTPError:
        print("send_ping(): An HTTP error occurred")
        return
    except requests.exceptions.ReadTimeout:
        print("send_ping(): Ping to Control Server timed out (requests.exceptions.ReadTimeout)")
        return
    except requests.exceptions.Timeout:
        print("send_ping(): Request timed out")
        return
    except requests.exceptions.RequestException:
        print("send_ping(): An unknown error occurred.")
        return

    try:
        read_update(result.json())
    except json.decoder.JSONDecodeError:
        print("send_ping(): Did not receive valid JSON. Content received: ", result.text)


print("=======================")
print("Constellation Heartbeat")
print("=======================")
print("Loading defaults... ", end="")
if get_defaults():
    print("done")
    while True:
        send_ping()
        time.sleep(5)
else:
    print("Could not connect to helper at address " + config.helper_address)
