### Constellation Control Server
### A centralized server for controling museum exhibit components
### Written by Morgan Rehnberg, Fort Worth Museum of Science and History
### Released under the MIT license

# Standard modules
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import logging
import datetime
import configparser
import json
import os
import mimetypes
import cgi
import signal
import sys
import shutil
import traceback
import threading
import _thread
import pickle
import urllib.request
import time

# Non-standard modules
import wakeonlan
import icmplib
import dateutil.parser

# Constellation modules
import projector_control

class Issue:

    """Contains information relavant for tracking an issue."""

    def __init__(self, details):

        """Populate the Issue with the information stored in a dictionary"""

        self.details = {}
        now_date = datetime.datetime.now().isoformat()
        self.details["id"] = details.get("id", str(time.time()).replace(".", ""))
        self.details["creationDate"] = details.get("creationDate", now_date)
        self.details["lastUpdateDate"] = details.get("lastUpdateDate", now_date)
        self.details["priority"] = details.get("priority", "medium")
        self.details["issueName"] = details.get("issueName", "New Issue")
        self.details["issueDescription"] = details.get("issueDescription", "")
        self.details["relatedComponentIDs"] = details.get("relatedComponentIDs", [])
        self.details["assignedTo"] = details.get("assignedTo", [])


class Projector:

    """Holds basic data about a projector"""

    def __init__(self, id, ip, connection_type, mac_address=None, make=None, password=None):

        self.id = id
        self.ip = ip # IP address of the projector
        self.password = password # Password to access PJLink
        self.mac_address = mac_address # For use with Wake on LAN
        self.connection_type = connection_type
        self.make = make
        self.config = {"allowed_actions": ["power_on", "power_off"],
                       "description": componentDescriptions.get(id, "")}

        self.state = {"status": "OFFLINE"}
        self.last_contact_datetime = datetime.datetime(2020,1,1)

        self.update(full=True)

    def seconds_since_last_contact(self):

        """Calculate the number of seconds since the component last checked in."""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def update(self, full=False):

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
                self.state["power_state"] = projector_control.serial_send_command(connection, "power_state", make=self.make)
                self.state["lamp_status"] = projector_control.serial_send_command(connection, "lamp_status", make=self.make)
                self.state["error_status"] = projector_control.serial_send_command(connection, "error_status", make=self.make)

            self.last_contact_datetime = datetime.datetime.now()
        except Exception as e:
            #print(e)
            error = True

        if (error and (self.seconds_since_last_contact() > 60)):
            self.state = {"status": "OFFLINE"}
        else:
            if self.state["power_state"] == "on":
                self.state["status"] = "ONLINE"
            else:
                self.state["status"] = "STANDBY"

    def queue_command(self, cmd):

        """Function to spawn a thread that sends a command to the projector.

        Named "queue_command" to match what is used for exhibitComponents
        """

        print(f"Queuing command {cmd} for {self.id}")
        thread_ = threading.Thread(target=self.send_command, args=[cmd])
        thread_.daemon = True
        thread_.start()

    def send_command(self, cmd):

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

class ExhibitComponent:

    """Holds basic data about a component in the exhibit"""

    def __init__(self, id, this_type, category='dynamic'):

        # category='dynamic' for components that are connected over the network
        # category='static' for components added from currentExhibitConfiguration.ini

        global wakeOnLANList

        self.id = id
        self.type = this_type
        self.category = category
        self.ip = "" # IP address of client
        self.helperPort = 8000 # port of the localhost helper for this component DEPRECIATED
        self.helperAddress = None # full IP and port of helper

        self.macAddress = None # Added below if we have specified a Wake on LAN device
        self.broadcastAddress = "255.255.255.255"
        self.WOLPort = 9

        self.last_contact_datetime = datetime.datetime.now()
        self.lastInteractionDateTime = datetime.datetime(2020, 1, 1)

        self.config = {"commands": [],
                       "allowed_actions": [],
                       "description": componentDescriptions.get(id, ""),
                       "AnyDeskID": ""}

        if category != "static":
            self.update_configuration()

        # Check if we have specified a Wake on LAN device matching this id
        # If yes, subsume it into this component
        wol = get_wake_on_LAN_component(self.id)
        if wol is not None:
            self.macAddress = wol.macAddress
            if "power_on" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_on")
            if "shutdown" not in self.config["allowed_actions"]:
                self.config["allowed_actions"].append("power_off")
            wakeOnLANList = [x for x in wakeOnLANList if x.id != wol.id]

    def seconds_since_last_contact(self):

        """Return the number of seconds since a ping was received"""

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def seconds_since_last_interaction(self):

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

    def current_status(self):

        """Return the current status of the component

        Options: [OFFLINE, SYSTEM ON, ONLINE, ACTIVE, WAITING]
        """

        if self.category == "static":
            return "STATIC"

        status = 'OFFLINE'

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

        """Retreive the latest configuration data from the configParser object"""
        try:
            file_config = dict(currentExhibitConfiguration.items(self.id))
            for key in file_config:
                if key == 'content':
                    self.config[key] = [s.strip() for s in file_config[key].split(",")]
                elif key == "description":
                    pass # This is specified elsewhere
                else:
                    self.config[key] = file_config[key]
        except configparser.NoSectionError:
            print(f"Warning: there is no configuration available for component with id={self.id}")
            # with logLock:
            #     logging.warning(f"there is no configuration available for component with id={self.id}")
        self.config["current_exhibit"] = currentExhibit[0:-8]

    def queue_command(self, command):

        """Queue a command to be sent to the component on the next ping"""

        if (command in ["power_on", "wakeDisplay"]) and (self.macAddress is not None):
            self.wake_with_LAN()
        else:
            print(f"{self.id}: command queued: {command}")
            self.config["commands"].append(command)
            print(f"{self.id}: pending commands: {self.config['commands']}")

    def wake_with_LAN(self):

        # Function to send a magic packet waking the device

        if self.macAddress is not None:

            print(f"Sending wake on LAN packet to {self.id}")
            with logLock:
                logging.info(f"Sending wake on LAN packet to {self.id}")
            try:
                wakeonlan.send_magic_packet(self.macAddress,
                                            ip_address=self.broadcastAddress,
                                            port=self.WOLPort)
            except ValueError as e:
                print(f"Wake on LAN error for component {self.id}: {str(e)}")
                with logLock:
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
                if "wakeOnLANPrivilege" not in serverWarningDict:
                    print("Warning: to check the status of Wake on LAN devices, you must run the control server with administrator privileges.")
                    with logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    serverWarningDict["wakeOnLANPrivilege"] = True
        return status

