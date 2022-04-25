"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
import datetime
import threading

APP_PATH = ""  # Path to the directory where the server is being launched from

# threading resources
polling_thread_dict = {}  # Holds references to the threads starting by various polling procedures
logLock = threading.Lock()
currentExhibitConfigurationLock = threading.Lock()
trackingDataWriteLock = threading.Lock()
scheduleLock = threading.Lock()
issueLock = threading.Lock()
exhibitsLock = threading.Lock()
maintenanceLock = threading.Lock()
issueMediaLock = threading.Lock()

# Lists
issueList = []
componentList = []
projectorList = []
wakeOnLANList = []
synchronizationList = []  # Holds sets of displays that are being synchronized
componentDescriptions = {}  # Holds optional short descriptions of each component
exhibit_list = []

# Dictionary to keep track of warnings we have already presented
serverWarningDict = {}

issueList_last_update_date = datetime.datetime.now().isoformat()

