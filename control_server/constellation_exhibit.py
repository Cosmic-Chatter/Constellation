# Standard imports
import configparser
import datetime
import logging
import shutil
import threading
import time
from typing import Union
import os

# Non-standard imports
import icmplib
import requests
import wakeonlan

# Constellation imports
import config
import constellation_tools as c_tools


class ExhibitComponent:
    """Holds basic data about a component in the exhibit"""

    def __init__(self, id_: str, this_type: str, category: str = 'dynamic'):

        # category='dynamic' for components that are connected over the network
        # category='static' for components added from galleryConfiguration.ini

        self.id: str = id_
        self.type: str = this_type
        self.category: str = category
        self.ip: str = ""  # IP address of client
        self.helperPort: int = 8000  # port of the localhost helper for this component DEPRECIATED
        self.helperAddress: str = ""  # full IP and port of helper
        self.platform_details: dict = {}

        self.macAddress: Union[str, None] = None  # Added below if we have specified a Wake on LAN device
        self.broadcastAddress: str = "255.255.255.255"
        self.WOLPort: int = 9

        self.last_contact_datetime: datetime.datetime = datetime.datetime.now()
        self.lastInteractionDateTime: datetime.datetime = datetime.datetime(2020, 1, 1)

        self.config = {"commands": [],
                       "allowed_actions": [],
                       "description": config.componentDescriptions.get(id_, ""),
                       "AnyDeskID": "",
                       "app_name": ""}

        if category != "static":
            self.update_configuration()
        else:
            self.last_contact_datetime = None

        # Check if we have specified a Wake on LAN device matching this id
        # If yes, subsume it into this component
        wol = get_wake_on_LAN_component(self.id)
        if wol is not None:
            self.macAddress = wol.macAddress
            if "power_on" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_on")
            if "shutdown" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_off")
            config.wakeOnLANList = [x for x in config.wakeOnLANList if x.id != wol.id]

    def seconds_since_last_contact(self) -> float:

        """Return the number of seconds since a ping was received"""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def seconds_since_last_interaction(self) -> float:

        """Return the number of seconds since an interaction was recorded"""

        diff = datetime.datetime.now() - self.lastInteractionDateTime
        return diff.total_seconds()

    def update_last_contact_datetime(self):

        # We've received a new ping from this component, so update its
        # last_contact_datetime

        self.last_contact_datetime = datetime.datetime.now()

    def update_last_interaction_datetime(self):

        # We've received a new interaction ping, so update its
        # lastInteractionDateTime

        self.lastInteractionDateTime = datetime.datetime.now()

    def current_status(self) -> str:

        """Return the current status of the component

        Options: [OFFLINE, SYSTEM ON, ONLINE, ACTIVE, WAITING]
        """

        if self.category == "static":
            return "STATIC"

        if self.seconds_since_last_contact() < 30:
            if self.seconds_since_last_interaction() < 10:
                status = "ACTIVE"
            else:
                status = "ONLINE"
        elif self.seconds_since_last_contact() < 60:
            status = "WAITING"
        else:
            # If we haven't heard from the component, we might still be able
            # to ping the PC and see if it is alive
            status = self.update_PC_status()

        return status

    def update_configuration(self):

        """Retrieve the latest configuration data from the configParser object"""
        try:
            file_config = dict(config.exhibitConfiguration.items(self.id))
            for key in file_config:
                if key == 'content':
                    self.config[key] = [s.strip() for s in file_config[key].split(",")]
                elif key == "description":
                    pass  # This is specified elsewhere
                else:
                    self.config[key] = file_config[key]
        except configparser.NoSectionError:
            pass
        self.config["current_exhibit"] = config.currentExhibit[0:-8]

    def queue_command(self, command: str):

        """Queue a command to be sent to the component on the next ping"""

        if self.category == "static":
            return

        if (command in ["power_on", "wakeDisplay"]) and (self.macAddress is not None):
            self.wake_with_LAN()
        elif command in ['shutdown', 'restart']:
            # Send these commands directly to the helper
            print(f"{self.id}: command sent to helper: {command}")
            requests.get('http://' + self.helperAddress + '/' + command)
        else:
            # Queue all other commands for the next ping
            print(f"{self.id}: command queued: {command}")
            self.config["commands"].append(command)
            print(f"{self.id}: pending commands: {self.config['commands']}")

    def wake_with_LAN(self):

        # Function to send a magic packet waking the device

        if self.macAddress is not None:

            print(f"Sending wake on LAN packet to {self.id}")
            with config.logLock:
                logging.info(f"Sending wake on LAN packet to {self.id}")
            try:
                wakeonlan.send_magic_packet(self.macAddress,
                                            ip_address=self.broadcastAddress,
                                            port=self.WOLPort)
            except ValueError as e:
                print(f"Wake on LAN error for component {self.id}: {str(e)}")
                with config.logLock:
                    logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")

    def update_PC_status(self):
        """If we have an IP address, ping the host to see if it is awake"""

        status = "UNKNOWN"
        if self.ip is not None:
            try:
                ping = icmplib.ping(self.ip, privileged=False, count=1, timeout=0.05)
                if ping.is_alive:
                    status = "SYSTEM ON"
                elif self.seconds_since_last_contact() > 60:
                    status = "OFFLINE"
                else:
                    status = "WAITING"
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in config.serverWarningDict:
                    print(
                        "Warning: to check the status of Wake on LAN devices, you must run the control server with administrator privileges.")
                    with config.logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    config.serverWarningDict["wakeOnLANPrivilege"] = True
        return status