class WakeOnLANDevice:

    """Holds basic information about a wake on LAN device and facilitates waking it"""

    def __init__(self, id, macAddress, ip_address=None):

        self.id = id
        self.type = "WAKE_ON_LAN"
        self.macAddress = macAddress
        self.broadcastAddress = "255.255.255.255"
        self.port = 9
        self.ip = ip_address
        self.config = {"allowed_actions": ["power_on"],
                       "description": componentDescriptions.get(id, "")}

        self.state = {"status": "UNKNOWN"}
        self.last_contact_datetime = datetime.datetime(2020,1,1)

    def seconds_since_last_contact(self):

        diff = datetime.datetime.now() - self.last_contact_datetime
        return diff.total_seconds()

    def queue_command(self, cmd):

        """Wrapper function to match other exhibit components"""

        if cmd in ["power_on", "wakeDisplay"]:
            self.wake()

    def wake(self):

        """Function to send a magic packet waking the device"""

        print(f"Sending wake on LAN packet to {self.id}")
        with logLock:
            logging.info(f"Sending wake on LAN packet to {self.id}")
        try:
            wakeonlan.send_magic_packet(self.macAddress,
                                        ip_address=self.broadcastAddress,
                                        port=self.port)
        except ValueError as e:
            print(f"Wake on LAN error for component {self.id}: {str(e)}")
            with logLock:
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
                if "wakeOnLANPrivilege" not in serverWarningDict:
                    print("Warning: to check the status of Wake on LAN devices, you must run the control server with administrator privileges.")
                    with logLock:
                        logging.info(f"Need administrator privilege to check Wake on LAN status")
                    serverWarningDict["wakeOnLANPrivilege"] = True
        else:
            self.state["status"] = "UNKNOWN"


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):

    """Stub which triggers dispatch of requests into individual threads."""

    daemon_threads = True

