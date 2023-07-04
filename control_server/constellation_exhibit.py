# Standard imports
import datetime
import logging
import shutil
import threading
import time
from typing import Any, Union
import os

# Non-standard imports
import icmplib
import requests
import wakeonlan

# Constellation imports
import component_helpers
import config
import constellation_tools as c_tools
import projector_control


class BaseComponent:
    """A basic Constellation component."""

    def __init__(self, id_: str, group: str,
                 ip_address: Union[str, None] = None,
                 mac_address: Union[str, None] = None):

        self.id: str = id_
        self.group: str = group

        self.ip_address = ip_address
        self.mac_address = mac_address
        self.WOL_broadcast_address: str = "255.255.255.255"
        self.WOL_port: int = 9

        self.latency: Union[None, float] = None  # Latency between Control Server and the device in ms
        self.latency_timer: Union[threading.Timer, None] = None

        self.last_contact_datetime: Union[datetime.datetime, None] = datetime.datetime.now()

        self.config = {"allowed_actions": [],
                       "app_name": "",
                       "commands": [],
                       "description": config.componentDescriptions.get(id_, ""),
                       }

    def __repr__(self):
        return repr(f"[BaseComponent ID: {self.id} Group: {self.group}]")

    def clean_up(self):
        """Stop any timers so the class instance can be safely removed."""

        if self.latency_timer is not None:
            self.latency_timer.cancel()

    def remove(self):
        """Remove the component from Control Server tracking.

        If another ping is received, the component will be re-added.
        """

        self.clean_up()
        if isinstance(self, ExhibitComponent):
            config.componentList = [x for x in config.componentList if x.id != self.id]
        elif isinstance(self, Projector):
            config.projectorList = [x for x in config.projectorList if x.id != self.id]
        elif isinstance(self, WakeOnLANDevice):
            config.wakeOnLANList = [x for x in config.wakeOnLANList if x.id != self.id]

    def seconds_since_last_contact(self) -> float:
        """The number of seconds since the last successful contact with the component."""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def update_last_contact_datetime(self):

        self.last_contact_datetime = datetime.datetime.now()
        config.last_update_time = time.time()

    def poll_latency(self):
        """If we have an IP address, ping the host to measure its latency."""

        if self.ip_address is not None:
            try:
                ping = icmplib.ping(self.ip_address, privileged=False, count=1, timeout=1)
                if ping.is_alive:
                    self.latency = ping.avg_rtt
                else:
                    self.latency = None
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in config.serverWarningDict:
                    config.serverWarningDict["wakeOnLANPrivilege"] = True
                self.latency = None
            except icmplib.exceptions.NameLookupError:
                self.latency = None
            except Exception as e:
                print(f"poll_latency: {self.id}: an unknown exception occurred", e)
                self.latency = None

        self.latency_timer = threading.Timer(10, self.poll_latency)
        self.latency_timer.name = f"{self.id} latency timer"
        self.latency_timer.daemon = True
        self.latency_timer.start()


