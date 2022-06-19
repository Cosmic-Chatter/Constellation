"""Defines configuration variables that can be shared across various modules that use the helper.py module"""

import datetime
import threading

# Path to the directory where the server is being launched from
application_path: str = ""
# Path to the directory the code is actually running from (different from APP_PATH when using Pyinstaller)
exec_path: str = ""

clipList: dict = {}  # Dict of currently-loaded content. E.g., for the media player
commandList: list[str] = []  # List of queued commands to send to the client
defaults_dict: dict = {}  # Dictionary holding default parameters from defaults.ini
defaults_object = None  # configparser object holding the parsed input from defaults.ini
dictionary_object = None  # Optionally-loaded configparser object from dictionary.ini
missingContentWarningList: list[dict] = []  # Holds a list of warning about missing content
NEXT_EVENT: tuple[datetime.time, list[str]] = None  # A tuple with the next event to occur and the time is happens
schedule: list[tuple[datetime.time, str]] = []  # List of upcoming actions and their times
HELPER_SOFTWARE_VERSION: float = 1.0

helper_software_update_available: bool = False
# If we are serving the HTML file from over the network, this will be set
# to True. If the HTML file has been loaded locally, it will stay False
HELPING_REMOTE_CLIENT: bool = False
# Threading resources
defaults_file_lock: threading.Lock = threading.Lock()
content_file_lock: threading.Lock = threading.Lock()