class RequestHandler(SimpleHTTPRequestHandler):

    """Handle incoming requests to the control server"""

    def send_current_configuration(self, id):

        """Function to respond to a POST with a string defining the current exhibit configuration"""

        json_string = json.dumps(get_exhibit_component(id).config)
        if len(get_exhibit_component(id).config["commands"]) > 0:
            # Clear the command list now that we have sent
            get_exhibit_component(id).config["commands"] = []
        self.wfile.write(bytes(json_string, encoding="UTF-8"))

    def send_webpage_update(self):

        """Function to collect the current exhibit status, format it, and send it back to the web client to update the page"""

        componentDictList = []
        for item in componentList:
            temp = {}
            temp["id"] = item.id
            temp["type"] = item.type
            if "content" in item.config:
                temp["content"] = item.config["content"]
            if "error" in item.config:
                temp["error"] = item.config["error"]
            if "allowed_actions" in item.config:
                temp["allowed_actions"] = item.config["allowed_actions"]
            if "description" in item.config:
                temp["description"] = item.config["description"]
            if "AnyDeskID" in item.config:
                temp["AnyDeskID"] = item.config["AnyDeskID"]
            temp["class"] = "exhibitComponent"
            temp["status"] = item.current_status()
            temp["ip_address"] = item.ip
            temp["helperPort"] = item.helperPort
            temp["helperAddress"] = item.helperAddress
            componentDictList.append(temp)

        for item in projectorList:
            temp = {}
            temp["id"] = item.id
            temp["type"] = 'PROJECTOR'
            temp["ip_address"] = item.ip
            if "allowed_actions" in item.config:
                temp["allowed_actions"] = item.config["allowed_actions"]
            if "description" in item.config:
                temp["description"] = item.config["description"]
            temp["class"] = "exhibitComponent"
            temp["status"] = item.state["status"]
            componentDictList.append(temp)

        for item in wakeOnLANList:
            temp = {}
            temp["id"] = item.id
            temp["type"] = 'WAKE_ON_LAN'
            temp["ip_address"] = item.ip
            if "allowed_actions" in item.config:
                temp["allowed_actions"] = item.config["allowed_actions"]
            if "description" in item.config:
                temp["description"] = item.config["description"]
            temp["class"] = "exhibitComponent"
            temp["status"] = item.state["status"]
            componentDictList.append(temp)

        # Also include an object with the status of the overall gallery
        temp = {}
        temp["class"] = "gallery"
        temp["currentExhibit"] = currentExhibit
        temp["availableExhibits"] = EXHIBIT_LIST
        temp["galleryName"] = gallery_name
        temp["updateAvailable"] = str(software_update_available).lower()
        componentDictList.append(temp)

        # Also include an object containing the current issues
        temp = {}
        temp["class"] = "issues"
        temp["issueList"] = [x.details for x in issueList]
        temp["assignable_staff"] = assignable_staff
        componentDictList.append(temp)

        # Also include an object containing the current schedule
        with scheduleLock:
            temp = {}
            temp["class"] = "schedule"
            temp["updateTime"] = scheduleUpdateTime
            temp["schedule"] = scheduleList
            temp["nextEvent"] = nextEvent
            componentDictList.append(temp)

        json_string = json.dumps(componentDictList, default=str)

        self.wfile.write(bytes(json_string, encoding="UTF-8"))

    def log_request(self, code='-', size='-'):

        # Override to suppress the automatic logging

        pass

    def do_GET(self):

        # Receive a GET request and respond with a console webpage

        # print("+++++++++++++++")
        # print("BEGIN GET")
        print(f" Active threads: {threading.active_count()}       ", end="\r", flush=True)

        # print(f"  path = {self.path}")

        # Strip out any options from the query string
        self.path = self.path.split("?")[0]
        root_path = os.path.dirname(os.path.abspath(__file__))
        if self.path.lower().endswith("html") or self.path == "/":
            if self.path == "/":
                f = open(os.path.join(root_path, "webpage.html"),"r", encoding='UTF-8')
            else:
                f = open(os.path.join(root_path, self.path), "r", encoding='UTF-8')

            page = str(f.read())

            # Build the address that the webpage should contact to reach this server
            address_to_insert = "'http://"+str(ip_address)+":"+str(server_port)+"'"
            # Then, insert that into the document
            page = page.replace("INSERT_SERVERIP_HERE", address_to_insert)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(bytes(page, encoding="UTF-8"))

            f.close()
            # print("END GET")
            # print("+++++++++++++++")
            return
        else:

            # Open the file requested and send it
            mimetype = mimetypes.guess_type(self.path, strict=False)[0]
            if self.path[0] == '/':
                # Strip out leading /, as it screws up os.path.join
                self.path = self.path[1:]
            try:
                self.send_response(200)
                self.send_header('Content-type', mimetype)
                self.end_headers()

                with open(os.path.join(root_path, self.path), 'rb') as f:
                    self.wfile.write(f.read())
                # print("END GET")
                # print("+++++++++++++++")
                return
            except IOError:
                self.send_error(404, f"File Not Found: {self.path}")
                with logLock:
                    logging.error("GET for unexpected file %s", self.path)

        # print("END GET")
        # print("+++++++++++++++")


    def do_OPTIONS(self):

        """Respond to an OPTIONS request"""
        # print("---------------")
        # print("BEGIN OPTIONS")

        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.end_headers()

        # print("END OPTIONS")
        # print("---------------")


    def do_POST(self):

        """Receives pings from client devices and respond with any updated information"""

        # print("===============")
        # print("BEGIN POST")

        print(f" Active threads: {threading.active_count()}      ", end="\r", flush=True)

        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.end_headers()

        # Get the data from the request
        try:
            ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
        except:
            print("DO_POST: Error: Are we missing the Content-Type header?")
            with logLock:
                logging.warning("POST received without content-type header")
            print(self.headers)

        if ctype == "application/json":
            # print("  application/json")

            # Unpack the data
            length = int(self.headers['Content-length'])
            data_str = self.rfile.read(length).decode("utf-8")

            try: # JSON
                data = json.loads(data_str)
            except json.decoder.JSONDecodeError: # not JSON
                data = {}
                split = data_str.split("&")
                for seg in split:
                    split2 = seg.split("=")
                    data[split2[0]] = split2[1]
            try:
                pingClass = data["class"]
            except KeyError:
                print("Error: ping received without class field")
                return # No id or type, so bail out

            # print(f"  class = {pingClass}")

            if pingClass == "webpage":
                try:
                    action = data["action"]
                except KeyError:
                    print("Error: webpage ping received without action field")
                    # print("END POST")
                    # print("===============")
                    return # No id or type, so bail out
                # print(f"    action = {action}")
                if action == "fetchUpdate":
                    self.send_webpage_update()
                elif action == "fetchProjectorUpdate":
                    if "id" in data:
                        proj = get_projector(data["id"])
                        if proj is not None:
                            #proj.update()
                            json_string = json.dumps(proj.state)
                            self.wfile.write(bytes(json_string, encoding="UTF-8"))
                        else:
                            json_string = json.dumps({"status": "DELETE"})
                            self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "reloadConfiguration":
                    load_default_configuration()

                    json_string = json.dumps({"result": "success"})
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "queueCommand":
                    get_exhibit_component(data["id"]).queue_command(data["command"])
                elif action == "queueProjectorCommand":
                    get_projector(data["id"]).queue_command(data["command"])
                    self.wfile.write(bytes("", encoding="UTF-8"))
                elif action == "queueWOLCommand":
                    get_wake_on_LAN_component(data["id"]).queue_command(data["command"])
                    self.wfile.write(bytes("", encoding="UTF-8"))
                elif action == "updateSchedule":
                    # This command handles both adding a new scheduled action
                    # and editing an existing action
                    error = False
                    error_message = ""

                    if ("name" in data and
                            "timeToSet" in data and
                            "actionToSet" in data and
                            "targetToSet" in data and
                            "isAddition" in data):
                        line_to_set = f"{data['timeToSet']} = {data['actionToSet']}"
                        if data["targetToSet"] is None:
                            line_to_set += "\n"
                        else:
                            line_to_set += f", {data['targetToSet']}\n"

                        root = os.path.dirname(os.path.abspath(__file__))
                        sched_dir = os.path.join(root, "schedules")
                        path = os.path.join(sched_dir, data["name"] + ".ini")
                        time_to_set = dateutil.parser.parse(data['timeToSet']).time()

                        if data["isAddition"]:
                            # Check if this time already exists
                            error = check_if_schedule_time_exists(path, time_to_set)

                            if not error:
                                with scheduleLock:
                                    with open(path, 'a', encoding="UTF-8") as f:
                                        f.write(line_to_set)
                            else:
                                error_message = "An action with this time already exists"
                        elif "timeToReplace" in data:
                            output_text = ""
                            time_to_replace = dateutil.parser.parse(data['timeToReplace']).time()
                            print("replacing schedule",
                                  time_to_replace, time_to_set,
                                  check_if_schedule_time_exists(path, time_to_set))

                            # We need to make sure we are not editing this entry to have
                            # the same time as another entry
                            okay_to_edit = False
                            if time_to_set == time_to_replace:
                                okay_to_edit = True
                            else:
                                okay_to_edit = not check_if_schedule_time_exists(path, time_to_set)
                            print(okay_to_edit)
                            if okay_to_edit:
                                with scheduleLock:
                                    # Iterate the file to replace the line we are changing
                                    with open(path, 'r', encoding='UTF-8') as f:
                                        for line in f.readlines():
                                            split = line.split("=")
                                            if len(split) == 2:
                                                # We have a valid ini line
                                                if dateutil.parser.parse(split[0]).time() != time_to_replace:
                                                    # This line doesn't match, so keep it as is
                                                    output_text += line
                                                else:
                                                    output_text += line_to_set
                                            else:
                                                output_text += line

                                    with open(path, 'w', encoding='UTF-8') as f:
                                        f.write(output_text)
                            else:
                                error = True
                                error_message = "An action with this time already exists"

                    else:
                        error = True
                        error_message = "Missing one or more required keys"

                    response_dict = {}
                    if not error:
                        # Reload the schedule from disk
                        retrieve_schedule()

                        # Send the updated schedule back
                        with scheduleLock:
                            response_dict["class"] = "schedule"
                            response_dict["updateTime"] = scheduleUpdateTime
                            response_dict["schedule"] = scheduleList
                            response_dict["nextEvent"] = nextEvent
                            response_dict["success"] = True
                    else:
                        response_dict["success"] = False
                        response_dict["reason"] = error_message
                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))

                elif action == 'refreshSchedule':
                    # This command reloads the schedule from disk. Normal schedule
                    # changes are passed during fetchUpdate
                    retrieve_schedule()

                    # Send the updated schedule back
                    with scheduleLock:
                        response_dict = {}
                        response_dict["class"] = "schedule"
                        response_dict["updateTime"] = scheduleUpdateTime
                        response_dict["schedule"] = scheduleList
                        response_dict["nextEvent"] = nextEvent

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "convertSchedule":
                    if "date" in data and "from" in data:
                        with scheduleLock:
                            root = os.path.dirname(os.path.abspath(__file__))
                            sched_dir = os.path.join(root, "schedules")
                            shutil.copy(os.path.join(sched_dir, data["from"].lower() + ".ini"),
                                        os.path.join(sched_dir, data["date"] + ".ini"))

                        # Reload the schedule from disk
                        retrieve_schedule()

                        # Send the updated schedule back
                        with scheduleLock:
                            response_dict = {}
                            response_dict["class"] = "schedule"
                            response_dict["updateTime"] = scheduleUpdateTime
                            response_dict["schedule"] = scheduleList
                            response_dict["nextEvent"] = nextEvent

                        json_string = json.dumps(response_dict, default=str)
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "deleteSchedule":
                    if "name" in data:
                        with scheduleLock:
                            root = os.path.dirname(os.path.abspath(__file__))
                            sched_dir = os.path.join(root, "schedules")
                            os.remove(os.path.join(sched_dir, data["name"] + ".ini"))

                        # Reload the schedule from disk
                        retrieve_schedule()

                        # Send the updated schedule back
                        with scheduleLock:
                            response_dict = {}
                            response_dict["class"] = "schedule"
                            response_dict["updateTime"] = scheduleUpdateTime
                            response_dict["schedule"] = scheduleList
                            response_dict["nextEvent"] = nextEvent

                        json_string = json.dumps(response_dict, default=str)
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "deleteScheduleAction":
                    if "from" in data and "time" in data:
                        with scheduleLock:
                            root = os.path.dirname(os.path.abspath(__file__))
                            sched_dir = os.path.join(root, "schedules")
                            output_text = ""
                            time_to_delete = dateutil.parser.parse(data['time']).time()

                            schedule_path = os.path.join(sched_dir, data["from"] + ".ini")
                            with open(schedule_path, 'r', encoding="UTF-8") as f:
                                for line in f.readlines():
                                    split = line.split("=")
                                    if len(split) == 2:
                                        # We have a valid ini line
                                        if dateutil.parser.parse(split[0]).time() != time_to_delete:
                                            # This line doesn't match, so add it for writing
                                            output_text += line
                                    else:
                                        output_text += line

                            path_to_write = os.path.join(sched_dir, data["from"] + ".ini")
                            with open(path_to_write, 'w', encoding="UTF-8") as f:
                                f.write(output_text)

                    # Reload the schedule from disk
                    retrieve_schedule()

                    # Send the updated schedule back
                    with scheduleLock:
                        response_dict = {}
                        response_dict["class"] = "schedule"
                        response_dict["updateTime"] = scheduleUpdateTime
                        response_dict["schedule"] = scheduleList
                        response_dict["nextEvent"] = nextEvent

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "setExhibit":
                    print("Changing exhibit to:", data["name"])

                    read_exhibit_configuration(data["name"], updateDefault=True)

                    # Update the components that the configuration has changed
                    for component in componentList:
                        component.update_configuration()
                elif action == "createExhibit":
                    if "name" in data and data["name"] != "":
                        clone = None
                        if "cloneFrom" in data and data["cloneFrom"] != "":
                            clone = data["cloneFrom"]
                        create_new_exhibit(data["name"], clone)
                elif action == "deleteExhibit":
                    if "name" in data and data["name"] != "":
                        delete_exhibit(data["name"])
                elif action == "setComponentContent":
                    if ("id" in data) and ("content" in data):
                        print(f"Changing content for {data['id']}:", data['content'])
                        set_component_content(data['id'], data['content'])
                elif action == "getHelpText":
                    try:
                        readme_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                   "README.md")
                        with open(readme_path, 'r', encoding='UTF-8') as f:
                            text = f.read()
                            self.wfile.write(bytes(text, encoding="UTF-8"))
                    except FileNotFoundError:
                        with logLock:
                            logging.error("Unable to read README.md")
                elif action == "createIssue":
                    if "details" in data:
                        with issueLock:
                            new_issue = Issue(data["details"])
                            issueList.append(new_issue)
                            save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {"success": False,
                                         "reason": "Must include field 'details'"}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "editIssue":
                    if "details" in data and "id" in data["details"]:
                        edit_issue(data["details"])
                        save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {
                            "success": False,
                            "reason": "Must include field 'details' with property 'id'"
                        }
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "deleteIssue":
                    if "id" in data:
                        remove_issue(data["id"])
                        save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {"success": False,
                                         "reason": "Must include field 'id'"}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "getIssueList":
                    result_str = json.dumps([x.details for x in issueList])
                    self.wfile.write(bytes(result_str, encoding="UTF-8"))
                elif action == 'updateMaintenanceStatus':
                    if "id" in data and "status" in data and "notes" in data:
                        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                 "maintenance-logs", data["id"]+".txt")
                        record = {"id": data["id"],
                                  "date": datetime.datetime.now().isoformat(),
                                  "status": data['status'],
                                  "notes": data["notes"]}
                        with maintenanceLock:
                            with open(file_path, 'a', encoding='UTF-8') as f:
                                f.write(json.dumps(record) + "\n")
                        response_dict = {"success": True}
                    else:
                        response_dict = {
                            "success": False,
                            "reason": "Must include fields 'id', 'status', and 'notes'"
                        }
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == 'getMaintenanceStatus':
                    if "id" in data:
                        file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                 "maintenance-logs", data["id"]+".txt")
                        try:
                            with maintenanceLock:
                                with open(file_path, 'rb') as f:
                                    # Seek to the end of the file and return the most recent entry
                                    try:  # catch OSError in case of a one line file
                                        f.seek(-2, os.SEEK_END)
                                        while f.read(1) != b'\n':
                                            f.seek(-2, os.SEEK_CUR)
                                    except OSError:
                                        f.seek(0)
                                    last_line = f.readline().decode()
                                    result = json.loads(last_line)
                                    response_dict = {"success": True,
                                                     "status": result["status"],
                                                     "notes": result["notes"]}
                        except FileNotFoundError:
                            response_dict = {"success": False,
                                             "reason": "No maintenance record exists",
                                             "status": "On floor, working",
                                             "notes": ""}
                    else:
                        response_dict = {"success": False,
                                         "reason": "Must include field 'id'"}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "getAllMaintenanceStatuses":
                    record_list = []
                    maintenance_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                    "maintenance-logs")
                    for file in os.listdir(maintenance_path):
                        if file.endswith(".txt"):
                            with maintenanceLock:
                                file_path = os.path.join(maintenance_path, file)
                                with open(file_path, 'rb') as f:
                                    # Seek to the end of the file and return the most recent entry
                                    try:  # catch OSError in case of a one line file
                                        f.seek(-2, os.SEEK_END)
                                        while f.read(1) != b'\n':
                                            f.seek(-2, os.SEEK_CUR)
                                    except OSError:
                                        f.seek(0)
                                    last_line = f.readline().decode()
                            record_list.append(json.loads(last_line))
                    response_dict = {"success": True,
                                     "records": record_list}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                else:
                    print(f"Error: Unknown webpage command received: {action}")
                    with logLock:
                        logging.error(f"Unknown webpage command received: {action}")

            elif pingClass == "exhibitComponent":
                if "action" in data: # not a ping
                    action = data["action"]
                    # if "id" in data:
                    #     print(f"    id = {data['id']}")
                    # print(f"    action = {action}")
                    if action == "getUploadedFile":
                        if "id" in data:
                            component = get_exhibit_component(data["id"])
                            if len(component.dataToUpload) > 0:
                                upload = component.dataToUpload.pop(0)
                                #json_string = json.dumps(upload)
                                #self.wfile.write(bytes(json_string, encoding="UTF-8"))
                                self.wfile.write(upload)
                    elif action == "beginSynchronization":
                        if "synchronizeWith" in data:
                            update_synchronization_list(data["id"], data["synchronizeWith"])
                else: # it's a ping
                    try:
                        id = data["id"]
                        # type = data["type"]
                        if id == "UNKNOWN":
                            print(f"Warning: exhibitComponent ping with id=UNKNOWN coming from {self.address_string()}")
                            self.wfile.write(json.dumps({}))
                            # print("END POST")
                            # print("===============")
                            return
                    except KeyError:
                        print("Error: exhibitComponent ping received without id or type field")
                        # print("END POST")
                        # print("===============")
                        return # No id or type, so bail out

                    # print(f"    id = {id}")
                    # print("    action = ping")

                    update_exhibit_component_status(data, self.address_string())
                    self.send_current_configuration(id)
            elif pingClass == "tracker":
                if "action" in data:
                    action = data["action"]
                    if action == "getLayoutDefinition":
                        if "name" in data:
                            layout = configparser.ConfigParser(delimiters=("="))
                            layoutDefinition = {}
                            success = True
                            reason = ""
                            try:
                                template_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                             "flexible-tracker",
                                                             "templates",
                                                             data["name"] + ".ini")
                                layout.read(template_path)
                                layoutDefinition = {s:dict(layout.items(s)) for s in layout.sections()}
                            except configparser.DuplicateSectionError:
                                success = False
                                reason = "There are two sections with the same name!"
                            response = {"success": success,
                                        "reason": reason,
                                        "layout": layoutDefinition}
                            self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    elif action == "submitData":
                        if "data" in data and "name" in data:
                            with trackingDataWriteLock:
                                file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                         "flexible-tracker",
                                                         "data", data["name"]+".txt")
                                with open(file_path, "a", encoding='UTF-8') as f:
                                    try:
                                        json_str = json.dumps(data["data"])
                                        f.write(json_str + "\n")
                                        self.wfile.write(bytes(json.dumps({"success": True}),
                                                                          encoding="UTF-8"))
                                    except:
                                        print("flexible-tracker: submitData: error: Not valid JSON")
                                        self.wfile.write(bytes(json.dumps({"success": False}), encoding="UTF-8"))
                    elif action == "submitRawText":
                        if "text" in data and "name" in data:
                            with trackingDataWriteLock:
                                path_to_write = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                             "flexible-tracker",
                                                             "data",
                                                             data["name"]+".txt")
                                with open(path_to_write, "a", encoding="UTF-8") as f:
                                    try:
                                        f.write(data["text"] + "\n")
                                        self.wfile.write(bytes(json.dumps({"success": True}), encoding="UTF-8"))
                                    except:
                                        print("flexible-tracker: submitRawText: error: Could not write text")
                                        self.wfile.write(bytes(json.dumps({"success": False}), encoding="UTF-8"))
                    elif action == "retrieveRawText":
                        if "name" in data:
                            with trackingDataWriteLock:
                                try:
                                    with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                           "flexible-tracker", "data", data["name"]+".txt"),
                                              "r", encoding='UTF-8') as f:
                                        result = f.read()
                                        self.wfile.write(bytes(json.dumps({"success": True, "text": result}), encoding="UTF-8"))
                                except FileNotFoundError:
                                    print(f"flexible-tracker: retrieveRawText: error: file {data['name']} not found!")
                                    self.wfile.write(bytes(json.dumps({"success": False, "text": ""}), encoding="UTF-8"))
                                except:
                                    print("flexible-tracker: retrieveRawText: error: Could not read text")
                                    self.wfile.write(bytes(json.dumps({"success": False, "text": ""}), encoding="UTF-8"))
                    elif action == "submitAnalytics":
                        if "data" in data and "name" in data:
                            with trackingDataWriteLock:
                                with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                       "analytics", data["name"]+".txt"),
                                         "a") as f:
                                    try:
                                        json_str = json.dumps(data["data"])
                                        f.write(json_str + "\n")
                                        self.wfile.write(bytes(json.dumps({"success": True}), encoding="UTF-8"))
                                    except:
                                        print("submitAnalytics: error: Not valid JSON")
                                        self.wfile.write(bytes(json.dumps({"success": False}), encoding="UTF-8"))
                    elif action == "getAvailableDefinitions":
                        definitionList = []

                        template_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                                     "flexible-tracker", "templates")
                        for file in os.listdir(template_path):
                            if file.endswith(".ini"):
                                definitionList.append(file)

                        self.wfile.write(bytes(json.dumps(definitionList), encoding="UTF-8"))
                    elif action == "checkConnection":
                        self.wfile.write(bytes(json.dumps({"success": True}), encoding="UTF-8"))
            else:
                print(f"Error: ping with unknown class '{pingClass}' received")
                # print("END POST")
                # print("===============")
                return # Bail out
        # print("END POST")
        # print("===============")

