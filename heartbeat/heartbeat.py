"""A program to provide basic Constellation services"""

import time
import json

import requests

import config


def get_defaults():

    """Get the user-set defaults from helper.py"""

    request_dict = {"action": "getDefaults"}

    headers = {'Content-type': 'application/json'}

    try:
        result = requests.post(config.helper_address, headers=headers, json=request_dict, timeout=2)
        read_update(result.json())
    except ConnectionRefusedError:
        print("Connection refused. Retrying...")
        time.sleep(3)
        get_defaults()
    except requests.exceptions.ConnectionError:
        print("Unable to connect. Retrying...")
        time.sleep(3)
        get_defaults()
    except json.decoder.JSONDecodeError:
        print("Did not receive valid JSON with defaults. Content received: ", result.text)
        return False

    return True

def read_update(update):

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
    if "type" in update:
        config.this_type = update["type"]
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

def send_command(command):

    """Send a message to the helper asking it to perform a command"""

    request_dict = {"action": command}

    headers = {'Content-type': 'application/json'}

    try:
        requests.post(config.helper_address, headers=headers, json=request_dict, timeout=2)
    except ConnectionRefusedError:
        print(f"Connection to helper refused (command: {command})")
    except requests.exceptions.ConnectionError:
        print(f"Unable to connect to helper (command: {command})")

def send_ping():

    """Send a packet to the control server """

    request_dict = {"class": "exhibitComponent",
                    "id": config.this_id,
                    "type": config.this_type,
                    "helperAddress": config.helper_address,
                    "allowed_actions": config.allowed_actions,
                    "AnyDeskID": config.AnyDesk_id}

    headers = {'Content-type': 'application/json'}

    try:
        result = requests.post(config.server_address, headers=headers, json=request_dict, timeout=1)
        read_update(result.json())
    except ConnectionRefusedError:
        print("Connection refused")
    except requests.exceptions.ConnectionError:
        print("Unable to connect")
    except json.decoder.JSONDecodeError:
        print("Did not receive valid JSON. Content received: ", result.text)

if get_defaults():
    while True:
        send_ping()
        time.sleep(5)
