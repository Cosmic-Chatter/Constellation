"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
import configparser
import datetime
import threading
from typing import Union

# Path to the directory where the server is being launched from
APP_PATH: str = ""
# Path to the directory the code is actually running from (different from APP_PATH when using Pyinstaller)
EXEC_PATH: str = ""

debug: bool = False  # True means print various debug info

# Threading resources
polling_thread_dict = {}  # Holds references to the threads starting by various polling procedures
logLock: threading.Lock = threading.Lock()
galleryConfigurationLock: threading.Lock = threading.Lock()
trackingDataWriteLock: threading.Lock = threading.Lock()
trackerTemplateWriteLock: threading.Lock = threading.Lock()
scheduleLock: threading.Lock = threading.Lock()
issueLock: threading.Lock = threading.Lock()
exhibitsLock: threading.Lock = threading.Lock()
maintenanceLock: threading.Lock = threading.Lock()
issueMediaLock: threading.Lock = threading.Lock()

# Lists
componentList = []
projectorList = []
wakeOnLANList = []
synchronizationList = []  # Holds sets of displays that are being synchronized
componentDescriptions = {}  # Holds optional short descriptions of each component

# Dictionary to keep track of warnings we have already presented
serverWarningDict = {}

# Issue stuff
issueList_last_update_date = datetime.datetime.now().isoformat()
issueList = []

# Schedule stuff
schedule_timers: list[threading.Timer] = []
json_schedule_list: list[dict] = []
json_next_event = []
scheduleList = []
nextEvent = {}
scheduleUpdateTime: float = 0
serverRebootTime = None
rebooting: bool = False  # This will be set to True from a background thread when it is time to reboot

# Exhibit stuff
currentExhibit: Union[str, None] = None  # The INI file defining the current exhibit "name.exhibit"
galleryConfiguration: Union[configparser.ConfigParser, None] = None  # The configParser object holding the current config
assignable_staff: list[str] = []  # staff to whom issues can be assigned.
exhibit_list: list[str] = []