class ExhibitComponent(BaseComponent):
    """Holds basic data about a component in the exhibit"""

    def __init__(self, id_: str, group: str, category: str = 'dynamic'):

        # category='dynamic' for components that are connected over the network
        # category='static' for components added from galleryConfiguration.ini

        super().__init__(id_, group)

        self.category = category
        self.helperAddress: str = ""  # full IP and port of helper
        self.platform_details: dict = {}

        self.config["content"] = []
        self.config["definition"] = ""

        self.status_manager = component_helpers.ComponentStatusManager(category)

        if category != "static":
            self.update_configuration()
            self.poll_latency()
        else:
            self.last_contact_datetime = None

        # Check if we have specified a Wake on LAN device matching this id
        # If yes, subsume it into this component
        wol = get_wake_on_LAN_component(self.id)
        if wol is not None:
            self.mac_address = wol.mac_address
            if "power_on" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_on")
            if "shutdown" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_off")
            config.wakeOnLANList = [x for x in config.wakeOnLANList if x.id != wol.id]

    def __repr__(self):
        return repr(f"[ExhibitComponent ID: {self.id} Group: {self.group}]")

    def update_last_contact_datetime(self, interaction: bool = False):

        super().update_last_contact_datetime()
        self.status_manager.update_last_contact_datetime(interaction=interaction)

    def set_helper_address(self, address: str):
        """Set the helper IP address, modifying it first, if necessary"""

        # If address includes 'localhost', '127.0.0.1', etc., replace it with the actual IP address
        # so that we can reach it.
        address = address.replace('localhost', self.ip_address)
        address = address.replace('127.0.0.1', self.ip_address)
        address = address.replace('::1', self.ip_address)

        self.helperAddress = address

    def current_status(self) -> str:
        """Return the current status of the component

        Options: [OFFLINE, SYSTEM ON, ONLINE, ACTIVE, WAITING, STATIC]
        """

        return self.status_manager.status

    def update_configuration(self):
        """Update the component's configuration based on current exhibit configuration."""

        if config.exhibit_configuration is None or self.category == 'static':
            return

        update_made = False
        try:
            component_config = ([x for x in config.exhibit_configuration if x["id"] == self.id])[0]

            if "content" in component_config and self.config["content"] != component_config["content"]:
                self.config["content"] = component_config["content"]
                update_made = True
            if "definition" in component_config and self.config["definition"] != component_config["definition"]:
                self.config["definition"] = component_config["definition"]
                update_made = True
            if "app_name" in component_config and self.config["app_name"] != component_config["app_name"]:
                self.config["app_name"] = component_config["app_name"]
                update_made = True
        except IndexError:
            # This component is not specified in the current exhibit configuration
            self.config["content"] = []
            self.config["definition"] = ""

        self.config["current_exhibit"] = os.path.splitext(config.current_exhibit)[0]

        if update_made:
            config.last_update_time = time.time()

    def queue_command(self, command: str):
        """Queue a command to be sent to the component on the next ping"""

        if self.category == "static":
            return

        if (command in ["power_on", "wakeDisplay"]) and (self.mac_address is not None):
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
        """Send a magic packet waking the device."""

        if self.mac_address is not None:
            print(f"Sending wake on LAN packet to {self.id}")
            with config.logLock:
                logging.info(f"Sending wake on LAN packet to {self.id}")
            try:
                wakeonlan.send_magic_packet(self.mac_address,
                                            ip_address=self.WOL_broadcast_address,
                                            port=self.WOL_port)
            except ValueError as e:
                print(f"Wake on LAN error for component {self.id}: {str(e)}")
                with config.logLock:
                    logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")


class WakeOnLANDevice(BaseComponent):
    """Holds basic information about a wake on LAN device and facilitates waking it"""

    def __init__(self, id_: str,  group: str, mac_address: str, ip_address: str = None):

        super().__init__(id_, group, ip_address=ip_address, mac_address=mac_address)

        self.WOL_broadcast_address = "255.255.255.255"
        self.WOL_port = 9

        self.config["allowed_actions"] = ["power_on"]
        self.config["app_name"] = "wol_only"

        self.state = {"status": "UNKNOWN"}
        self.last_contact_datetime = datetime.datetime(2020, 1, 1)
        self.poll_latency()

    def __repr__(self):
        return repr(f"[WakeOnLANDevice ID: {self.id} Group: {self.group}]")

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
            wakeonlan.send_magic_packet(self.mac_address,
                                        ip_address=self.WOL_broadcast_address,
                                        port=self.WOL_port)
        except ValueError as e:
            print(f"Wake on LAN error for component {self.id}: {str(e)}")
            with config.logLock:
                logging.error(f"Wake on LAN error for component {self.id}: {str(e)}")

    def update(self):

        """If we have an IP address, ping the host to see if it is awake"""

        if self.ip_address is not None:
            try:
                ping = icmplib.ping(self.ip_address, privileged=False, count=1)
                prior_status = self.state["status"]
                if ping.is_alive:
                    self.state["status"] = "SYSTEM ON"
                    self.last_contact_datetime = datetime.datetime.now()
                elif self.seconds_since_last_contact() > 60:
                    self.state["status"] = "OFFLINE"
                if prior_status != self.state["status"]:
                    config.last_update_time = time.time()
            except icmplib.exceptions.SocketPermissionError:
                if "wakeOnLANPrivilege" not in config.serverWarningDict:
                    print(
                        "Warning: to check the status of Wake on LAN devices, you must run the control server with administrator privileges.")
                    with config.logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    config.serverWarningDict["wakeOnLANPrivilege"] = True
        else:
            self.state["status"] = "UNKNOWN"