class WakeOnLANDevice:
    """Holds basic information about a wake on LAN device and facilitates waking it"""

    def __init__(self, id_: str, mac_address: str, ip_address: str = None):

        self.id = id_
        self.type = "WAKE_ON_LAN"
        self.macAddress = mac_address
        self.broadcastAddress = "255.255.255.255"
        self.port = 9
        self.ip = ip_address
        self.config = {"allowed_actions": ["power_on"],
                       "description": config.componentDescriptions.get(id_, ""),
                       "app_name": "wol_only"}

        self.state = {"status": "UNKNOWN"}
        self.last_contact_datetime = datetime.datetime(2020, 1, 1)

    def seconds_since_last_contact(self) -> float:

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def queue_command(self, cmd: str):

        """Wrapper function to match other exhibit components"""

        if cmd in ["power_on", "wakeDisplay"]:
            self.wake()

    def wake(self):

        """Function to send a magic packet waking the device"""

        print(f"Sending wake on LAN packet to {self.id}")
        with config.logLock:
            logging.info(f"Sending wake on LAN packet to {self.id}")
        try:
            wakeonlan.send_magic_packet(self.macAddress,
                                        ip_address=self.broadcastAddress,
                                        port=self.port)
        except ValueError as e:
            print(f"Wake on LAN error for component {self.id}: {str(e)}")
            with config.logLock:
                logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")

    def update(self):

        """If we have an IP address, ping the host to see if it is awake"""

        if self.ip is not None:
            try:
                ping = icmplib.ping(self.ip, privileged=False, count=1)
                if ping.is_alive:
                    self.state["status"] = "SYSTEM ON"
                    self.last_contact_datetime = datetime.datetime.now()
                elif self.seconds_since_last_contact() > 60:
                    self.state["status"] = "OFFLINE"
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in config.serverWarningDict:
                    print(
                        "Warning: to check the status of Wake on LAN devices, you must run the control server with administrator privileges.")
                    with config.logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    config.serverWarningDict["wakeOnLANPrivilege"] = True
        else:
            self.state["status"] = "UNKNOWN"


def add_exhibit_component(this_id: str, this_type: str, category: str = "dynamic") -> ExhibitComponent:
    """Create a new ExhibitComponent, add it to the config.componentList, and return it"""

    component = ExhibitComponent(this_id, this_type, category)
    config.componentList.append(component)

    return component


