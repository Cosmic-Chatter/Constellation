""""""

# Standard imports
import os
import sys
import _thread

# Non-standard imports

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