def set_component_content(id_, content_list):

    """Loop the content list and build a string to write to the config file"""

    content = ", ".join(content_list)

    with currentExhibitConfigurationLock:
        try:
            currentExhibitConfiguration.set(id_, "content", content)
        except configparser.NoSectionError: # This exhibit does not have content for this component
            currentExhibitConfiguration.add_section(id_)
            currentExhibitConfiguration.set(id_, "content", content)

    # Update the component
    get_exhibit_component(id_).update_configuration()

    # Write new configuration to file
    with currentExhibitConfigurationLock:
        with open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                               "exhibits", currentExhibit),
                 'w', encoding="UTF-8") as f:
            currentExhibitConfiguration.write(f)

def update_synchronization_list(this_id, other_ids):

    """Manage synchronization between components.

    synchronizationList is a list of dictionaries, with one dictionary for every
    set of synchronized components.
    """

    print(f"Received sync request from {this_id} to sync with {other_ids}")
    print(f"Current synchronizationList: {synchronizationList}")
    id_known = False
    index = 0
    match_index = -1
    for item in synchronizationList:
        if this_id in item["ids"]:
            id_known = True
            match_index = index
        index += 1

    if id_known is False:
        # Create a new dictionary
        temp = {}
        temp["ids"] = [this_id] + other_ids
        temp["checked_in"] = [False for i in temp["ids"]]
        (temp["checked_in"])[0] = True # Check in the current id
        synchronizationList.append(temp)
    else:
        index = (synchronizationList[match_index])["ids"].index(this_id)
        ((synchronizationList[match_index])["checked_in"])[index] = True
        if all((synchronizationList[match_index])["checked_in"]):
            print("All components have checked in. Dispatching sync command")
            time_to_start = str(round(time.time()*1000) + 10000)
            for item in (synchronizationList[match_index])["ids"]:
                get_exhibit_component(item).queue_command(f"beginSynchronization_{time_to_start}")
            # Remove this sync from the list in case it happens again later.
            synchronizationList.pop(match_index)

