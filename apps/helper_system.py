# Standard imports
import datetime
import os
import sys
import threading

# Non-standard imports
import dateutil.parser
import requests

# Constellation imports
import config
import helper_files
import helper_utilities


def reboot():
    """Send an OS-appropriate command to restart the computer"""

    reboot_allowed = config.defaults_dict.get("allow_restart", "true")
    if reboot_allowed.lower() in ["true", "yes", '1', 1]:
        print("Rebooting...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to restart'")
        elif sys.platform == "linux":
            os.system("systemctl reboot -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -r")
    else:
        print("Restart requested but not permitted by defaults.ini. Set allow_restart = true to enable")


def shutdown():
    """Send an OS-appropriate command to shut down the computer.

    If shutdown is not allowed, call sleep_display() to put the display to sleep"""

    shutdown_allowed = config.defaults_dict.get("allow_shutdown", "false")
    sleep_allowed = config.defaults_dict.get("allow_sleep", "false")

    if shutdown_allowed.lower() in ["true", "yes", '1', 1]:
        print("Shutting down...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to shutdown'")
        elif sys.platform == "linux":
            os.system("systemctl shutdown -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -s")
    elif sleep_allowed.lower() in ["true", "yes", '1', 1]:
        print("Shutdown requested but not permitted. Sleeping displays...")
        sleep_display()
    else:
        print(
            "Shutdown requested but not permitted by defaults.ini. Set allow_shutdown = true to enable or set allow_sleep to enable turning off the displays")


def sleep_display():
    if helper_utilities.str_to_bool(config.defaults_dict.get("allow_sleep", True)):
        if sys.platform == "darwin":  # MacOS
            os.system("pmset displaysleepnow")
        elif sys.platform == "linux":
            os.system("xset dpms force off")
        elif sys.platform == "win32":
            nircmd_path = helper_files.get_path(["nircmd.exe"])
            os.system(nircmd_path + " monitor async_off")


def smart_restart_act():
    """Attempt to process a restart by following the rules"""

    if config.smart_restart["mode"] == "off":
        print("Smart Restart off")
        return
    elif config.smart_restart["mode"] == "aggressive":
        # In aggressive mode, we reboot right away
        print("Aggressive reboot")
        # reboot()
    elif config.smart_restart["mode"] == "patient":
        # In patient mode, we only restart when not in active hours
        now = datetime.datetime.now()
        active_start = dateutil.parser.parse(config.smart_restart["active_hours_start"])
        active_end = dateutil.parser.parse(config.smart_restart["active_hours_end"])

        if now < active_start or now > active_end:
            #reboot()
            print("Patient reboot")
        else:
            print("Patient reboot denied by active hours")


def smart_restart_check():
    """Restart the PC if we have lost connection to Control Server. This is often because the Wi-Fi has dropped."""

    # First, ping the server
    headers = {'Content-type': 'application/json'}

    server_address = f'http://{config.defaults_dict["server_ip_address"]}:{config.defaults_dict["server_port"]}'
    error = False
    try:
        _ = requests.get(server_address + '/system/checkConnection', headers=headers, timeout=5)
    except (ConnectionRefusedError, requests.exceptions.ConnectionError):
        error = True

    if not error:
        config.smart_restart["last_contact_datetime"] = datetime.datetime.now()
    else:
        # Connection check failed, so let's see how long it has been
        sec_since_last_contact = (datetime.datetime.now() - config.smart_restart["last_contact_datetime"]).total_seconds()
        print(f"Smart Restart: connection check failed. Seconds since last connection: {sec_since_last_contact}")
        if sec_since_last_contact > config.smart_restart["threshold"]:
            # A reboot may be necessary
            smart_restart_act()

    # Start the next cycle
    timer = threading.Timer(config.smart_restart["interval"], smart_restart_check)
    timer.daemon = True
    timer.start()


def wake_display():
    """Wake the display up or power it on"""

    display_type = config.defaults_dict.get("display_type", "screen")

    if display_type == "screen":
        if sys.platform == "darwin":  # MacOS
            os.system("caffeinate -u -t 2")
        elif sys.platform == "linux":
            os.system("xset dpms force on")
        elif sys.platform == "win32":
            # os.system("nircmd.exe monitor async_on")
            nircmd_path = helper_files.get_path(["nircmd.exe"])
            os.system(nircmd_path + " sendkeypress ctrl")
    elif display_type == "projector":
        pass
