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