def check_if_schedule_time_exists(path, time_to_set):

    """Check the schedule given by `path` for an existing item with the same time as `time_to_set`.
    """

    with scheduleLock:
        with open(path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                split = line.split("=")
                if len(split) == 2:
                    # We have a valid ini line
                    if dateutil.parser.parse(split[0]).time() == time_to_set:
                        return True
    return False

def poll_event_schedule():


    """Periodically check the event schedule in an independant thread.
    """

    global pollingThreadDict

    check_event_schedule()
    pollingThreadDict["eventSchedule"] = threading.Timer(10, poll_event_schedule)
    pollingThreadDict["eventSchedule"].start()

def poll_projectors():

    """Ask each projector to send a status update at an interval.
    """

    for projector in projectorList:
        new_thread = threading.Thread(target=projector.update)
        new_thread.daemon = True # So it dies if we exit
        new_thread.start()

    pollingThreadDict["poll_projectors"] = threading.Timer(30, poll_projectors)
    pollingThreadDict["poll_projectors"].start()

def poll_wake_on_LAN_devices():

    """Ask every Wake on LAN device to report its status at an interval.
    """

    global pollingThreadDict

    for device in wakeOnLANList:
        new_thread = threading.Thread(target=device.update)
        new_thread.daemon = True # So it dies if we exit
        new_thread.start()

    pollingThreadDict["poll_wake_on_LAN_devices"] = threading.Timer(30, poll_wake_on_LAN_devices)
    pollingThreadDict["poll_wake_on_LAN_devices"].start()

def check_event_schedule():

    """Read the "Next event" tuple in schedule_dict and take action if necessary
    Also check if it's time to reboot the server"""

    global nextEvent
    global config
    global rebooting

    if nextEvent["date"] is not None:
        if datetime.datetime.now() > nextEvent["date"]:
            action = nextEvent["action"]
            target = None
            if isinstance(action, list):
                if len(action) == 1:
                    action = action[0]
                elif len(action) == 2:
                    target = action[1]
                    action = action[0]
                else:
                    print(f"Error: unrecofnized event format: {action}")
                    with logLock:
                        logging.error("Unrecofnized event format: %s", action)
                    queue_next_on_off_event()
                    return
            if action == 'reload_schedule':
                retrieve_schedule()
            elif action == 'set_exhibit' and target is not None:
                print("Changing exhibit to:", target)
                read_exhibit_configuration(target, updateDefault=True)

                # Update the components that the configuration has changed
                for component in componentList:
                    component.update_configuration()
            else:
                command_all_exhibit_components(action)
                #print(f"DEBUG: Event executed: {nextEvent['action']} -- THIS EVENT WAS NOT RUN")
            queue_next_on_off_event()

    # Check for server reboot time
    if serverRebootTime is not None:
        if datetime.datetime.now() > serverRebootTime:
            rebooting = True
            _thread.interrupt_main()

def retrieve_schedule():

    """Build a schedule for the next seven days based on the available schedule files"""

    global scheduleList
    global scheduleUpdateTime

    with scheduleLock:
        scheduleUpdateTime = (datetime.datetime.now() - datetime.datetime.utcfromtimestamp(0)).total_seconds()
        scheduleList = [] # Each entry is a dict for a day, in calendar order

        today = datetime.datetime.today().date()
        upcoming_days = [today + datetime.timedelta(days=x) for x in range(21)]

        for day in upcoming_days:
            day_dict = {}
            day_dict["date"] = day.isoformat()
            day_dict["dayName"] = day.strftime("%A")
            day_dict["source"] = "none"
            reload_datetime = datetime.datetime.combine(day, datetime.time(0,1))
            # We want to make sure to reload the schedule at least once per day
            day_schedule = [[reload_datetime,
                            reload_datetime.strftime("%-I:%M %p"),
                            ["reload_schedule"]]]

            date_specific_filename = day.isoformat() + ".ini" # e.g., 2021-04-14.ini
            day_specific_filename = day.strftime("%A").lower() + ".ini" # e.g., monday.ini

            root = os.path.dirname(os.path.abspath(__file__))
            sources_to_try = [date_specific_filename, day_specific_filename, 'default.ini']
            source_dir = os.listdir(os.path.join(root, "schedules"))
            schedule_to_read = None

            for source in sources_to_try:
                if source in source_dir:
                    schedule_to_read = os.path.join(root, "schedules", source)
                    if source == date_specific_filename:
                        day_dict["source"] = 'date-specific'
                    elif source == day_specific_filename:
                        day_dict["source"] = 'day-specific'
                    elif source == "default.ini":
                        day_dict["source"] = 'default'
                    break

            if schedule_to_read is not None:
                parser = configparser.ConfigParser(delimiters=("="))
                try:
                    parser.read(schedule_to_read)
                except configparser.DuplicateOptionError:
                    print("Error: Schedule cannot contain two actions with identical times!")
                if "SCHEDULE" in parser:
                    sched = parser["SCHEDULE"]
                    for key in sched:
                        time_ = dateutil.parser.parse(key).time()
                        event_time = datetime.datetime.combine(day, time_)
                        action = [s.strip() for s in sched[key].split(",")]
                        day_schedule.append([event_time, event_time.strftime("%-I:%M %p"), action])
                else:
                    print("retrieve_schedule: error: no INI section 'SCHEDULE' found!")
            day_dict["schedule"] = sorted(day_schedule)
            scheduleList.append(day_dict)
    queue_next_on_off_event()

def queue_next_on_off_event():

    """Consult schedule_dict and set the next datetime that we should send an on or off command"""

    now = datetime.datetime.now() # Right now
    next_event_datetime = None
    next_action = None

    for day in scheduleList:
        sched = day["schedule"]
        for item in sched:
            if item[0] > now:
                next_event_datetime = item[0]
                next_action = item[2]
                break
        if next_event_datetime is not None:
            break

    if next_event_datetime is not None:
        nextEvent["date"] = next_event_datetime
        nextEvent["time"] = next_event_datetime.strftime("%-I:%M %p")
        nextEvent["action"] = next_action
        print(f"New event queued: {next_action}, {next_event_datetime}")
    else:
        print("No events to queue right now")

def check_available_exhibits():

    """Get a list of available "*.exhibit" configuration files"""

    global EXHIBIT_LIST

    EXHIBIT_LIST = []
    exhibits_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exhibits")

    with exhibitsLock:
        for file in os.listdir(exhibits_path):
            if file.lower().endswith(".exhibit"):
                EXHIBIT_LIST.append(file)

def create_new_exhibit(name, clone):

    """Createa new exhibit file

    Set clone=None to create a new file, or set it equal to the name of an
    existing exhibit to clone that exhibit."""

    # Make sure we have the proper extension
    if not name.lower().endswith(".exhibit"):
        name += ".exhibit"

    root = os.path.dirname(os.path.abspath(__file__))
    new_file = os.path.join(root, "exhibits", name)

    if clone is not None:
        # Copy an existing file

        # Make sure we have the proper extension on the file we're copying from
        if not clone.lower().endswith(".exhibit"):
            clone += ".exhibit"
        existing_file = os.path.join(root, "exhibits", clone)
        shutil.copyfile(existing_file, new_file)

    else:
        # Make a new file
        with exhibitsLock:
            if not os.path.isfile(new_file):
                # If this file does not exist, touch it so that it does.
                with open(new_file, "w", encoding='UTF-8'):
                    pass

    check_available_exhibits()

def delete_exhibit(name):

    """Delete the specified exhibit file"""

    # Make sure we have the proper extension
    if not name.lower().endswith(".exhibit"):
        name += ".exhibit"

    root = os.path.dirname(os.path.abspath(__file__))
    file_to_delete = os.path.join(root, "exhibits", name)

    with exhibitsLock:
        try:
            os.remove(file_to_delete)
        except FileNotFoundError:
            print(f"Error: Unable to delete exhibit {file_to_delete}. File not found!")

    check_available_exhibits()

def load_default_configuration():

    """Read the current exhibit configuration from file and initialize it in self.currentExhibitConfiguration"""

    global server_port
    global ip_address
    global gallery_name
    global assignable_staff
    global projectorList
    global wakeOnLANList
    global componentDescriptions
    global serverRebootTime

    # First, retrieve the config filename that defines the desired exhibit
    config = configparser.ConfigParser(delimiters=("="))
    config.optionxform = str # Override default, which is case in-sensitive
    cEC_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "currentExhibitConfiguration.ini")
    with currentExhibitConfigurationLock:
        config.read(cEC_path)
    current = config["CURRENT"]
    server_port = current.getint("server_port", 8080)
    ip_address = current.get("server_ip_address", "localhost")
    gallery_name =  current.get("gallery_name", "Constellation")
    staff_string = current.get("assignable_staff", [])
    if len(staff_string) > 0:
        assignable_staff = [x.strip() for x in staff_string.split(",")]

    retrieve_schedule()

    projectorList = []

    # Load the component descriptions. Do this first so they are available when
    # creating the various components
    try:
        print("Reading component descriptions...", end="", flush=True)
        componentDescriptions = dict(config["COMPONENT_DESCRIPTIONS"])
        print(" done")
    except KeyError:
        print("None found")
        componentDescriptions = {}

    # Parse list of PJLink projectors
    try:
        pjlink_projectors = config["PJLINK_PROJECTORS"]
        print("Connecting to PJLink projectors...", end="\r", flush=True)
    except KeyError:
        print("No PJLink projectors specified")
        pjlink_projectors = []

    n_proj = len(pjlink_projectors)
    cur_proj = 0
    for key in pjlink_projectors:
        cur_proj += 1
        print(f"Connecting to PJLink projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, passwprd"
            split = pjlink_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a password
                ip = split[0].strip()
                password = split[1].strip()
                if password == "":
                    password = None
                new_proj = Projector(key, ip, "pjlink", password=password)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = Projector(key, pjlink_projectors[key], "pjlink")
            else:
                print("Invalid PJLink projector entry:", pjlink_projectors[key])
                break
            projectorList.append(new_proj)
    print("Connecting to PJLink projectors... done                      ")

    # Parse list of serial proejctors
    try:
        serial_projectors = config["SERIAL_PROJECTORS"]
        print("Connecting to serial projectors...", end="\r", flush=True)
    except KeyError:
        print("No serial projectors specified")
        serial_projectors = []

    n_proj = len(serial_projectors)
    cur_proj = 0
    for key in serial_projectors:
        cur_proj += 1
        print(f"Connecting to serial projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, passwprd"
            split = serial_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a make
                ip = split[0].strip()
                make = split[1].strip()
                if make == "":
                    make = None
                new_proj = Projector(key, ip, "serial", make=make)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = Projector(key, serial_projectors[key], "serial")
            else:
                print("Invalid serial projector entry:", serial_projectors[key])
                break
            projectorList.append(new_proj)
    print("Connecting to serial projectors... done                      ")

    # Parse list of Wake on LAN devices
    try:
        wol = config["WAKE_ON_LAN"]
        print("Collecting Wake on LAN devices...", end="", flush=True)

        for key in wol:
            if get_exhibit_component(key) is None:
                # If get_exhibit_component is not None, this key corresponds
                # to a WoL device with a matching exhibit component ID and
                # we have already loaded that component from the pickle file
                value_split = wol[key].split(",")
                if len(value_split) == 2:
                    # We have been given a MAC address and IP address
                    device = WakeOnLANDevice(key,
                                             value_split[0].strip(),
                                             ip_address=value_split[1].strip())
                elif len(value_split) == 1:
                    # We have been given only a MAC address
                    device = WakeOnLANDevice(key, value_split[0].strip())
                else:
                    print(f"Wake on LAN device specified with unknown format: {wol[key]}")
                    continue
                wakeOnLANList.append(device)
        print(" done")
    except KeyError:
        print("No wake on LAN devices specified")
        wakeOnLANList = []

    # Build any existing issues
    try:
        root = os.path.dirname(os.path.abspath(__file__))
        issue_file = os.path.join(root, "issues", "issues.json")
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)
        print("Reading stored issues...", end="", flush=True)

        for issue in issues:
            new_issue = Issue(issue)
            issueList.append(new_issue)
        print(" done")
    except FileNotFoundError:
        print("No stored issues to read")

    # Parse list of static components
    try:
        static_components = config["STATIC_COMPONENTS"]
        print("Adding static components... ", end="\r", flush=True)
        for this_type in static_components:
            split = static_components[this_type].split(",")
            for this_id in split:
                add_exhibit_component(this_id.strip(), this_type, category="static")
        print("done")
    except KeyError:
        print("none specified")

    # Parse the reboot_time if necessary
    if "reboot_time" in current:
        reboot_time = dateutil.parser.parse(current["reboot_time"])
        if reboot_time < datetime.datetime.now():
            reboot_time += datetime.timedelta(days=1)
        serverRebootTime = reboot_time
        print("Server will reboot at:", serverRebootTime.isoformat())

    # Then, load the configuration for that exhibit
    read_exhibit_configuration(current["current_exhibit"])

    # Update the components that the configuration has changed
    for component in componentList:
        component.update_configuration()

def read_exhibit_configuration(name, updateDefault=False):

    global currentExhibitConfiguration
    global currentExhibit

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
        print(f"Error: exhibit definition with name {name} does not appear to be properly formatted. This file should be located in the exhibits directory.")
        with logLock:
            logging.error('Bad exhibit definition fileanme: %s', name)
        return

    currentExhibit = name
    currentExhibitConfiguration = configparser.ConfigParser()
    exhibit_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exhibits")
    currentExhibitConfiguration.read(exhibit_path)

    if updateDefault:
        config = configparser.ConfigParser(delimiters=("="))
        config.optionxform = str # Override default, which is case in-sensitive
        cEC_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                'currentExhibitConfiguration.ini')
        with currentExhibitConfigurationLock:
            config.read(cEC_path)
            config.set("CURRENT", "current_exhibit", name)
            with open(cEC_path, "w", encoding="UTF-8") as f:
                config.write(f)

