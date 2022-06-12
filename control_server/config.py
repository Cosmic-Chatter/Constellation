"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
import datetime
import threading

APP_PATH = ""  # Path to the directory where the server is being launched from

# Threading resources
polling_thread_dict = {}  # Holds references to the threads starting by various polling procedures
logLock = threading.Lock()
galleryConfigurationLock = threading.Lock()
trackingDataWriteLock = threading.Lock()
trackerTemplateWriteLock = threading.Lock()
scheduleLock = threading.Lock()
issueLock = threading.Lock()
exhibitsLock = threading.Lock()
maintenanceLock = threading.Lock()
issueMediaLock = threading.Lock()

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
scheduleList = []
nextEvent = {}
scheduleUpdateTime = 0
serverRebootTime = None
rebooting = False  # This will be set to True from a background thread when it is time to reboot

# Exhibit stuff
currentExhibit: str = None  # The INI file defining the current exhibit "name.exhibit"
currentExhibitConfiguration = None  # the configParser object holding the current config
assignable_staff: list[str] = []  # staff to whom issues can be assigned.
exhibit_list: list[str] = []