class Projector(BaseComponent):
    """Holds basic data about a projector."""

    def __init__(self,
                 id_: str,
                 group: str,
                 ip_address: str,
                 connection_type: str,
                 mac_address: str = None,
                 make: str = None,
                 password: str = None):

        super().__init__(id_, group, ip_address=ip_address, mac_address=mac_address)

        self.password = password  # Password to access PJLink
        self.connection_type = connection_type
        self.make = make

        self.last_contact_datetime = datetime.datetime(2020, 1, 1)

        self.config["allowed_actions"] = ["power_on", "power_off"]
        self.config["app_name"] = "projector"

        self.state = {"status": "OFFLINE"}

        self.update()
        self.poll_latency()

    def __repr__(self):
        return repr(f"[Projector ID: {self.id} Group: {self.group}]")

    def update(self):

        """Contact the projector to get the latest state"""

        error = False
        try:
            if self.connection_type == 'pjlink':
                connection = projector_control.pjlink_connect(self.ip_address, password=self.password)
                self.state["model"] = projector_control.pjlink_send_command(connection, "get_model")
                self.state["power_state"] = projector_control.pjlink_send_command(connection, "power_state")
                self.state["lamp_status"] = projector_control.pjlink_send_command(connection, "lamp_status")
                self.state["error_status"] = projector_control.pjlink_send_command(connection, "error_status")
            elif self.connection_type == "serial":
                connection = projector_control.serial_connect_with_url(self.ip_address, make=self.make)
                self.state["model"] = projector_control.serial_send_command(connection, "get_model", make=self.make)
                self.state["power_state"] = projector_control.serial_send_command(connection, "power_state",
                                                                                  make=self.make)
                self.state["lamp_status"] = projector_control.serial_send_command(connection, "lamp_status",
                                                                                  make=self.make)
                self.state["error_status"] = projector_control.serial_send_command(connection, "error_status",
                                                                                   make=self.make)

            self.update_last_contact_datetime()
        except Exception as e:
            # print(e)
            error = True

        prior_status = self.state["status"]
        if error and (self.seconds_since_last_contact() > 60):
            self.state = {"status": "OFFLINE"}
        else:
            if self.state["power_state"] == "on":
                self.state["status"] = "ONLINE"
            else:
                self.state["status"] = "STANDBY"
        if prior_status != self.state["status"]:
            config.last_update_time = time.time()

    def queue_command(self, cmd: str):
        """Function to spawn a thread that sends a command to the projector.

        Named "queue_command" to match what is used for exhibitComponents
        """

        print(f"Queuing command {cmd} for {self.id}")
        thread_ = threading.Thread(target=self.send_command,
                                   args=[cmd],
                                   name=f"CommandProjector_{self.id}_{str(time.time())}")
        thread_.daemon = True
        thread_.start()

    def send_command(self, cmd: str):
        """Connect to a PJLink projector and send a command"""

        # Translate commands for projector_control
        cmd_dict = {
            "shutdown": "power_off",
            "sleepDisplay": "power_off",
            "wakeDisplay": "power_on"
        }

        try:
            if self.connection_type == "pjlink":
                connection = projector_control.pjlink_connect(self.ip_address, password=self.password)
                if cmd in cmd_dict:
                    projector_control.pjlink_send_command(connection, cmd_dict[cmd])
                else:
                    projector_control.pjlink_send_command(connection, cmd)
            elif self.connection_type == "serial":
                connection = projector_control.serial_connect_with_url(self.ip_address, make=self.make)
                if cmd in cmd_dict:
                    projector_control.serial_send_command(connection, cmd_dict[cmd], make=self.make)
                else:
                    projector_control.serial_send_command(connection, cmd, make=self.make)

        except Exception as e:
            print(e)


def add_exhibit_component(this_id: str, group: str, category: str = "dynamic") -> ExhibitComponent:
    """Create a new ExhibitComponent, add it to the config.componentList, and return it"""

    component = ExhibitComponent(this_id, group, category)
    config.componentList.append(component)
    config.last_update_time = time.time()

    return component


def check_available_exhibits():
    """Get a list of available exhibit configuration files"""

    config.exhibit_list = []
    exhibits_path = c_tools.get_path(["exhibits"], user_file=True)

    with config.exhibitsLock:
        for file in os.listdir(exhibits_path):
            if file.lower().endswith(".json"):
                config.exhibit_list.append(os.path.splitext(file)[0])


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


def create_new_exhibit(name: str, clone: Union[str, None]):
    """Create a new exhibit file

    Set clone=None to create a new file, or set it equal to the name of an
    existing exhibit to clone that exhibit."""

    # Make sure we have the proper extension
    if not name.lower().endswith(".json"):
        name += ".json"

    new_file = c_tools.get_path(["exhibits", name], user_file=True)

    if clone is not None:
        # Copy an existing file

        # Make sure we have the proper extension on the file we're copying from
        if not clone.lower().endswith(".json"):
            clone += ".json"
        existing_file = c_tools.get_path(["exhibits", clone], user_file=True)
        shutil.copyfile(existing_file, new_file)

    else:
        # Make a new file
        c_tools.write_json([], new_file)

    config.last_update_time = time.time()
    check_available_exhibits()