def get_exhibit_component(this_id):

    """Return a component with the given id, or None if no such component exists"""

    return next((x for x in componentList if x.id == this_id), None)

def get_issue(this_id):

    """Return an Issue with the given id, or None if no such Issue exists"""

    return next((x for x in issueList if x.details["id"] == this_id), None)

def remove_issue(this_id):

    """Remove an Issue with the given id from the issueList"""

    global issueList

    with issueLock:
        issueList = [x for x in issueList if x.details["id"] != this_id]

def edit_issue(details):

    """Edit issue with the id given in details dict"""
    if "id" in details:
        issue = get_issue(details["id"])
        with issueLock:
            issue.details["priority"] = details.get("priority", issue.details["priority"])
            issue.details["issueName"] = details.get("issueName", issue.details["issueName"])
            issue.details["issueDescription"] = details.get("issueDescription",
                                                            issue.details["issueDescription"])
            issue.details["relatedComponentIDs"] = details.get("relatedComponentIDs",
                                                               issue.details["relatedComponentIDs"])
            issue.details["assignedTo"] = details.get("assignedTo",
                                                      issue.details["assignedTo"])
            issue.details["lastUpdateDate"] = datetime.datetime.now().isoformat()

def save_issueList():

    """Write the current issueList to file"""

    root = os.path.dirname(os.path.abspath(__file__))
    issue_file = os.path.join(root, "issues", "issues.json")

    with open(issue_file, "w", encoding="UTF-8") as file_object:
        json.dump([x.details for x in issueList], file_object)

