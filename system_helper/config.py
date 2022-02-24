"""Defines configuration variables that can be shared across various modules that use the helper.py module"""

import threading

clipList = {} # Dict of currently-loaded content. E.g., for the media player
commandList = [] # List of queued commands to send to the client
defaults_dict = {} # Dictionary holding default parameters from defaults.ini
defaults_object = None # configparser object holding the parsed input from defaults.ini
dictionary_object = None # Optionally-loaded configparser object from dictionary.ini
missingContentWarningList = [] # Holds a list of warning about missing content
NEXT_EVENT = None # A tuple with the next event to occur and the time is happens
schedule = [] # List of upcoming actions and their datetimes
HELPER_SOFTWARE_VERSION = 1.0
helper_software_update_available = False
# If we are serving the HTML file from over the neetwork, this will be set
# to True. If the HTML file has been loaded locally, it will stay False
HELPING_REMOTE_CLIENT = False

# Threading resources
defaults_file_lock = threading.Lock()
content_file_lock = threading.Lock()
