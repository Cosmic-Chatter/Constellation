# Standard imports
import datetime
import logging
import os
import threading
import time

# Constellation imports
import config
import constellation_tools as c_tools
import projector_control


class Projector:
    """Holds basic data about a projector"""

    def __init__(self,
                 id_: str,
                 ip: str,
                 connection_type: str,
                 mac_address: str = None,
                 make: str = None,
                 password: str = None):

        self.id = id_
        self.type: str = "PROJECTOR"
        self.ip = ip  # IP address of the projector
        self.password = password  # Password to access PJLink
        self.mac_address = mac_address  # For use with Wake on LAN
        self.connection_type = connection_type
        self.make = make
        self.config: dict = {"allowed_actions": ["power_on", "power_off"],
                             "description": config.componentDescriptions.get(id_, ""),
                             "app_name": "projector"}

        self.state = {"status": "OFFLINE"}
        self.last_contact_datetime = datetime.datetime(2020, 1, 1)

        self.update(full=True)

    def seconds_since_last_contact(self) -> float:

        """Calculate the number of seconds since the component last checked in."""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def update(self, full: bool = False):

        """Contact the projector to get the latest state"""

        error = False
        try:
            if self.connection_type == 'pjlink':
                connection = projector_control.pjlink_connect(self.ip, password=self.password)
                if full:
                    self.state["model"] = projector_control.pjlink_send_command(connection, "get_model")
                self.state["power_state"] = projector_control.pjlink_send_command(connection, "power_state")
                self.state["lamp_status"] = projector_control.pjlink_send_command(connection, "lamp_status")
                self.state["error_status"] = projector_control.pjlink_send_command(connection, "error_status")
            elif self.connection_type == "serial":
                connection = projector_control.serial_connect_with_url(self.ip, make=self.make)
                if full:
                    self.state["model"] = projector_control.serial_send_command(connection, "get_model", make=self.make)
                self.state["power_state"] = projector_control.serial_send_command(connection, "power_state",
                                                                                  make=self.make)
                self.state["lamp_status"] = projector_control.serial_send_command(connection, "lamp_status",
                                                                                  make=self.make)
                self.state["error_status"] = projector_control.serial_send_command(connection, "error_status",
                                                                                   make=self.make)

            self.last_contact_datetime = datetime.datetime.now()
        except Exception as e:
            # print(e)
            error = True

        if error and (self.seconds_since_last_contact() > 60):
            self.state = {"status": "OFFLINE"}
        else:
            if self.state["power_state"] == "on":
                self.state["status"] = "ONLINE"
            else:
                self.state["status"] = "STANDBY"

    def queue_command(self, cmd: str):

        """Function to spawn a thread that sends a command to the projector.

        Named "queue_command" to match what is used for exhibitComponents
        """

        print(f"Queuing command {cmd} for {self.id}")
        thread_ = threading.Thread(target=self.send_command, args=[cmd], name=f"CommandProjector_{self.id}_{str(time.time())}")
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
                connection = projector_control.pjlink_connect(self.ip, password=self.password)
                if cmd in cmd_dict:
                    projector_control.pjlink_send_command(connection, cmd_dict[cmd])
                else:
                    projector_control.pjlink_send_command(connection, cmd)
            elif self.connection_type == "serial":
                connection = projector_control.serial_connect_with_url(self.ip, make=self.make)
                if cmd in cmd_dict:
                    projector_control.serial_send_command(connection, cmd_dict[cmd], make=self.make)
                else:
                    projector_control.serial_send_command(connection, cmd, make=self.make)

        except Exception as e:
            print(e)


def get_projector(this_id: str) -> Projector:
    """Return a projector with the given id, or None if no such projector exists"""

    return next((x for x in config.projectorList if x.id == this_id), None)


def poll_projectors():
    """Ask each projector to send a status update at an interval.
    """

    for projector in config.projectorList:
        new_thread = threading.Thread(target=projector.update, name=f"PollProjector_{projector.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    config.polling_thread_dict["poll_projectors"] = threading.Timer(30, poll_projectors)
    config.polling_thread_dict["poll_projectors"].start()


def convert_config_to_json(old_config: dict[str: str], protocol: str):
    """Take a configparser object from reading galleryConfiguration.ini and use it to create a json config file."""

    # Try to load the existing configuration
    config_path = c_tools.get_path(["configuration", "projectors.json"], user_file=True)
    new_config = c_tools.load_json(config_path)
    if new_config is None:
        new_config = []

    for key in old_config:
        if key in [entry['id'] for entry in new_config]:
            # Assume the new config is more up to date than this legacy file
            continue

        new_entry = {'id': key.strip(),
                     'protocol': protocol}
        split = old_config[key].split(",")
        error = False
        if len(split) == 1:
            new_entry["ip_address"] = old_config[key].strip()
        elif len(split) == 2:
            new_entry["ip_address"] = split[0].strip()
            if protocol == 'pjlink':
                new_entry["password"] = split[1].strip()
            elif protocol == 'serial':
                new_entry["make"] = split[1].strip()
        else:
            error = True
            print(f"convert_config_to_json: error parsing line {key} = {old_config[key]}")

        if not error:
            new_config.append(new_entry)

    c_tools.write_json(new_config, config_path)


def read_projector_configuration():
    """Read the projectors.json configuration file and set up any new projectors."""

    config_path = c_tools.get_path(["configuration", "projectors.json"], user_file=True)
    proj_config = c_tools.load_json(config_path)
    config.projectorList = []

    for proj in proj_config:
        if get_projector(proj["id"]) is None:
            if proj["protocol"] == 'pjlink':
                new_proj = Projector(proj["id"], proj["ip_address"], "pjlink", password=proj.get("password", None))
                config.projectorList.append(new_proj)
            elif proj["protocol"] == "serial":
                new_proj = Projector(proj["id"], proj["ip_address"], "serial", make=proj.get("make", None))
                config.projectorList.append(new_proj)


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
