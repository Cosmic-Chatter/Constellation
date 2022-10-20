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
import socket
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
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tools as c_tools
import constellation_tracker as c_track


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Stub which triggers dispatch of requests into individual threads."""

    daemon_threads = True


class RequestHandler(SimpleHTTPRequestHandler):
    """Handle incoming requests to the control server"""

    def configure_response(self, response_code, content_type: str = ""):
        """Send the appropriate response headers"""

        # 200 = OK, 204 = No content, 206 = Range, 404 = Not found

        code_dict = {
            200: "OK",
            204: "No Content",
            206: "Partial Content",
            400: "Bad Request",
            404: "Not Found"
        }

        self.send_response(response_code, code_dict[response_code])
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        if content_type != "":
            self.send_header("Content-Type", content_type)
        self.end_headers()

    def send_current_configuration(self, id_):
        """Function to respond to a POST with a dictionary defining the current exhibit configuration"""

        json_string = json.dumps(c_exhibit.get_exhibit_component(id_).config)
        if len(c_exhibit.get_exhibit_component(id_).config["commands"]) > 0:
            # Clear the command list now that we have sent
            c_exhibit.get_exhibit_component(id_).config["commands"] = []
        self.configure_response(200, "application/json")
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
            temp["lastContactDateTime"] = item.last_contact_datetime
            temp["ip_address"] = item.ip
            temp["helperPort"] = item.helperPort
            temp["helperAddress"] = item.helperAddress
            temp["constellation_app_id"] = item.constellation_app_id
            temp["platform_details"] = item.platform_details
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
        c_sched.retrieve_json_schedule()
        with config.scheduleLock:
            temp = {"class": "schedule",
                    "updateTime": config.scheduleUpdateTime,
                    "schedule": config.json_schedule_list,
                    "nextEvent": config.json_next_event}
            component_dict_list.append(temp)

        json_string = json.dumps(component_dict_list, default=str)
        self.configure_response(200, "application/json")
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

        # print(f"  path = {self.path}")

        # Strip out any options from the query string
        self.path = self.path.split("?")[0]
        if self.path.lower().endswith("html") or self.path == "/":
            if self.path == "/":
                file_path = os.path.join(config.APP_PATH, "webpage.html")
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(config.EXEC_PATH, "webpage.html")
                f = open(file_path, "r", encoding='UTF-8')
            else:
                if self.path.startswith("/"):
                    self.path = self.path[1:]

                file_path = os.path.join(config.APP_PATH, self.path)
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(config.EXEC_PATH, self.path)
                f = open(file_path, "r", encoding='UTF-8')

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
                file_path = os.path.join(config.APP_PATH, self.path)
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(config.EXEC_PATH, self.path)
                with open(file_path, 'rb') as f:
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
        self.configure_response(200)

        # print("END OPTIONS")
        # print("---------------")

    def do_POST(self):

        """Receives pings from client devices and respond with any updated information"""

        # print("===============")
        # print("BEGIN POST")

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

            self.configure_response(200, "application/json")
            try:
                self.wfile.write(bytes(json_string, encoding="UTF-8"))
            except BrokenPipeError:
                pass
            return

        elif ctype == "application/json":
            # print("  application/json")

            # Unpack the data
            length = int(self.headers['Content-length'])
            data_str = self.rfile.read(length).decode("utf-8")

            try:  # JSON
                data: dict = json.loads(data_str)
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
                self.configure_response(200, "application/json")
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
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                # print(f"    action = {action}")
                if action == "fetchUpdate":
                    self.send_webpage_update()
                    return
                elif action == "fetchProjectorUpdate":
                    if "id" not in data:
                        response_dict = {"success": False,
                                         "reason": "Missing required field 'id'.",
                                         "status": None}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                        return
                    proj = c_proj.get_projector(data["id"])
                    if proj is not None:
                        response_dict = {"success": True,
                                         "state": proj.state}
                    else:
                        response_dict = {"success": False,
                                         "reason": f"Projector {data['id']} does not exist",
                                         "status": "DELETE"}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == "reloadConfiguration":
                    load_default_configuration()

                    json_string = json.dumps({"success": True})
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "getConfiguration":

                    config_reader = configparser.ConfigParser(delimiters="=")
                    config_reader.optionxform = str  # Override default, which is case in-sensitive
                    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
                    with config.galleryConfigurationLock:
                        config_reader.read(gal_path)

                    config_dict = {}
                    for section in config_reader.sections():
                        config_dict[section] = {}
                        for key, val in config_reader.items(section):
                            config_dict[section][key] = val

                    json_string = json.dumps({"success": True, "configuration": config_dict})
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "getConfigurationRawText":
                    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
                    with open(gal_path, 'r', encoding='UTF-8') as f:
                        text = f.read()

                    json_string = json.dumps({"success": True, "configuration": text})
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "updateConfigurationRawText":
                    if "configuration" not in data:
                        json_string = json.dumps({"success": False, "reason": "Missing required field 'configuration'"})
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                        return

                    response_dict = {"success": True}
                    config_reader = configparser.ConfigParser(delimiters="=")
                    config_reader.optionxform = str  # Override default, which is case in-sensitive
                    try:
                        # Try to parse the raw text to look for errors
                        config_reader.read_string((data["configuration"]))
                        config_reader.get("CURRENT", "server_ip_address")
                        config_reader.get("CURRENT", "server_port")
                        config_reader.get("CURRENT", "current_exhibit")
                        config_reader.get("CURRENT", "gallery_name")

                        gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
                        with open(gal_path, 'w', encoding='UTF-8') as f:
                            f.write(data["configuration"])
                    except configparser.MissingSectionHeaderError:
                        response_dict["success"] = False
                        response_dict["reason"] = "You must have at least a [CURRENT] section"
                    except configparser.ParsingError as e:
                        error = e.errors[0]
                        err_line = error[0]
                        err_msg = error[1].replace('\\n', '')
                        response_dict["success"] = False
                        response_dict["reason"] = f"Error in line {err_line}: {err_msg}"
                    except configparser.DuplicateOptionError as e:
                        response_dict["success"] = False
                        response_dict["reason"] = f"Section [{e.section}] has a repeated option: {e.option} (line {e.lineno})"
                    except configparser.NoSectionError:
                        response_dict["success"] = False
                        response_dict["reason"] = "You must have a [CURRENT] section"
                    except configparser.NoOptionError as e:
                        response_dict["success"] = False
                        response_dict["reason"] = f"You must have the {e.option} setting in the [{e.section}] section"
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == "queueCommand":
                    if "command" not in data or "id" not in data:
                        response_dict = {"success": False,
                                         "reason": "Missing required field 'id' or 'command'."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                        return
                    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                elif action == "queueProjectorCommand":
                    if "command" not in data or "id" not in data:
                        response_dict = {"success": False,
                                         "reason": "Missing required field 'id' or 'command'."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                        return
                    c_proj.get_projector(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "queueWOLCommand":
                    if "command" not in data or "id" not in data:
                        response_dict = {"success": False,
                                         "reason": "Missing required field 'id' or 'command'."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                        return
                    c_exhibit.get_wake_on_LAN_component(data["id"]).queue_command(data["command"])
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "updateSchedule":
                    # This command handles both adding a new scheduled action
                    # and editing an existing action

                    if "name" not in data or "timeToSet" not in data or "actionToSet" not in data or "targetToSet" not in data or "valueToSet" not in data or "isAddition" not in data or "scheduleID" not in data:
                        response_dict = {"success": False,
                                         "reason": "Missing one or more required keys"}
                        json_string = json.dumps(response_dict, default=str)
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                        return

                    # Make sure we were given a valid time to parse
                    try:
                        dateutil.parser.parse(data["timeToSet"])
                    except dateutil.parser._parser.ParserError:
                        response_dict = {"success": False,
                                         "reason": "Time not valid"}
                        json_string = json.dumps(response_dict, default=str)
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                        return

                    c_sched.update_json_schedule(data["name"]+".json", {data["scheduleID"]: {"time": data["timeToSet"], "action": data["actionToSet"], "target": data["targetToSet"], "value": data["valueToSet"]}})

                    error = False
                    error_message = ""

                    response_dict = {}
                    if not error:
                        # Reload the schedule from disk
                        c_sched.retrieve_json_schedule()

                        # Send the updated schedule back
                        with config.scheduleLock:
                            response_dict["class"] = "schedule"
                            response_dict["updateTime"] = config.scheduleUpdateTime
                            response_dict["schedule"] = config.json_schedule_list
                            response_dict["nextEvent"] = config.json_next_event
                            response_dict["success"] = True
                    else:
                        response_dict["success"] = False
                        response_dict["reason"] = error_message
                    json_string = json.dumps(response_dict, default=str)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return

                elif action == 'refreshSchedule':
                    # This command reloads the schedule from disk. Normal schedule
                    # changes are passed during fetchUpdate
                    c_sched.retrieve_json_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.json_schedule_list,
                                         "nextEvent": config.json_next_event}

                    json_string = json.dumps(response_dict, default=str)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "convertSchedule":
                    if "date" not in data or "from" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'date' or 'from' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return

                    with config.scheduleLock:
                        shutil.copy(c_tools.get_path(["schedules", data["from"].lower() + ".json"], user_file=True),
                                    c_tools.get_path(["schedules", data["date"] + ".json"], user_file=True))

                    # Reload the schedule from disk
                    c_sched.retrieve_json_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.json_schedule_list,
                                         "nextEvent": config.json_next_event}

                    json_string = json.dumps(response_dict, default=str)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "deleteSchedule":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    with config.scheduleLock:
                        json_schedule_path = c_tools.get_path(["schedules", data["name"]+".json"], user_file=True)
                        os.remove(json_schedule_path)

                    # Reload the schedule from disk
                    c_sched.retrieve_json_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.json_schedule_list,
                                         "nextEvent": config.json_next_event}
                    json_string = json.dumps(response_dict, default=str)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "deleteScheduleAction":
                    if "from" not in data or "scheduleID" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'from' or 'scheduleID' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return

                    c_sched.delete_json_schedule_event(data["from"] + ".json", data["scheduleID"])
                    c_sched.retrieve_json_schedule()

                    # Send the updated schedule back
                    with config.scheduleLock:
                        response_dict = {"success": True,
                                         "class": "schedule",
                                         "updateTime": config.scheduleUpdateTime,
                                         "schedule": config.json_schedule_list,
                                         "nextEvent": config.json_next_event}

                    json_string = json.dumps(response_dict, default=str)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    return
                elif action == "setExhibit":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    print("Changing exhibit to:", data["name"])
                    c_exhibit.read_exhibit_configuration(data["name"], update_default=True)

                    # Update the components that the configuration has changed
                    for component in config.componentList:
                        component.update_configuration()
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "createExhibit":
                    if "name" not in data or data["name"] == "":
                        response = {"success": False,
                                    "reason": "Request missing 'name' field or name is blank."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    clone = None
                    if "cloneFrom" in data and data["cloneFrom"] != "":
                        clone = data["cloneFrom"]
                    c_exhibit.create_new_exhibit(data["name"], clone)
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "deleteExhibit":
                    if "name" not in data or data["name"] == "":
                        response = {"success": False,
                                    "reason": "Request missing 'name' field or name is empty."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    c_exhibit.delete_exhibit(data["name"])
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "setComponentContent":
                    if "id" not in data or "content" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' or 'content' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    content_to_set = data["content"]
                    print(f"Changing content for {data['id']}:", content_to_set)
                    if not isinstance(content_to_set, list):
                        content_to_set = [data["content"]]
                    c_exhibit.set_component_content(data['id'], content_to_set)
                    response = {"success": True, "reason": ""}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "getHelpText":
                    try:
                        readme_path = os.path.join(config.APP_PATH,
                                                   "README.md")
                        if not os.path.isfile(readme_path):
                            # Handle the case of a Pyinstaller --onefile binary
                            readme_path = os.path.join(config.EXEC_PATH, "README.md")
                        with open(readme_path, 'r', encoding='UTF-8') as f:
                            text = f.read()
                        response = {"success": True, "text": text}
                    except FileNotFoundError:
                        with config.logLock:
                            logging.error("Unable to read README.md")
                        response = {"success": False, "reason": "Unable to read README.md"}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
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
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == "editIssue":
                    if "details" in data and "id" in data["details"]:
                        c_issues.edit_issue(data["details"])
                        c_issues.save_issueList()
                        response_dict = {"success": True}
                    else:
                        response_dict = {
                            "success": False,
                            "reason": "Must include field 'details' with proper"
                                      "ty 'id'"
                        }
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == "deleteIssue":
                    if "id" in data:
                        c_issues.remove_issue(data["id"])
                        c_issues.save_issueList()
                        response_dict = {"success": True, "reason": ""}
                    else:
                        response_dict = {"success": False, "reason": "Must include field 'id'"}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == "getIssueList":
                    response = {
                        "success": True,
                        "issueList": [x.details for x in config.issueList]
                    }
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "issueMediaDelete":
                    if "filename" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'filename' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    this_id = None
                    if "id" in data:
                        this_id = data["id"]
                    c_issues.delete_issue_media_file(data["filename"], owner=this_id)
                    response = {"success": True}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == 'updateMaintenanceStatus':
                    if "id" not in data or "status" not in data or "notes" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id', 'status', or 'notes' field."}
                        self.configure_response(200, "application/json")
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
                    self.configure_response(200, "application/json")
                    response_dict = {"success": success, "reason": reason}
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                elif action == 'deleteMaintenanceRecord':
                    self.configure_response(200, "application/json")
                    if "id" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' field."}
                    else:
                        file_path = os.path.join(config.APP_PATH,
                                                 "maintenance-logs", data["id"] + ".txt")
                        with config.maintenanceLock:
                            response = delete_file(file_path)
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == 'getMaintenanceStatus':
                    if "id" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'id' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    file_path = os.path.join(config.APP_PATH,
                                             "maintenance-logs", data["id"] + ".txt")
                    with config.maintenanceLock:
                        response_dict = c_maint.get_maintenance_report(file_path)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
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
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response_dict), encoding="UTF-8"))
                    return
                else:
                    print(f"Error: Unknown webpage command received: {action}")
                    with config.logLock:
                        logging.error(f"Unknown webpage command received: {action}")

            elif ping_class == "exhibitComponent":
                if "action" in data:  # not a ping
                    action = data["action"]

                    if action == "beginSynchronization":
                        if "synchronizeWith" in data:
                            c_exhibit.update_synchronization_list(data["id"], data["synchronizeWith"])
                else:  # it's a ping
                    try:
                        id = data["id"]
                        # type = data["type"]
                        if id == "UNKNOWN":
                            print(f"Warning: exhibitComponent ping with id=UNKNOWN coming from {self.address_string()}")
                            self.configure_response(200, "application/json")
                            self.wfile.write(bytes(json.dumps({}), encoding='UTF-8'))
                            # print("END POST")
                            # print("===============")
                            return
                    except KeyError:
                        print("Error: exhibitComponent ping received without id or type field")
                        # print("END POST")
                        # print("===============")
                        self.configure_response(204)
                        return  # No id or type, so bail out

                    # print(f"    id = {id}")
                    # print("    action = ping")

                    c_exhibit.update_exhibit_component_status(data, self.address_string())
                    self.send_current_configuration(id)
                    return
            elif ping_class == "tracker":
                if "action" not in data:
                    response = {"success": False,
                                "reason": "Request missing 'action' field."}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                action = data["action"]

                if action == "getLayoutDefinition":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")

                    layout_definition, success, reason = c_track.get_layout_definition(data["name"] + ".ini",
                                                                                       kind=kind)

                    response = {"success": success,
                                "reason": reason,
                                "layout": layout_definition}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "submitData":
                    if "data" not in data or "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'data' or 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    # file_path = os.path.join(config.APP_PATH, kind, "data", data["name"] + ".txt")
                    file_path = c_tools.get_path([kind, "data", data["name"] + ".txt"], user_file=True)
                    success, reason = c_track.write_JSON(data["data"], file_path)
                    response = {"success": success, "reason": reason}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "submitRawText":
                    if "text" not in data or "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'text' or 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    mode = data.get("mode", "a")
                    if mode != "a" and mode != "w":
                        response = {"success": False,
                                    "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    success, reason = c_track.write_raw_text(data["text"], data["name"] + ".txt", kind=kind, mode=mode)
                    response = {"success": success, "reason": reason}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "retrieveRawText":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    result, success, reason = c_track.get_raw_text(data["name"] + ".txt", kind)
                    response = {"success": success, "reason": reason, "text": result}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "submitAnalytics":
                    if "data" not in data or 'name' not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'data' or 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    file_path = os.path.join(config.APP_PATH, "analytics", data["name"] + ".txt")
                    success, reason = c_track.write_JSON(data["data"], file_path)
                    response = {"success": success, "reason": reason}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "getAvailableDefinitions":
                    kind = data.get("kind", "flexible-tracker")
                    definition_list = []
                    template_path = os.path.join(config.APP_PATH, kind, "templates")
                    for file in os.listdir(template_path):
                        if file.lower().endswith(".ini"):
                            definition_list.append(file)

                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(definition_list), encoding="UTF-8"))
                    return
                elif action == "getAvailableTrackerData":
                    kind = data.get("kind", "flexible-tracker")
                    data_path = os.path.join(config.APP_PATH, kind, "data")
                    data_list = []
                    for file in os.listdir(data_path):
                        if file.lower().endswith(".txt"):
                            data_list.append(file)
                    response = {"success": True,
                                "data": data_list}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "downloadTrackerData":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    name = data["name"]
                    if not name.lower().endswith(".txt"):
                        name += ".txt"
                    data_path = os.path.join(config.APP_PATH, kind, "data", name)
                    result = c_track.create_CSV(data_path)
                    response = {"success": True,
                                "csv": result}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "clearTrackerData":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    name = data["name"]
                    if name is None:
                        response = {"success": False,
                                    "reason": "'name' field is blank."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    if not name.lower().endswith(".txt"):
                        name += ".txt"
                    data_path = os.path.join(config.APP_PATH, kind, "data", name)
                    success = True
                    reason = ""
                    with config.trackingDataWriteLock:
                        try:
                            os.remove(data_path)
                        except PermissionError:
                            success = False
                            reason = f"You do not have write permission for the file {data_path}"
                        except FileNotFoundError:
                            success = True  # This error results in the user's desired action!
                            reason = f"File does not exist: {data_path}"
                    if reason != "":
                        print(reason)
                    response = {"success": success,
                                "reason": reason}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "createTemplate":
                    if "name" not in data or "template" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' or 'template' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    name = data["name"]
                    if not name.lower().endswith(".ini"):
                        name += ".ini"
                    file_path = os.path.join(config.APP_PATH, kind, "templates", name)
                    success = c_track.create_template(file_path, data["template"])
                    response = {"success": success}
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "deleteTemplate":
                    if "name" not in data:
                        response = {"success": False,
                                    "reason": "Request missing 'name' field."}
                        self.configure_response(200, "application/json")
                        self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                        return
                    kind = data.get("kind", "flexible-tracker")
                    file_path = os.path.join(config.APP_PATH, kind, "templates", data["name"] + ".ini")
                    with config.trackerTemplateWriteLock:
                        response = delete_file(file_path)
                    self.configure_response(200, "application/json")
                    self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                    return
                elif action == "checkConnection":
                    self.configure_response(200, "application/json")
                    try:
                        self.wfile.write(bytes(json.dumps({"success": True}), encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
                    return
            else:
                print(f"Error: ping with unknown class '{ping_class}' received")
                response = {"success": False,
                            "reason": f"Unknown class {ping_class}"}
                self.configure_response(200, "application/json")
                self.wfile.write(bytes(json.dumps(response), encoding="UTF-8"))
                # print("END POST")
                # print("===============")
                return
        self.configure_response(204)
        # print("END POST")
        # print("===============")


def delete_file(file_path) -> dict:
    """Delete the specified file and return a dictionary with the result"""

    response = {"success": False}
    try:
        os.remove(file_path)
        response["success"] = True
    except FileNotFoundError:
        response["reason"] = f"File {file_path} does not exist"
    except PermissionError:
        response["reason"] = f"You do not have permission for the file f{file_path}"
    return response


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


def clear_terminal():
    """Clear the terminal"""

    os.system('cls' if os.name == 'nt' else 'clear')


def command_line_setup():
    """Prompt the user for several pieces of information on first-time setup"""

    settings_dict = {}

    clear_terminal()
    print("##########################################################")
    print("Welcome to Constellation Control Server!")
    print("")
    print("This appears to be your first time running Control Server.")
    print("In order to set up your configuration, you will be asked")
    print("a few questions. If you don't know the answer, or wish to")
    print("accept the default, just press the enter key.")
    print("")
    gallery_name = input("Enter a name for the gallery (default: Constellation): ").strip()
    if gallery_name == "":
        gallery_name = "Constellation"
    settings_dict["gallery_name"] = gallery_name

    default_ip = socket.gethostbyname(socket.gethostname())
    ip_address = input(f"Enter this computer's static IP address (default: {default_ip}): ").strip()
    if ip_address == "":
        ip_address = default_ip
    settings_dict["server_ip_address"] = ip_address

    default_port = 8082
    while True:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((ip_address, default_port)) != 0:
                # Port is free
                break
            else:
                default_port += 1
    port = input(f"Enter the desired port (default: {default_port}): ").strip()
    if port == "":
        port = default_port
    else:
        port = int(port)
    settings_dict["server_port"] = port

    settings_dict["current_exhibit"] = "default.exhibit"

    return {"CURRENT": settings_dict}


def load_default_configuration():
    """Read the current exhibit configuration from file and initialize it"""

    global server_port
    global ip_address
    global gallery_name

    # First, retrieve the config filename that defines the desired gallery
    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    # gal_path = os.path.join(config.APP_PATH, "galleryConfiguration.ini")
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    with config.galleryConfigurationLock:
        config_reader.read(gal_path)
    try:
        current = config_reader["CURRENT"]
    except KeyError:
        # We don't have a config file, so let's get info from the user to create one
        settings_dict = command_line_setup()
        config_reader.read_dict(settings_dict)
        with open(os.path.join(config.APP_PATH, "galleryConfiguration.ini"), "w", encoding="UTF-8") as f:
            config_reader.write(f)
        current = config_reader["CURRENT"]
    server_port = current.getint("server_port", 8080)
    ip_address = current.get("server_ip_address", socket.gethostbyname(socket.gethostname()))
    gallery_name = current.get("gallery_name", "Constellation")
    staff_list = current.get("assignable_staff", "")
    config.debug = current.getboolean("debug", False)
    if config.debug:
        c_tools.print_debug_details(loop=True)

    if len(staff_list) > 0:
        config.assignable_staff = [x.strip() for x in staff_list.split(",")]
    else:
        config.assignable_staff = []

    c_sched.retrieve_json_schedule()

    config.projectorList = []

    # Load the component descriptions. Do this first, so they are available when
    # creating the various components
    try:
        print("Reading component descriptions...", end="", flush=True)
        config.componentDescriptions = dict(config_reader["COMPONENT_DESCRIPTIONS"])
        print(" done")
    except KeyError:
        print("None found")
        config.componentDescriptions = {}

    # Parse list of PJLink projectors
    try:
        pjlink_projectors = config_reader["PJLINK_PROJECTORS"]
        print("Connecting to PJLink projectors...", end="\r", flush=True)
    except KeyError:
        print("No PJLink projectors specified")
        pjlink_projectors = []

    n_proj = len(pjlink_projectors)
    cur_proj = 0
    for key in pjlink_projectors:
        cur_proj += 1
        print(f"Connecting to PJLink projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if c_proj.get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, password"
            split = pjlink_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a password
                ip = split[0].strip()
                password = split[1].strip()
                if password == "":
                    password = None
                new_proj = c_proj.Projector(key, ip, "pjlink", password=password)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = c_proj.Projector(key, pjlink_projectors[key], "pjlink")
            else:
                print("Invalid PJLink projector entry:", pjlink_projectors[key])
                break
            config.projectorList.append(new_proj)
    print("Connecting to PJLink projectors... done                      ")

    # Parse list of serial projectors
    try:
        serial_projectors = config_reader["SERIAL_PROJECTORS"]
        print("Connecting to serial projectors...", end="\r", flush=True)
    except KeyError:
        print("No serial projectors specified")
        serial_projectors = []

    n_proj = len(serial_projectors)
    cur_proj = 0
    for key in serial_projectors:
        cur_proj += 1
        print(f"Connecting to serial projectors... {cur_proj}/{n_proj}", end="\r", flush=True)
        if c_proj.get_projector(key) is None:
            # Try to split on a comma. If we get two elements back, that means
            # we have the form "ip, password"
            split = serial_projectors[key].split(",")
            if len(split) == 2:
                # We have an IP address and a make
                ip = split[0].strip()
                make = split[1].strip()
                if make == "":
                    make = None
                new_proj = c_proj.Projector(key, ip, "serial", make=make)
            elif len(split) == 1:
                # We have an IP address only
                new_proj = c_proj.Projector(key, serial_projectors[key], "serial")
            else:
                print("Invalid serial projector entry:", serial_projectors[key])
                break
            config.projectorList.append(new_proj)
    print("Connecting to serial projectors... done                      ")

    # Parse list of Wake on LAN devices
    try:
        wol = config_reader["WAKE_ON_LAN"]
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
        static_components = config_reader["STATIC_COMPONENTS"]
        print("Adding static components... ", end="\r", flush=True)
        for this_type in static_components:
            split = static_components[this_type].split(",")
            for this_id in split:
                this_id = this_id.strip()
                if c_exhibit.get_exhibit_component(this_id) is None:
                    static_component = c_exhibit.add_exhibit_component(this_id, this_type, category="static")
                    static_component.constellation_app_id = "static_component"
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


def check_file_structure():
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = os.path.join(config.APP_PATH, "schedules")
    exhibits_dir = os.path.join(config.APP_PATH, "exhibits")

    misc_dirs = {"analytics": os.path.join(config.APP_PATH, "analytics"),
                 "flexible-tracker": os.path.join(config.APP_PATH, "flexible-tracker"),
                 "flexible-tracker/data": os.path.join(config.APP_PATH, "flexible-tracker", "data"),
                 "flexible-tracker/templates": os.path.join(config.APP_PATH, "flexible-tracker", "templates"),
                 "issues": os.path.join(config.APP_PATH, "issues"),
                 "issues/media": os.path.join(config.APP_PATH, "issues", "media"),
                 "maintenance-logs": os.path.join(config.APP_PATH, "maintenance-logs")}

    try:
        os.listdir(schedules_dir)
    except FileNotFoundError:
        print("Missing schedules directory. Creating now...")
        try:
            os.mkdir(schedules_dir)
            default_schedule_list = ["monday.json", "tuesday.json",
                                     "wednesday.json", "thursday.json",
                                     "friday.json", "saturday.json",
                                     "sunday.json"]

            for file in default_schedule_list:
                with open(os.path.join(schedules_dir, file), 'w', encoding="UTF-8") as f:
                    f.write("{}")
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
    path_to_write = os.path.join(config.APP_PATH, "current_state.dat")
    with open(path_to_write, 'wb') as f:
        pickle.dump(config.componentList, f)

    for key in config.polling_thread_dict:
        config.polling_thread_dict[key].cancel()

    with config.logLock:
        logging.info("Server shutdown")

    with config.galleryConfigurationLock:
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
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/control_server/version.txt"):
            if float(line.decode('utf-8')) > SOFTWARE_VERSION:
                software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("cannot connect to update server")
        return
    if software_update_available:
        print("update available!")
    else:
        print("the server is up to date.")


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
config.EXEC_PATH = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    config.APP_PATH = os.path.dirname(sys.executable)
else:
    config.APP_PATH = config.EXEC_PATH

server_port: int = 8080  # Default; should be set in galleryConfiguration.ini
ip_address: str = socket.gethostbyname(socket.gethostname())  # Default; should be set in galleryConfiguration.ini
ADDR: str = ""  # Accept connections from all interfaces
gallery_name: str = ""
SOFTWARE_VERSION = 1.1
software_update_available: bool = False

# Set up log file
log_path: str = os.path.join(config.APP_PATH, "control_server.log")
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
c_proj.poll_projectors()
c_exhibit.poll_wake_on_LAN_devices()
check_for_software_update()

httpd = ThreadedHTTPServer((ADDR, server_port), RequestHandler)
httpd.serve_forever()