def get_projector(this_id):

    """Return a projector with the given id, or None if no such component exists"""

    return next((x for x in projectorList if x.id == this_id), None)

def get_wake_on_LAN_component(this_id):

    """Return a WakeOnLan device with the given id, or None if no such component exists"""

    return next((x for x in wakeOnLANList if x.id == this_id), None)

def add_exhibit_component(this_id, this_type, category="dynamic"):

    """Create a new ExhibitComponent, add it to the componentList, and return it"""

    component = ExhibitComponent(this_id, this_type, category)
    componentList.append(component)

    return component

def command_all_exhibit_components(cmd):

    """Queue a command for every exhibit component"""

    print("Sending command to all components:", cmd)
    with logLock:
        logging.info("command_all_exhibit_components: %s", cmd)

    for component in componentList:
        component.queue_command(cmd)

    for projector in projectorList:
        projector.queue_command(cmd)

def update_exhibit_component_status(data, ip):

    """Update an ExhibitComponent with the values in a dictionary."""

    this_id = data["id"]
    this_type = data["type"]

    component = get_exhibit_component(this_id)
    if component is None: # This is a new id, so make the component
        component = add_exhibit_component(this_id, this_type)

    component.ip = ip
    if "helperPort" in data:
        component.helperPort = data["helperPort"]
    if "helperAddress" in data:
        component.helperAddress = data["helperAddress"]
    component.update_last_contact_datetime()
    if "AnyDeskID" in data:
        component.config["AnyDeskID"] = data["AnyDeskID"]
    if "currentInteraction" in data:
        if data["currentInteraction"].lower() == "true":
            component.update_last_interaction_datetime()
    if "allowed_actions" in data:
        allowed_actions = data["allowed_actions"]
        for key in allowed_actions:
            if allowed_actions[key].lower() in ["true", "yes", "1"]:
                if key not in component.config["allowed_actions"]:
                    component.config["allowed_actions"].append(key)
            else:
                component.config["allowed_actions"] = [x for x in component.config["allowed_actions"] if x != key]
    if "error" in data:
        component.config["error"] = data["error"]
    else:
        if "error" in component.config:
            component.config.pop("error")