def check_available_exhibits():
    """Get a list of available "*.exhibit" configuration files"""

    config.exhibit_list = []
    exhibits_path = c_tools.get_path(["exhibits"], user_file=True)

    with config.exhibitsLock:
        for file in os.listdir(exhibits_path):
            if file.lower().endswith(".exhibit"):
                config.exhibit_list.append(file)


def command_all_exhibit_components(cmd: str):
    """Queue a command for every exhibit component"""

    print("Sending command to all components:", cmd)
    with config.logLock:
        logging.info("command_all_exhibit_components: %s", cmd)

    for component in config.componentList:
        component.queue_command(cmd)

    for projector in config.projectorList:
        projector.queue_command(cmd)

    for device in config.wakeOnLANList:
        device.queue_command(cmd)


def create_new_exhibit(name: str, clone: str):
    """Create a new exhibit file

    Set clone=None to create a new file, or set it equal to the name of an
    existing exhibit to clone that exhibit."""

    # Make sure we have the proper extension
    if not name.lower().endswith(".exhibit"):
        name += ".exhibit"

    new_file = c_tools.get_path(["exhibits", name], user_file=True)

    if clone is not None:
        # Copy an existing file

        # Make sure we have the proper extension on the file we're copying from
        if not clone.lower().endswith(".exhibit"):
            clone += ".exhibit"
        existing_file = c_tools.get_path(["exhibits", clone], user_file=True)
        shutil.copyfile(existing_file, new_file)

    else:
        # Make a new file
        with config.exhibitsLock:
            if not os.path.isfile(new_file):
                # If this file does not exist, touch it so that it does.
                with open(new_file, "w", encoding='UTF-8'):
                    pass

    check_available_exhibits()


def delete_exhibit(name: str):
    """Delete the specified exhibit file"""

    # Make sure we have the proper extension
    if not name.lower().endswith(".exhibit"):
        name += ".exhibit"

    file_to_delete = c_tools.get_path(["exhibits", name], user_file=True)

    with config.exhibitsLock:
        try:
            os.remove(file_to_delete)
        except FileNotFoundError:
            print(f"Error: Unable to delete exhibit {file_to_delete}. File not found!")

    check_available_exhibits()


def get_exhibit_component(this_id: str) -> ExhibitComponent:
    """Return a component with the given id, or None if no such component exists"""

    component = next((x for x in config.componentList if x.id == this_id), None)

    if component is None:
        # Try projector
        component = next((x for x in config.projectorList if x.id == this_id), None)

    return component


def get_wake_on_LAN_component(this_id: str) -> WakeOnLANDevice:
    """Return a WakeOnLan device with the given id, or None if no such component exists"""

    return next((x for x in config.wakeOnLANList if x.id == this_id), None)


