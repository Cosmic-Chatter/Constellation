# Standard imports
import os
import sys

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
