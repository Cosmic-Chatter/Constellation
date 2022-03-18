"""Defines configuration variables that can be shared across classes, etc."""

# Standard imports
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

# Issues
issueList = []