def check_file_structure():

    """Check to make sure we have the appropriate file structure set up"""

    root = os.path.dirname(os.path.abspath(__file__))
    schedules_dir = os.path.join(root, "schedules")
    exhibits_dir = os.path.join(root, "exhibits")
    analytics_dir = os.path.join(root, "analytics")
    issues_dir = os.path.join(root, "issues")
    maintenance_dir = os.path.join(root, "maintenance-logs")

    try:
        os.listdir(schedules_dir)
    except FileNotFoundError:
        print("Missing schedules directory. Creating now...")
        try:
            os.mkdir(schedules_dir)
            default_schedule_list = ["monday.ini", "tuesday.ini",
                                     "wednesday.ini", "thursday.ini",
                                     "friday.ini", "saturday.ini",
                                     "sunday.ini"]

            for file in default_schedule_list:
                with open(os.path.join(schedules_dir, file), 'w', encoding="UTF-8") as f:
                    f.write("[SCHEDULE]\n")
        except PermissionError:
            print("Error: unable to create 'schedules' directory. Do you have write permission?")

    try:
        os.listdir(analytics_dir)
    except FileNotFoundError:
        print("Missing analytics directory. Creating now...")
        try:
            os.mkdir(analytics_dir)
        except PermissionError:
            print("Error: unable to create 'analytics' directory. Do you have write permission?")

    try:
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            with open(os.path.join(exhibits_dir, "default.exhibit"), 'w', encoding="UTF-8") as f:
                f.write("")
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    try:
        os.listdir(issues_dir)
    except FileNotFoundError:
        print("Missing issues directory. Creating now...")
        try:
            os.mkdir(issues_dir)
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    try:
        os.listdir(maintenance_dir)
    except FileNotFoundError:
        print("Missing maintenance-logs directory. Creating now...")
        try:
            os.mkdir(maintenance_dir)
        except PermissionError:
            print("Error: unable to create 'maintenance-logs' directory. Do you have write permission?")

def quit_handler(*args):

    """Handle cleanly shutting down the server"""

    if rebooting is True:
        print("\nRebooting server...")
        exit_code = 1
    else:
        print('\nKeyboard interrupt detected. Cleaning up and shutting down...')
        exit_code = 0

    # Save the current component lists to a pickle file so that
    # we can resume from the current state
    state_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                              "current_state.dat")
    with open(state_path, 'wb') as f:
        pickle.dump(componentList, f)
        # a = pickle.dumps(componentList)

    #print("Exit1")
    for key in pollingThreadDict:
        pollingThreadDict[key].cancel()
    #print("Exit2")
    with logLock:
        logging.info("Server shutdown")
    #print("Exit3")
    with currentExhibitConfigurationLock:
        #print("Exit4")
        with scheduleLock:
            #print("Exit5")
            with trackingDataWriteLock:
                sys.exit(exit_code)

def error_handler(*exc_info):

    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with logLock:
        logging.error(f'"{text}"')
    print(f"Error: see control_server.log for more details ({datetime.datetime.now()})")

def check_for_software_update():

    """Download the version.txt file from Github and check if there is an update"""

    global software_update_available

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen("https://raw.githubusercontent.com/FWMSH/Constellation/main/control_server/version.txt"):
            if float(line.decode('utf-8')) > SOFTWARE_VERSION:
                software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    if software_update_available:
        print("update available!")
    else:
        print("the server is up to date.")

server_port = 8080 # Default; should be set in currentExhibitConfiguration.ini
ip_address = "localhost" # Default; should be set in currentExhibitConfiguration.ini
ADDR = "" # Accept connections from all interfaces
gallery_name = ""
SOFTWARE_VERSION = 1.0
software_update_available = False

componentList = []
projectorList = []
wakeOnLANList = []
synchronizationList = [] # Holds sets of displays that are being synchronized
componentDescriptions = {} # Holds optional short descriptions of each component
issueList = []

currentExhibit = None # The INI file defining the current exhibit "name.exhibit"
EXHIBIT_LIST = []
currentExhibitConfiguration = None # the configParser object holding the current config
assignable_staff = [] # staff to whom issues can be assigned.

nextEvent = {} # Will hold the datetime and action of the upcoming event
scheduleList = [] # Will hold a list of scheduled actions in the next week
scheduleUpdateTime = 0
serverRebootTime = None
rebooting = False # This will be set to True from a background thread when it is time to reboot

# threading resources
pollingThreadDict = {} # Holds references to the threads starting by various polling procedures
logLock = threading.Lock()
currentExhibitConfigurationLock = threading.Lock()
trackingDataWriteLock = threading.Lock()
scheduleLock = threading.Lock()
issueLock = threading.Lock()
exhibitsLock = threading.Lock()
maintenanceLock = threading.Lock()

# Set up log file
log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
signal.signal(signal.SIGINT, quit_handler)
sys.excepthook = error_handler

# Dictionary to keep track of warnings we have already presented
serverWarningDict = {}

with logLock:
    logging.info("Server started")

# Try to reload the previous state from the pickle file current_state.dat
try:
    state_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "current_state.dat")
    with open(state_path, "rb") as previous_state:
        componentList = pickle.load(previous_state)
        print("Previous server state loaded")
except (FileNotFoundError, EOFError):
    print("Could not load previous server state")

check_file_structure()
check_available_exhibits()
load_default_configuration()
poll_event_schedule()
poll_projectors()
poll_wake_on_LAN_devices()
check_for_software_update()


httpd = ThreadedHTTPServer((ADDR, server_port), RequestHandler)
httpd.serve_forever()