def poll_wake_on_LAN_devices():
    """Ask every Wake on LAN device to report its status at an interval.
    """

    for device in config.wakeOnLANList:
        new_thread = threading.Thread(target=device.update, name=f"Poll_WOL_{device.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    config.polling_thread_dict["poll_wake_on_LAN_devices"] = threading.Timer(30, poll_wake_on_LAN_devices)
    config.polling_thread_dict["poll_wake_on_LAN_devices"].start()


def read_exhibit_configuration(name: str, update_default: bool = False):

    # We want the format of name to be "XXXX.exhibit", but it might be
    # "exhibits/XXXX.exhibit"
    error = False
    split_path = os.path.split(name)
    if len(split_path) == 2:
        if split_path[0] == "exhibits":
            name = split_path[1]
        elif split_path[0] == "":
            pass
        else:
            error = True
    else:
        error = True

    if error:
        # Something bad has happened. Display an error and bail out
        print(
            f"Error: exhibit definition with name {name} does not appear to be properly formatted. This file should be located in the exhibits directory.")
        with config.logLock:
            logging.error('Bad exhibit definition filename: %s', name)
        return

    config.currentExhibit = name
    config.exhibitConfiguration = configparser.ConfigParser()
    exhibit_path = c_tools.get_path(["exhibits", name], user_file=True)
    config.exhibitConfiguration.read(exhibit_path)

    if update_default:
        config_reader = configparser.ConfigParser(delimiters="=")
        config_reader.optionxform = str  # Override default, which is case in-sensitive
        config_path = c_tools.get_path(['galleryConfiguration.ini'], user_file=True)
        with config.galleryConfigurationLock:
            config_reader.read(config_path)
            config_reader.set("CURRENT", "current_exhibit", name)
            with open(config_path, "w", encoding="UTF-8") as f:
                config_reader.write(f)


def set_component_content(id_: str, content_list: list[str]):
    """Loop the content list and build a string to write to the config file"""

    content = ", ".join(content_list)

    with config.galleryConfigurationLock:
        try:
            config.exhibitConfiguration.set(id_, "content", content)
        except configparser.NoSectionError:  # This exhibit does not have content for this component
            config.exhibitConfiguration.add_section(id_)
            config.exhibitConfiguration.set(id_, "content", content)

    # Update the component
    get_exhibit_component(id_).update_configuration()

    # Write new configuration to file
    with config.galleryConfigurationLock:
        with open(c_tools.get_path(["exhibits", config.currentExhibit], user_file=True), 'w', encoding="UTF-8") as f:
            config.exhibitConfiguration.write(f)


def set_component_app(id_: str, app_name: str):
    """Write the given app name to the config file."""

    with config.galleryConfigurationLock:
        try:
            config.exhibitConfiguration.set(id_, "app_name", app_name)
        except configparser.NoSectionError:  # This exhibit does not have content for this component
            config.exhibitConfiguration.add_section(id_)
            config.exhibitConfiguration.set(id_, "app_name", app_name)

    # Update the component
    get_exhibit_component(id_).update_configuration()

    # Write new configuration to file
    with config.galleryConfigurationLock:
        with open(c_tools.get_path(["exhibits", config.currentExhibit], user_file=True), 'w', encoding="UTF-8") as f:
            config.exhibitConfiguration.write(f)


def update_synchronization_list(this_id: str, other_ids: list[str]):
    """Manage synchronization between components.

    config.synchronizationList is a list of dictionaries, with one dictionary for every
    set of synchronized components.
    """

    print(f"Received sync request from {this_id} to sync with {other_ids}")
    print(f"Current synchronizationList: {config.synchronizationList}")
    id_known = False
    index = 0
    match_index = -1
    for item in config.synchronizationList:
        if this_id in item["ids"]:
            id_known = True
            match_index = index
        index += 1

    if id_known is False:
        # Create a new dictionary
        temp = {"ids": [this_id] + other_ids}
        temp["checked_in"] = [False for _ in temp["ids"]]
        (temp["checked_in"])[0] = True  # Check in the current id
        config.synchronizationList.append(temp)
    else:
        index = (config.synchronizationList[match_index])["ids"].index(this_id)
        ((config.synchronizationList[match_index])["checked_in"])[index] = True
        if all((config.synchronizationList[match_index])["checked_in"]):
            print("All components have checked in. Dispatching sync command")
            time_to_start = str(round(time.time() * 1000) + 10000)
            for item in (config.synchronizationList[match_index])["ids"]:
                get_exhibit_component(item).queue_command(f"beginSynchronization_{time_to_start}")
            # Remove this sync from the list in case it happens again later.
            config.synchronizationList.pop(match_index)


def update_exhibit_component_status(data, ip: str):
    """Update an ExhibitComponent with the values in a dictionary."""

    this_id = data["id"]
    this_type = data["type"]

    if ip == "::1":
        ip = "localhost"

    component = get_exhibit_component(this_id)
    if component is None:  # This is a new id, so make the component
        component = add_exhibit_component(this_id, this_type)

    component.ip = ip
    if "helperPort" in data:
        component.helperPort = data["helperPort"]
    component.helperAddress = f"http://{ip}:{component.helperPort}"

    if "helperIPSameAsClient" in data and data["helperIPSameAsClient"] is False:
        if "helperAddress" in data:
            component.helperAddress = data["helperAddress"]

    component.update_last_contact_datetime()
    if "AnyDeskID" in data:
        component.config["AnyDeskID"] = data["AnyDeskID"]
    if "autoplay_audio" in data:
        component.config["autoplay_audio"] = data["autoplay_audio"]
    if "imageDuration" in data:
        component.config["image_duration"] = data["imageDuration"]
    if "currentInteraction" in data:
        if data["currentInteraction"] == True or\
                (isinstance(data["currentInteraction"], str) and data["currentInteraction"].lower() == "true"):
            component.update_last_interaction_datetime()
    if "allowed_actions" in data:
        allowed_actions = data["allowed_actions"]
        for key in allowed_actions:
            if allowed_actions[key] is True or allowed_actions[key].lower() in ["true", "yes", "1"]:
                if key not in component.config["allowed_actions"]:
                    component.config["allowed_actions"].append(key)
            else:
                component.config["allowed_actions"] = [x for x in component.config["allowed_actions"] if x != key]
    if "error" in data:
        component.config["error"] = data["error"]
    else:
        if "error" in component.config:
            component.config.pop("error")
    if "constellation_app_id" in data:
        if component.config["app_name"] == "":
            component.config["app_name"] = data["constellation_app_id"]
            set_component_app(this_id, data["constellation_app_id"])
    if "platform_details" in data:
        if isinstance(data["platform_details"], dict):
            component.platform_details.update(data["platform_details"])


def convert_descriptions_config_to_json(old_config: dict[str: str]):
    """Take a dictionary from the legacy INI method of specifying component descriptions and convert it to JSON."""

    # Try to load the existing configuration
    config_path = c_tools.get_path(["configuration", "descriptions.json"], user_file=True)
    new_config = c_tools.load_json(config_path)
    if new_config is None:
        new_config = []

    for key in old_config:
        if key in [entry['id'] for entry in new_config]:
            # Assume the new config is more up to date than this legacy file
            continue

        new_entry = {"id": key,
                     "description": old_config[key]}
        new_config.append(new_entry)

    c_tools.write_json(new_config, config_path)


def convert_wake_on_LAN_to_json(old_config: dict[str: str]):
    """Take a configparser object from reading galleryConfiguration.ini and use it to create a json config file."""

    # Try to load the existing configuration
    config_path = c_tools.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    new_config = c_tools.load_json(config_path)
    if new_config is None:
        new_config = []

    for key in old_config:
        if key in [entry['id'] for entry in new_config]:
            # Assume the new config is more up to date than this legacy file
            continue

        new_entry = {'id': key.strip()}
        split = old_config[key].split(",")
        error = False
        if len(split) == 1:
            new_entry["mac_address"] = old_config[key].strip()
        elif len(split) == 2:
            new_entry["mac_address"] = split[0].strip()
            new_entry["ip_address"] = split[1].strip()
        else:
            error = True
            print(f"constellation_exhibit.convert_wake_on_LAN_to_json: error parsing line {key} = {old_config[key]}")

        if not error:
            new_config.append(new_entry)

    c_tools.write_json(new_config, config_path)


def read_descriptions_configuration():
    """Read the descriptions.json configuration file."""

    config_path = c_tools.get_path(["configuration", "descriptions.json"], user_file=True)
    descriptions = c_tools.load_json(config_path)
    if descriptions is None:
        return
    config.componentDescriptions = {}

    for entry in descriptions:
        config.componentDescriptions[entry["id"]] = entry["description"]

        component = get_exhibit_component(entry["id"])
        if component is not None:
            component.config["description"] = entry["description"]


def read_wake_on_LAN_configuration():
    """Read the descriptions.json configuration file."""

    config_path = c_tools.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    devices = c_tools.load_json(config_path)
    if devices is None:
        return
    config.wakeOnLANList = []

    for entry in devices:
        if get_wake_on_LAN_component(entry["id"]) is None:
            device = WakeOnLANDevice(entry["id"], entry["mac_address"], ip_address=entry.get("ip_address", ""))
            config.wakeOnLANList.append(device)


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
