# Constellation Control Server
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Fort Worth Museum of Science and History
# Released under the MIT license

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
import pickle
import urllib.request
import time
import re

# Non-standard modules
import dateutil.parser

# Constellation modules
import config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_maintenance as c_maint
import constellation_schedule as c_sched
import constellation_tracker as c_track
import projector_control


class Projector:
    """Holds basic data about a projector"""

    def __init__(self, id_, ip, connection_type, mac_address=None, make=None, password=None):

        self.id = id_
        self.ip = ip  # IP address of the projector
        self.password = password  # Password to access PJLink
        self.mac_address = mac_address  # For use with Wake on LAN
        self.connection_type = connection_type
        self.make = make
        self.config = {"allowed_actions": ["power_on", "power_off"],
                       "description": config.componentDescriptions.get(id_, "")}

        self.state = {"status": "OFFLINE"}
        self.last_contact_datetime = datetime.datetime(2020, 1, 1)

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


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Stub which triggers dispatch of requests into individual threads."""

    daemon_threads = True


class RequestHandler(SimpleHTTPRequestHandler):
    """Handle incoming requests to the control server"""

    def send_current_configuration(self, id_):

        """Function to respond to a POST with a dictionary defining the current exhibit configuration"""

        json_string = json.dumps(c_exhibit.get_exhibit_component(id_).config)
        if len(c_exhibit.get_exhibit_component(id_).config["commands"]) > 0:
            # Clear the command list now that we have sent
            c_exhibit.get_exhibit_component(id_).config["commands"] = []
        self.wfile.write(bytes(json_string, encoding="UTF-8"))

    def send_webpage_update(self):

        """Function to collect the current exhibit status, format it, and send it back to the web client to update the page"""

        component_dict_list = []
        for item in config.componentList:
            temp = {"id": item.id,
                    "type": item.type}
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
            component_dict_list.append(temp)

        for item in config.projectorList:
            temp = {"id": item.id,
                    "type": 'PROJECTOR',
                    "ip_address": item.ip}
            if "allowed_actions" in item.config:
                temp["allowed_actions"] = item.config["allowed_actions"]
            if "description" in item.config:
                temp["description"] = item.config["description"]
            temp["class"] = "exhibitComponent"
            temp["status"] = item.state["status"]
            component_dict_list.append(temp)

        for item in config.wakeOnLANList:
            temp = {"id": item.id,
                    "type": 'WAKE_ON_LAN',
                    "ip_address": item.ip}
            if "allowed_actions" in item.config:
                temp["allowed_actions"] = item.config["allowed_actions"]
            if "description" in item.config:
                temp["description"] = item.config["description"]
            temp["class"] = "exhibitComponent"
            temp["status"] = item.state["status"]
            component_dict_list.append(temp)

        # Also include an object with the status of the overall gallery
        temp = {"class": "gallery",
                "currentExhibit": config.currentExhibit,
                "availableExhibits": config.exhibit_list,
                "galleryName": gallery_name,
                "updateAvailable": str(software_update_available).lower()}
        component_dict_list.append(temp)

        # Also include an object containing the current issues
        temp = {"class": "issues",
                "issueList": [x.details for x in config.issueList],
                "lastUpdateDate": config.issueList_last_update_date,
                "assignable_staff": config.assignable_staff}
        component_dict_list.append(temp)

        # Also include an object containing the current schedule
        with config.scheduleLock:
            temp = {"class": "schedule",
                    "updateTime": config.scheduleUpdateTime,
                    "schedule": config.scheduleList,
                    "nextEvent": config.nextEvent}
            component_dict_list.append(temp)

        json_string = json.dumps(component_dict_list, default=str)

        self.wfile.write(bytes(json_string, encoding="UTF-8"))

    def log_request(self, code='-', size='-'):

        # Override to suppress the automatic logging

        pass

    def copy_byte_range(self, infile, start=None, stop=None, bufsize=16 * 1024):
        """Like shutil.copyfileobj, but only copy a range of the streams.
        Both start and stop are inclusive.
        """

        if start is not None:
            infile.seek(start)
        while 1:
            to_read = min(bufsize, stop + 1 - infile.tell() if stop else bufsize)
            buf = infile.read(to_read)
            if not buf:
                break
            self.wfile.write(buf)

    def handle_range_request(self, f):

        """Handle a GET request using a byte range.

        Inspired by https://github.com/danvk/RangeHTTPServer
        """

        try:
            self.range = parse_byte_range(self.headers['Range'])
        except ValueError:
            self.send_error(400, 'Invalid byte range')
            return
        first, last = self.range

        fs = os.fstat(f.fileno())
        file_len = fs[6]
        if first >= file_len:
            self.send_error(416, 'Requested Range Not Satisfiable')
            return None

        ctype = self.guess_type(self.translate_path(self.path))

        if last is None or last >= file_len:
            last = file_len - 1
        response_length = last - first + 1
        try:
            self.send_response(206)
            self.send_header('Content-type', ctype)
            self.send_header('Accept-Ranges', 'bytes')
            self.send_header('Content-Range',
                             'bytes %s-%s/%s' % (first, last, file_len))
            self.send_header('Content-Length', str(response_length))
            self.send_header('Last-Modified', self.date_time_string(fs.st_mtime))
            self.end_headers()
            self.copy_byte_range(f)
        except IOError as e:
            print(e)

    def do_GET(self):

        # Receive a GET request and respond with a console webpage

        # print("+++++++++++++++")
        # print("BEGIN GET")
        print(f" Active threads: {threading.active_count()}       ", end="\r", flush=True)

        # print(f"  path = {self.path}")

        # Strip out any options from the query string
        self.path = self.path.split("?")[0]
        if self.path.lower().endswith("html") or self.path == "/":
            if self.path == "/":
                f = open(os.path.join(config.APP_PATH, "webpage.html"), "r", encoding='UTF-8')
            else:
                if self.path.startswith("/"):
                    self.path = self.path[1:]
                f = open(os.path.join(config.APP_PATH, self.path), "r", encoding='UTF-8')

            page = str(f.read())

            # Build the address that the webpage should contact to reach this server
            address_to_insert = "'http://" + str(ip_address) + ":" + str(server_port) + "'"
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
                with open(os.path.join(config.APP_PATH, self.path), 'rb') as f:
                    if "Range" in self.headers:
                        self.handle_range_request(f)
                    else:
                        try:
                            self.send_response(200)
                            self.send_header('Content-type', mimetype)
                            self.end_headers()
                            # print(f"    Writing data to client")
                            self.wfile.write(f.read())
                        except BrokenPipeError:
                            print("Connection closed prematurely")
                # print("END GET")
                # print("+++++++++++++++")
                return
            except IOError:
                self.send_error(404, f"File Not Found: {self.path}")
                with config.logLock:
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
            with config.logLock:
                logging.warning("POST received without content-type header")
            print(self.headers)
            return

        if ctype == "multipart/form-data":  # File upload
            try:
                pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
                content_len = int(self.headers.get('Content-length'))
                pdict['CONTENT-LENGTH'] = content_len
                fields = cgi.parse_multipart(self.rfile, pdict)
                file = fields.get('file')[0]

                action = fields.get("action")[0]
                if action == "uploadIssueMedia":
                    content_path = os.path.join(config.APP_PATH, "issues", "media")
                    _, extension = os.path.splitext(fields.get("filename")[0])
                    # Create a new filename so we never have collisions
                    new_filename = str(time.time()).replace(".", "") + extension
                    filepath = os.path.join(content_path, new_filename)
                    print(f"Saving uploaded file to {filepath}")
                    with config.issueMediaLock:
                        with open(filepath, "wb") as f:
                            f.write(file)
                else:
                    print("Unknown file upload action:", action)
                    return

                json_string = json.dumps({"success": True, "filename": new_filename})
            except:
                json_string = json.dumps({"success": False})

            try:
                self.wfile.write(bytes(json_string, encoding="UTF-8"))
            except BrokenPipeError:
                pass

        elif ctype == "application/json":
            # print("  application/json")

            # Unpack the data
            length = int(self.headers['Content-length'])
            data_str = self.rfile.read(length).decode("utf-8")

            try:  # JSON
                data = json.loads(data_str)
            except json.decoder.JSONDecodeError:  # not JSON
                data = {}
                split = data_str.split("&")
                for seg in split:
                    split2 = seg.split("=")
                    data[split2[0]] = split2[1]
            try:
                ping_class = data["class"]
            except KeyError:
                print("Error: ping received without class field")
                response = {"success": False,
                            "reason": "Request missing 'class' field."}
                self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                return

            # print(f"  class = {ping_class}")

            if ping_class == "webpage":
                try:
                    action = data["action"]
                except KeyError:
                    print("Error: webpage ping received without action field")
                    # print("END POST")
                    # print("===============")
                    response = {"success": True,
                                "reason": "Missing required field 'action'."}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                # print(f"    action = {action}")
                if action == "fetchUpdate":
                    self.send_webpage_update()
                elif action == "fetchProjectorUpdate":
                    if "id" not in data:
                        response = {"success": True,
                                    "reason": "Missing required field 'id'."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    proj = get_projector(data["id"])
                    if proj is not None:
                        json_string = json.dumps(proj.state)
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    else:
                        json_string = json.dumps({"status": "DELETE"})
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "reloadConfiguration":
                    load_default_configuration()

                    json_string = json.dumps({"result": "success", "success": True})
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "queueCommand":
                    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "queueProjectorCommand":
                    get_projector(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "queueWOLCommand":
                    c_exhibit.get_wake_on_LAN_component(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
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

                        sched_dir = os.path.join(config.APP_PATH, "schedules")
                        path = os.path.join(sched_dir, data["name"] + ".ini")
                        time_to_set = dateutil.parser.parse(data['timeToSet']).time()

                        if data["isAddition"]:
                            # Check if this time already exists
                            error = c_sched.check_if_schedule_time_exists(path, time_to_set)

                            if not error:
                                with config.scheduleLock:
                                    with open(path, 'a', encoding="UTF-8") as f:
                                        f.write(line_to_set)
                            else:
                                error_message = "An action with this time already exists"
                        elif "timeToReplace" in data:
                            output_text = ""
                            time_to_replace = dateutil.parser.parse(data['timeToReplace']).time()
                            print("replacing schedule",
                                  time_to_replace, time_to_set,
                                  c_sched.check_if_schedule_time_exists(path, time_to_set))

                            # We need to make sure we are not editing this entry to have
                            # the same time as another entry

                            if time_to_set == time_to_replace:
                                okay_to_edit = True
                            else:
                                okay_to_edit = not c_sched.check_if_schedule_time_exists(path, time_to_set)

                            if okay_to_edit:
                                with config.scheduleLock:
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
                        c_sched.retrieve_schedule()

                        # Send the updated schedule back
                        with config.scheduleLock:
                            response_dict["class"] = "schedule"
                            response_dict["updateTime"] = config.scheduleUpdateTime
                            response_dict["schedule"] = config.scheduleList
                            response_dict["nextEvent"] = config.nextEvent
                            response_dict["success"] = True
                    else:
                        response_dict["success"] = False
                        response_dict["reason"] = error_message
                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))

                elif action == 'refreshSchedule':
                    # This command reloads the schedule from disk. Normal schedule
                    # changes are passed during fetchUpdate
                    c_sched.retrieve_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.scheduleList,
                                         "nextEvent": config.nextEvent}

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "convertSchedule":
                    if "date" not in data or "from" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'date' or 'from' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return

                    sched_dir = os.path.join(config.APP_PATH, "schedules")
                    with config.scheduleLock:
                        shutil.copy(os.path.join(sched_dir, data["from"].lower() + ".ini"),
                                    os.path.join(sched_dir, data["date"] + ".ini"))

                    # Reload the schedule from disk
                    c_sched.retrieve_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.scheduleList,
                                         "nextEvent": config.nextEvent}

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "deleteSchedule":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    with config.scheduleLock:
                        sched_dir = os.path.join(config.APP_PATH, "schedules")
                        os.remove(os.path.join(sched_dir, data["name"] + ".ini"))

                    # Reload the schedule from disk
                    c_sched.retrieve_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.scheduleList,
                                         "nextEvent": config.nextEvent}

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "deleteScheduleAction":
                    if "from" not in data or "time" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'from' or 'time' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return

                    c_sched.delete_schedule_action(data["from"], data["time"])
                    c_sched.retrieve_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.scheduleList,
                                         "nextEvent": config.nextEvent}

                    json_string = json.dumps(response_dict, default=str)
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                elif action == "setExhibit":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    print("Changing exhibit to:", data["name"])
                    c_exhibit.read_exhibit_configuration(data["name"], updateDefault=True)

                    # Update the components that the configuration has changed
                    for component in config.componentList:
                        component.update_configuration()
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "createExhibit":
                    if "name" not in data or data["name"] == "":
                        response = {"success": False,
                                    "reason": "Request missing 'name' field or name is blank."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    clone = None
                    if "cloneFrom" in data and data["cloneFrom"] != "":
                        clone = data["cloneFrom"]
                    c_exhibit.create_new_exhibit(data["name"], clone)
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "deleteExhibit":
                    if "name" not in data or data["name"] == "":
                        response = {"success": False,
                                    "reason": "Request missing 'name' field or name is empty."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    c_exhibit.delete_exhibit(data["name"])
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "setComponentContent":
                    if "id" not in data or "content" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' or 'content' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    print(f"Changing content for {data['id']}:", data['content'])
                    c_exhibit.set_component_content(data['id'], data['content'])
                    response = {"success": True, "reason": ""}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "getHelpText":
                    try:
                        readme_path = os.path.join(config.APP_PATH,
                                                   "README.md")
                        with open(readme_path, 'r', encoding='UTF-8') as f:
                            text = f.read()
                            self.wfile.write(bytes(text, encoding="UTF-8"))
                    except FileNotFoundError:
                        with config.logLock:
                            logging.error("Unable to read README.md")
                elif action == "createIssue":
                    if "details" in data:
                        with config.issueLock:
                            new_issue = c_issues.Issue(data["details"])
                            config.issueList.append(new_issue)
                            c_issues.save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {"success": False,
                                         "reason": "Must include field 'details'"}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "editIssue":
                    if "details" in data and "id" in data["details"]:
                        c_issues.edit_issue(data["details"])
                        c_issues.save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {
                            "success": False,
                            "reason": "Must include field 'details' with property 'id'"
                        }
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "deleteIssue":
                    if "id" in data:
                        c_issues.remove_issue(data["id"])
                        c_issues.save_issueList()
                        response_dict = {"success": True, "reason": ""}
                    else:
                        response_dict = {"success": False, "reason": "Must include field 'id'"}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "getIssueList":
                    response = {
                        "success": True,
                        "issueList": [x.details for x in config.issueList]
                    }
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "issueMediaDelete":
                    if "filename" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'filename' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    this_id = None
                    if "id" in data:
                        this_id = data["id"]
                    c_issues.delete_issue_media_file(data["filename"], this_id)
                    response = {"success": True}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == 'updateMaintenanceStatus':
                    if "id" not in data or "status" not in data or "notes" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id', 'status', or 'notes' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    file_path = os.path.join(config.APP_PATH, "maintenance-logs", data["id"] + ".txt")
                    record = {"id": data["id"],
                              "date": datetime.datetime.now().isoformat(),
                              "status": data['status'],
                              "notes": data["notes"]}
                    with config.maintenanceLock:
                        try:
                            with open(file_path, 'a', encoding='UTF-8') as f:
                                f.write(json.dumps(record) + "\n")
                            success = True
                            reason = ""
                        except FileNotFoundError:
                            success = False
                            reason = f"File path {file_path} does not exist"
                        except PermissionError:
                            success = False
                            reason = f"You do not have write permission for the file {file_path}"
                    response_dict = {"success": success, "reason": reason}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == 'deleteMaintenanceRecord':
                    if "id" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    else:
                        file_path = os.path.join(config.APP_PATH,
                                                 "maintenance-logs", data["id"] + ".txt")
                        with config.maintenanceLock:
                            try:
                                os.remove(file_path)
                                response = {"success": True}
                                self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                                return
                            except FileNotFoundError:
                                response = {"success": False,
                                            "reason": f"Record {data['id']}.txt does not exist"}
                                self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                                return
                elif action == 'getMaintenanceStatus':
                    if "id" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    file_path = os.path.join(config.APP_PATH,
                                             "maintenance-logs", data["id"] + ".txt")
                    with config.maintenanceLock:
                        response_dict = c_maint.get_maintenance_report(file_path)
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                elif action == "getAllMaintenanceStatuses":
                    record_list = []
                    maintenance_path = os.path.join(config.APP_PATH,
                                                    "maintenance-logs")
                    for file in os.listdir(maintenance_path):
                        if file.lower().endswith(".txt"):
                            with config.maintenanceLock:
                                file_path = os.path.join(maintenance_path, file)
                                record_list.append(c_maint.get_maintenance_report(file_path))
                    response_dict = {"success": True,
                                     "records": record_list}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                else:
                    print(f"Error: Unknown webpage command received: {action}")
                    with config.logLock:
                        logging.error(f"Unknown webpage command received: {action}")

            elif ping_class == "exhibitComponent":
                if "action" in data:  # not a ping
                    action = data["action"]
                    # if "id" in data:
                    #     print(f"    id = {data['id']}")
                    # print(f"    action = {action}")
                    if action == "getUploadedFile":
                        if "id" not in data:
                            response = {"success": False,
                                        "reason": "Request missing 'id' field."}
                            self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                            return
                        component = c_exhibit.get_exhibit_component(data["id"])
                        if len(component.dataToUpload) > 0:
                            upload = component.dataToUpload.pop(0)
                            # json_string = json.dumps(upload)
                            # self.wfile.write(bytes(json_string, encoding="UTF-8"))
                            self.wfile.write(upload)
                    elif action == "beginSynchronization":
                        if "synchronizeWith" in data:
                            c_exhibit.update_synchronization_list(data["id"], data["synchronizeWith"])
                else:  # it's a ping
                    try:
                        id = data["id"]
                        # type = data["type"]
                        if id == "UNKNOWN":
                            print(f"Warning: exhibitComponent ping with id=UNKNOWN coming from {self.address_string()}")
                            self.wfile.write(bytes(json.dumps({}), encoding='UTF-8'))
                            # print("END POST")
                            # print("===============")
                            return
                    except KeyError:
                        print("Error: exhibitComponent ping received without id or type field")
                        # print("END POST")
                        # print("===============")
                        return  # No id or type, so bail out

                    # print(f"    id = {id}")
                    # print("    action = ping")

                    c_exhibit.update_exhibit_component_status(data, self.address_string())
                    self.send_current_configuration(id)
            elif ping_class == "tracker":
                if "action" not in data:
                    response = {"success": False,
                                "reason": "Request missing 'action' field."}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                action = data["action"]

                if action == "getLayoutDefinition":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")

                    layout_definition, success, reason = c_track.get_layout_definition(data["name"] + ".ini",
                                                                                       kind=kind)

                    response = {"success": success,
                                "reason": reason,
                                "layout": layout_definition}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "submitData":
                    if "data" not in data or "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'data' or 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    file_path = os.path.join(config.APP_PATH, kind, "data", data["name"] + ".txt")
                    success, reason = c_track.write_JSON(data["data"], file_path)
                    response = {"success": success, "reason": reason}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "submitRawText":
                    if "text" not in data or "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'text' or 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    success, reason = c_track.write_raw_text(data["text"], data["name"] + ".txt", kind)
                    response = {"success": success, "reason": reason}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "retrieveRawText":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    result, success, reason = c_track.get_raw_text(data["name"] + ".txt", kind)
                    response = {"success": success, "reason": reason, "text": result}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "submitAnalytics":
                    if "data" not in data or 'name' not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'data' or 'name' field."}
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    file_path = os.path.join(config.APP_PATH, "analytics", data["name"] + ".txt")
                    success, reason = c_track.write_JSON(data["data"], file_path)
                    response = {"success": success, "reason": reason}
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "getAvailableDefinitions":
                    kind = data.get("kind", "flexible-tracker")
                    definition_list = []
                    template_path = os.path.join(config.APP_PATH, kind, "templates")
                    for file in os.listdir(template_path):
                        if file.lower().endswith(".ini"):
                            definition_list.append(file)

                    self.wfile.write(bytes(json.dumps(definition_list), encoding="UTF-8"))
                elif action == "checkConnection":
                    self.wfile.write(bytes(json.dumps({"success": True}), encoding="UTF-8"))
            else:
                print(f"Error: ping with unknown class '{ping_class}' received")
                response = {"success": False,
                            "reason": f"Unknown class {ping_class}"}
                self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                # print("END POST")
                # print("===============")
                return
        # print("END POST")
        # print("===============")


def parse_byte_range(byte_range):
    """Returns the two numbers in 'bytes=123-456' or throws ValueError.
    The last number or both numbers may be None.
    """

    BYTE_RANGE_RE = re.compile(r'bytes=(\d+)-(\d+)?$')
    if byte_range.strip() == '':
        return None, None

    m = BYTE_RANGE_RE.match(byte_range)
    if not m:
        raise ValueError(f'Invalid byte range {byte_range}')

    first, last = [x and int(x) for x in m.groups()]
    if last and last < first:
        raise ValueError(f'Invalid byte range {byte_range}')
    return first, last


def poll_projectors():
    """Ask each projector to send a status update at an interval.
    """

    for projector in config.projectorList:
        new_thread = threading.Thread(target=projector.update)
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    config.polling_thread_dict["poll_projectors"] = threading.Timer(30, poll_projectors)
    config.polling_thread_dict["poll_projectors"].start()


def load_default_configuration():
    """Read the current exhibit configuration from file and initialize it in self.currentExhibitConfiguration"""

    global server_port
    global ip_address
    global gallery_name

    # First, retrieve the config filename that defines the desired exhibit
    configReader = configparser.ConfigParser(delimiters=("="))
    configReader.optionxform = str  # Override default, which is case in-sensitive
    cEC_path = os.path.join(config.APP_PATH, "currentExhibitConfiguration.ini")
    with config.currentExhibitConfigurationLock:
        configReader.read(cEC_path)
    current = configReader["CURRENT"]
    server_port = current.getint("server_port", 8080)
    ip_address = current.get("server_ip_address", "localhost")
    gallery_name = current.get("gallery_name", "Constellation")
    staff_list = current.get("assignable_staff", [])
    if len(staff_list) > 0:
        config.assignable_staff = [x.strip() for x in staff_list.split(",")]

    c_sched.retrieve_schedule()

    config.projectorList = []

    # Load the component descriptions. Do this first, so they are available when
    # creating the various components
    try:
        print("Reading component descriptions...", end="", flush=True)
        config.componentDescriptions = dict(configReader["COMPONENT_DESCRIPTIONS"])
        print(" done")
    except KeyError:
        print("None found")
        config.componentDescriptions = {}

    # Parse list of PJLink projectors
    try:
        pjlink_projectors = configReader["PJLINK_PROJECTORS"]
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
            # we have the form "ip, password"
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
            config.projectorList.append(new_proj)
    print("Connecting to PJLink projectors... done                      ")

    # Parse list of serial projectors
    try:
        serial_projectors = configReader["SERIAL_PROJECTORS"]
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
            # we have the form "ip, password"
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
            config.projectorList.append(new_proj)
    print("Connecting to serial projectors... done                      ")

    # Parse list of Wake on LAN devices
    try:
        wol = configReader["WAKE_ON_LAN"]
        print("Collecting Wake on LAN devices...", end="", flush=True)

        for key in wol:
            if c_exhibit.get_exhibit_component(key) is None:
                # If 'get_exhibit_component' is not None, this key corresponds
                # to a WoL device with a matching exhibit component ID and
                # we have already loaded that component from the pickle file
                value_split = wol[key].split(",")
                if len(value_split) == 2:
                    # We have been given a MAC address and IP address
                    device = c_exhibit.WakeOnLANDevice(key,
                                             value_split[0].strip(),
                                             ip_address=value_split[1].strip())
                elif len(value_split) == 1:
                    # We have been given only a MAC address
                    device = c_exhibit.WakeOnLANDevice(key, value_split[0].strip())
                else:
                    print(f"Wake on LAN device specified with unknown format: {wol[key]}")
                    continue
                config.wakeOnLANList.append(device)
        print(" done")
    except KeyError:
        print("No wake on LAN devices specified")
        config.wakeOnLANList = []

    # Build any existing issues
    try:
        issue_file = os.path.join(config.APP_PATH, "issues", "issues.json")
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)
        print("Reading stored issues...", end="", flush=True)

        for issue in issues:
            new_issue = c_issues.Issue(issue)
            config.issueList.append(new_issue)
        print(" done")
    except FileNotFoundError:
        print("No stored issues to read")

    # Parse list of static components
    try:
        static_components = configReader["STATIC_COMPONENTS"]
        print("Adding static components... ", end="\r", flush=True)
        for this_type in static_components:
            split = static_components[this_type].split(",")
            for this_id in split:
                c_exhibit.add_exhibit_component(this_id.strip(), this_type, category="static")
        print("done")
    except KeyError:
        print("none specified")

    # Parse the reboot_time if necessary
    if "reboot_time" in current:
        reboot_time = dateutil.parser.parse(current["reboot_time"])
        if reboot_time < datetime.datetime.now():
            reboot_time += datetime.timedelta(days=1)
        config.serverRebootTime = reboot_time
        print("Server will reboot at:", config.serverRebootTime.isoformat())

    # Then, load the configuration for that exhibit
    c_exhibit.read_exhibit_configuration(current["current_exhibit"])

    # Update the components that the configuration has changed
    for component in config.componentList:
        component.update_configuration()


def get_projector(this_id):
    """Return a projector with the given id, or None if no such component exists"""

    return next((x for x in config.projectorList if x.id == this_id), None)


def check_file_structure():
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = os.path.join(config.APP_PATH, "schedules")
    exhibits_dir = os.path.join(config.APP_PATH, "exhibits")

    misc_dirs = {"analytics": os.path.join(config.APP_PATH, "analytics"),
                 "flexible-tracker": os.path.join(config.APP_PATH, "flexible-tracker"),
                 "flexible-tracker/data": os.path.join(config.APP_PATH, "flexible-tracker", "data"),
                 "flexible-tracker/templates": os.path.join(config.APP_PATH, "flexible-tracker", "templates"),
                 "flexible-voter": os.path.join(config.APP_PATH, "flexible-voter"),
                 "flexible-voter/data": os.path.join(config.APP_PATH, "flexible-voter", "data"),
                 "flexible-voter/templates": os.path.join(config.APP_PATH, "flexible-voter", "templates"),
                 "issues": os.path.join(config.APP_PATH, "issues"),
                 "issues/media": os.path.join(config.APP_PATH, "issues", "media"),
                 "maintenance-logs": os.path.join(config.APP_PATH, "maintenance-logs")}

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
        os.listdir(exhibits_dir)
    except FileNotFoundError:
        print("Missing exhibits directory. Creating now...")
        try:
            os.mkdir(exhibits_dir)
            with open(os.path.join(exhibits_dir, "default.exhibit"), 'w', encoding="UTF-8") as f:
                f.write("")
        except PermissionError:
            print("Error: unable to create 'exhibits' directory. Do you have write permission?")

    for key in misc_dirs:
        try:
            os.listdir(misc_dirs[key])
        except FileNotFoundError:
            print(f"Missing {key} directory. Creating now...")
            try:
                os.mkdir(misc_dirs[key])
            except PermissionError:
                print(f"Error: unable to create '{key}' directory. Do you have write permission?")


def quit_handler(*args):
    """Handle cleanly shutting down the server"""

    try:
        if config.rebooting is True:
            exit_code = 1
            print("\nRebooting server...")
        else:
            exit_code = 0
            print('\nKeyboard interrupt detected. Cleaning up and shutting down...')
    except RuntimeError:
        exit_code = 0

    # Save the current component lists to a pickle file so that
    # we can resume from the current state
    state_path = os.path.join(config.APP_PATH, "current_state.dat")
    with open(state_path, 'wb') as f:
        pickle.dump(config.componentList, f)

    for key in config.polling_thread_dict:
        config.polling_thread_dict[key].cancel()

    with config.logLock:
        logging.info("Server shutdown")

    with config.currentExhibitConfigurationLock:
        with config.scheduleLock:
            with config.trackingDataWriteLock:
                sys.exit(exit_code)


def error_handler(*exc_info):
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see control_server.log for more details ({datetime.datetime.now()})")


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    global software_update_available

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/FWMSH/Constellation/main/control_server/version.txt"):
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


# Check whether we have packaged with Pyinstaller and set teh appropriate root path.
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    config.APP_PATH = os.path.dirname(sys.executable)
else:
    config.APP_PATH = os.path.dirname(os.path.abspath(__file__))

server_port = 8080  # Default; should be set in currentExhibitConfiguration.ini
ip_address = "localhost"  # Default; should be set in currentExhibitConfiguration.ini
ADDR = ""  # Accept connections from all interfaces
gallery_name = ""
SOFTWARE_VERSION = 1.0
software_update_available = False

# Set up log file
log_path = os.path.join(config.APP_PATH, "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
signal.signal(signal.SIGINT, quit_handler)
sys.excepthook = error_handler

with config.logLock:
    logging.info("Server started")

# Try to reload the previous state from the pickle file current_state.dat
try:
    state_path = os.path.join(config.APP_PATH, "current_state.dat")
    with open(state_path, "rb") as previous_state:
        config.componentList = pickle.load(previous_state)
        print("Previous server state loaded")
except (FileNotFoundError, EOFError):
    print("Could not load previous server state")

check_file_structure()
c_exhibit.check_available_exhibits()
load_default_configuration()
c_sched.poll_event_schedule()
poll_projectors()
c_exhibit.poll_wake_on_LAN_devices()
# check_for_software_update()

httpd = ThreadedHTTPServer((ADDR, server_port), RequestHandler)
httpd.serve_forever()