def delete_exhibit(name: str):
    """Delete the specified exhibit file"""

    # Make sure we have the proper extension
    if not name.lower().endswith(".json"):
        name += ".json"

    file_to_delete = c_tools.get_path(["exhibits", name], user_file=True)

    with config.exhibitsLock:
        try:
            os.remove(file_to_delete)
        except FileNotFoundError:
            print(f"Error: Unable to delete exhibit {file_to_delete}. File not found!")

    config.last_update_time = time.time()
    check_available_exhibits()


def get_exhibit_component(this_id: str) -> ExhibitComponent:
    """Return a component with the given id, or None if no such component exists"""

    component = next((x for x in config.componentList if x.id == this_id), None)

    if component is None:
        # Try projector
        component = next((x for x in config.projectorList if x.id == this_id), None)

    if component is None:
        # Try wake on LAN
        component = get_wake_on_LAN_component(this_id)

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
    config.polling_thread_dict["poll_wake_on_LAN_devices"].daemon = True
    config.polling_thread_dict["poll_wake_on_LAN_devices"].start()


def read_exhibit_configuration(name: str):
    # We want the format of name to be "XXXX.json", but it might be
    # "exhibits/XXXX.json"
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

    exhibit_path = c_tools.get_path(["exhibits", name + ".json"], user_file=True)
    config.current_exhibit = os.path.splitext(name)[0]
    config.exhibit_configuration = c_tools.load_json(exhibit_path)
    config.last_update_time = time.time()


def update_exhibit_configuration(this_id: str, update: dict[str, Any], exhibit_name: str = ""):
    """Update an exhibit configuration with the given data for a given id."""

    if exhibit_name == "" or exhibit_name is None:
        exhibit_name = config.current_exhibit

    exhibit_path = c_tools.get_path(["exhibits", exhibit_name + ".json"], user_file=True)
    exhibit_config = c_tools.load_json(exhibit_path)

    match_found = False
    for index, component in enumerate(exhibit_config):
        if component["id"] == this_id:
            exhibit_config[index] |= update
            match_found = True
    if not match_found:
        exhibit_config.append({"id": this_id} | update)
    config.exhibit_configuration = exhibit_config

    c_tools.write_json(exhibit_config, exhibit_path)
    this_component = get_exhibit_component(this_id)
    if this_component is not None:
        this_component.update_configuration()


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


def update_exhibit_component_status(data: dict[str, Any], ip: str):
    """Update an ExhibitComponent with the values in a dictionary."""

    this_id = data["id"]
    group = data["group"]

    if ip == "::1":
        ip = "localhost"

    component = get_exhibit_component(this_id)
    if component is None:  # This is a new id, so make the component
        component = add_exhibit_component(this_id, group)

    component.ip_address = ip
    if "helperAddress" in data:
        component.set_helper_address(data["helperAddress"])

    component.update_last_contact_datetime(interaction=data.get("currentInteraction", False))

    if "AnyDeskID" in data:
        component.config["AnyDeskID"] = data["AnyDeskID"]
    if "autoplay_audio" in data:
        component.config["autoplay_audio"] = data["autoplay_audio"]
    if "allowed_actions" in data:
        allowed_actions = data["allowed_actions"]

        for key in allowed_actions:
            if allowed_actions[key] is True:
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
            update_exhibit_configuration(this_id, {"app_name": data["constellation_app_id"]})
    if "platform_details" in data:
        if isinstance(data["platform_details"], dict):
            component.platform_details.update(data["platform_details"])


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


def read_static_components_configuration():
    """Read the static.json configuration file."""

    config_path = c_tools.get_path(["configuration", "static.json"], user_file=True)
    components = c_tools.load_json(config_path)
    if components is None:
        return

    # Remove all static components before adding the most up-to-date list
    config.componentList = [x for x in config.componentList if x.category != "static"]

    for entry in components:
        if get_exhibit_component(entry["id"]) is None:
            component = add_exhibit_component(entry["id"], entry["group"], category="static")
            component.config["app_name"] = "static_component"


def read_wake_on_LAN_configuration():
    """Read the descriptions.json configuration file."""

    config_path = c_tools.get_path(["configuration", "wake_on_LAN.json"], user_file=True)
    devices = c_tools.load_json(config_path)
    if devices is None:
        return
    for device in config.wakeOnLANList:
        device.clean_up()
    config.wakeOnLANList = []

    for entry in devices:
        if get_wake_on_LAN_component(entry["id"]) is None:
            device = WakeOnLANDevice(entry["id"],
                                     entry.get("group", "WAKE_ON_LAN"),
                                     entry["mac_address"],
                                     ip_address=entry.get("ip_address", ""))
            config.wakeOnLANList.append(device)


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
