# Constellation Control Server
# A centralized server for controlling museum exhibit components
# Written by Morgan Rehnberg, Adventure Science Center
# Released under the MIT license

# Standard modules
import cgi
import configparser
import datetime
from fastapi import FastAPI, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from functools import lru_cache
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
import logging
import mimetypes
import os
import pickle
import re
import shutil
import signal
import socket
from socketserver import ThreadingMixIn
import sys
import threading
import time
import traceback
from typing import Any
import urllib.request
import uvicorn

# Non-standard modules
import dateutil.parser

# Constellation modules
import config as c_config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_legacy as c_legacy
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

    # def send_current_configuration(self, id_):
    #     """Function to respond to a POST with a dictionary defining the current exhibit configuration"""
    #
    #     json_string = json.dumps(c_exhibit.get_exhibit_component(id_).config)
    #     if len(c_exhibit.get_exhibit_component(id_).config["commands"]) > 0:
    #         # Clear the command list now that we have sent
    #         c_exhibit.get_exhibit_component(id_).config["commands"] = []
    #     self.configure_response(200, "application/json")
    #     self.wfile.write(bytes(json_string, encoding="UTF-8"))

    # def send_webpage_update(self):
    #     """Function to collect the current exhibit status, format it, and send it back to the web client to update the page"""
    #
    #     component_dict_list = []
    #     for item in c_config.componentList:
    #         temp = {"id": item.id,
    #                 "type": item.type}
    #         if "content" in item.config:
    #             temp["content"] = item.config["content"]
    #         if "error" in item.config:
    #             temp["error"] = item.config["error"]
    #         if "allowed_actions" in item.config:
    #             temp["allowed_actions"] = item.config["allowed_actions"]
    #         if "description" in item.config:
    #             temp["description"] = item.config["description"]
    #         if "AnyDeskID" in item.config:
    #             temp["AnyDeskID"] = item.config["AnyDeskID"]
    #         temp["class"] = "exhibitComponent"
    #         temp["status"] = item.current_status()
    #         temp["lastContactDateTime"] = item.last_contact_datetime
    #         temp["ip_address"] = item.ip
    #         temp["helperPort"] = item.helperPort
    #         temp["helperAddress"] = item.helperAddress
    #         temp["constellation_app_id"] = item.constellation_app_id
    #         temp["platform_details"] = item.platform_details
    #         component_dict_list.append(temp)
    #
    #     for item in c_config.projectorList:
    #         temp = {"id": item.id,
    #                 "type": 'PROJECTOR',
    #                 "ip_address": item.ip}
    #         if "allowed_actions" in item.config:
    #             temp["allowed_actions"] = item.config["allowed_actions"]
    #         if "description" in item.config:
    #             temp["description"] = item.config["description"]
    #         temp["class"] = "exhibitComponent"
    #         temp["status"] = item.state["status"]
    #         component_dict_list.append(temp)
    #
    #     for item in c_config.wakeOnLANList:
    #         temp = {"id": item.id,
    #                 "type": 'WAKE_ON_LAN',
    #                 "ip_address": item.ip}
    #         if "allowed_actions" in item.config:
    #             temp["allowed_actions"] = item.config["allowed_actions"]
    #         if "description" in item.config:
    #             temp["description"] = item.config["description"]
    #         temp["class"] = "exhibitComponent"
    #         temp["status"] = item.state["status"]
    #         component_dict_list.append(temp)
    #
    #     # Also include an object with the status of the overall gallery
    #     temp = {"class": "gallery",
    #             "currentExhibit": c_config.currentExhibit,
    #             "availableExhibits": c_config.exhibit_list,
    #             "galleryName": gallery_name,
    #             "updateAvailable": str(software_update_available).lower()}
    #     component_dict_list.append(temp)
    #
    #     # Also include an object containing the current issues
    #     temp = {"class": "issues",
    #             "issueList": [x.details for x in c_config.issueList],
    #             "lastUpdateDate": c_config.issueList_last_update_date,
    #             "assignable_staff": c_config.assignable_staff}
    #     component_dict_list.append(temp)
    #
    #     # Also include an object containing the current schedule
    #     c_sched.retrieve_json_schedule()
    #     with c_config.scheduleLock:
    #         temp = {"class": "schedule",
    #                 "updateTime": c_config.scheduleUpdateTime,
    #                 "schedule": c_config.json_schedule_list,
    #                 "nextEvent": c_config.json_next_event}
    #         component_dict_list.append(temp)
    #
    #     json_string = json.dumps(component_dict_list, default=str)
    #     self.configure_response(200, "application/json")
    #     self.wfile.write(bytes(json_string, encoding="UTF-8"))

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
                file_path = os.path.join(c_config.APP_PATH, "index.html")
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(c_config.EXEC_PATH, "index.html")
                f = open(file_path, "r", encoding='UTF-8')
            else:
                if self.path.startswith("/"):
                    self.path = self.path[1:]

                file_path = os.path.join(c_config.APP_PATH, self.path)
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(c_config.EXEC_PATH, self.path)
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
                file_path = os.path.join(c_config.APP_PATH, self.path)
                if not os.path.isfile(file_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    file_path = os.path.join(c_config.EXEC_PATH, self.path)
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
                with c_config.logLock:
                    logging.error("GET for unexpected file %s", self.path)


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
    c_config.gallery_name = input("Enter a name for the gallery (default: Constellation): ").strip()
    if c_config.gallery_name == "":
        c_config.gallery_name = "Constellation"
    settings_dict["gallery_name"] = c_config.gallery_name

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

    # First, retrieve the config filename that defines the desired gallery
    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    # gal_path = os.path.join(config.APP_PATH, "galleryConfiguration.ini")
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)

    with c_config.galleryConfigurationLock:
        config_reader.read(gal_path)
    try:
        current = config_reader["CURRENT"]
    except KeyError:
        # We don't have a config file, so let's get info from the user to create one
        settings_dict = command_line_setup()
        config_reader.read_dict(settings_dict)
        with open(os.path.join(c_config.APP_PATH, "galleryConfiguration.ini"), "w", encoding="UTF-8") as f:
            config_reader.write(f)
        current = config_reader["CURRENT"]
    server_port = current.getint("server_port", 8080)
    ip_address = current.get("server_ip_address", socket.gethostbyname(socket.gethostname()))
    c_config.gallery_name = current.get("gallery_name", "Constellation")
    staff_list = current.get("assignable_staff", "")
    c_config.debug = current.getboolean("debug", False)
    if c_config.debug:
        c_tools.print_debug_details(loop=True)

    if len(staff_list) > 0:
        c_config.assignable_staff = [x.strip() for x in staff_list.split(",")]
    else:
        c_config.assignable_staff = []

    c_sched.retrieve_json_schedule()

    c_config.projectorList = []

    # Load the component descriptions. Do this first, so they are available when
    # creating the various components
    try:
        print("Reading component descriptions...", end="", flush=True)
        c_config.componentDescriptions = dict(config_reader["COMPONENT_DESCRIPTIONS"])
        print(" done")
    except KeyError:
        print("None found")
        c_config.componentDescriptions = {}

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
            c_config.projectorList.append(new_proj)
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
            c_config.projectorList.append(new_proj)
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
                c_config.wakeOnLANList.append(device)
        print(" done")
    except KeyError:
        print("No wake on LAN devices specified")
        c_config.wakeOnLANList = []

    # Build any existing issues
    try:
        issue_file = os.path.join(c_config.APP_PATH, "issues", "issues.json")
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)
        print("Reading stored issues...", end="", flush=True)

        for issue in issues:
            new_issue = c_issues.Issue(issue)
            c_config.issueList.append(new_issue)
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
        c_config.serverRebootTime = reboot_time
        print("Server will reboot at:", c_config.serverRebootTime.isoformat())

    # Then, load the configuration for that exhibit
    c_exhibit.read_exhibit_configuration(current["current_exhibit"])

    # Update the components that the configuration has changed
    for component in c_config.componentList:
        component.update_configuration()


def check_file_structure():
    """Check to make sure we have the appropriate file structure set up"""

    schedules_dir = os.path.join(c_config.APP_PATH, "schedules")
    exhibits_dir = os.path.join(c_config.APP_PATH, "exhibits")

    misc_dirs = {"analytics": os.path.join(c_config.APP_PATH, "analytics"),
                 "flexible-tracker": os.path.join(c_config.APP_PATH, "flexible-tracker"),
                 "flexible-tracker/data": os.path.join(c_config.APP_PATH, "flexible-tracker", "data"),
                 "flexible-tracker/templates": os.path.join(c_config.APP_PATH, "flexible-tracker", "templates"),
                 "issues": os.path.join(c_config.APP_PATH, "issues"),
                 "issues/media": os.path.join(c_config.APP_PATH, "issues", "media"),
                 "maintenance-logs": os.path.join(c_config.APP_PATH, "maintenance-logs")}

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
        if c_config.rebooting is True:
            exit_code = 1
            print("\nRebooting server...")
        else:
            exit_code = 0
            print('\nKeyboard interrupt detected. Cleaning up and shutting down...')
    except RuntimeError:
        exit_code = 0

    # Save the current component lists to a pickle file so that
    # we can resume from the current state
    path_to_write = os.path.join(c_config.APP_PATH, "current_state.dat")
    with open(path_to_write, 'wb') as f:
        pickle.dump(c_config.componentList, f)

    for key in c_config.polling_thread_dict:
        c_config.polling_thread_dict[key].cancel()

    with c_config.logLock:
        logging.info("Server shutdown")

    with c_config.galleryConfigurationLock:
        with c_config.scheduleLock:
            with c_config.trackingDataWriteLock:
                sys.exit(exit_code)


def error_handler(*exc_info):
    """Catch errors and log them to file"""

    text = "".join(traceback.format_exception(*exc_info)).replace('"', "'").replace("\n", "<newline>")
    with c_config.logLock:
        logging.error(f'"{text}"')
    print(f"Error: see control_server.log for more details ({datetime.datetime.now()})")


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/control_server/version.txt"):
            if float(line.decode('utf-8')) > SOFTWARE_VERSION:
                c_config.software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("cannot connect to update server")
        return
    if c_config.software_update_available:
        print("update available!")
    else:
        print("the server is up to date.")


# Check whether we have packaged with Pyinstaller and set the appropriate root path.
c_config.EXEC_PATH = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    c_config.APP_PATH = os.path.dirname(sys.executable)
else:
    c_config.APP_PATH = c_config.EXEC_PATH

server_port: int = 8080  # Default; should be set in galleryConfiguration.ini
ip_address: str = socket.gethostbyname(socket.gethostname())  # Default; should be set in galleryConfiguration.ini
ADDR: str = ""  # Accept connections from all interfaces
SOFTWARE_VERSION = 2.0

# Set up log file
log_path: str = os.path.join(c_config.APP_PATH, "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
signal.signal(signal.SIGINT, quit_handler)
sys.excepthook = error_handler

with c_config.logLock:
    logging.info("Server started")

# Try to reload the previous state from the pickle file current_state.dat
try:
    state_path = os.path.join(c_config.APP_PATH, "current_state.dat")
    with open(state_path, "rb") as previous_state:
        c_config.componentList = pickle.load(previous_state)
        print("Previous server state loaded")
except (FileNotFoundError, EOFError):
    print("Could not load previous server state")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




@lru_cache()
def get_config():
    return c_config


# Exhibit component actions
@app.post("/exhibit/create")
async def create_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Create a new exhibit INI file.

    If 'data' includes the 'clone' field, the specified 'clone'.ini file will be copied.
    """

    if "name" not in data or data["name"] == "":
        response = {"success": False,
                    "reason": "Request missing 'name' field or name is blank."}
        return response
    clone = None
    if "cloneFrom" in data and data["cloneFrom"] != "":
        clone = data["cloneFrom"]
    c_exhibit.create_new_exhibit(data["name"], clone)
    return {"success": True, "reason": ""}


@app.post("/exhibit/delete")
async def delete_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the specified exhibit."""

    if "name" not in data or data["name"] == "":
        response = {"success": False,
                    "reason": "Request missing 'name' field or name is empty."}
        return response
    c_exhibit.delete_exhibit(data["name"])
    response = {"success": True, "reason": ""}
    return response
    

@app.post("/exhibit/queueCommand")
async def queue_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Queue the specified command for the exhibit component to retrieve."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


@app.post("/exhibit/queueWOLCommand")
async def queue_WOL_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Queue the Wake on Lan command for the exhibit component to retrieve."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_wake_on_LAN_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


@app.post("/exhibit/set")
async def set_exhibit(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Set the specified exhibit as the current one."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    print("Changing exhibit to:", data["name"])
    c_exhibit.read_exhibit_configuration(data["name"], update_default=True)

    # Update the components that the configuration has changed
    for component in c_config.componentList:
        component.update_configuration()
    return {"success": True, "reason": ""}


@app.post("/exhibit/setComponentContent")
async def set_component_content(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Change the active content for the given exhibit component."""

    if "id" not in data or "content" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' or 'content' field."}
        return response
    content_to_set = data["content"]
    print(f"Changing content for {data['id']}:", content_to_set)
    if not isinstance(content_to_set, list):
        content_to_set = [data["content"]]
    c_exhibit.set_component_content(data['id'], content_to_set)
    return {"success": True, "reason": ""}


# Flexible Tracker actions
@app.get("/tracker/{tracker_type}/getAvailableDefinitions")
async def get_available_tracker_definitions(tracker_type: str, config: c_config = Depends(get_config)):
    """Send a list of all the available definitions for the given tracker type (usually flexible-tracker)"""

    definition_list = []
    template_path = os.path.join(c_config.APP_PATH, tracker_type, "templates")
    for file in os.listdir(template_path):
        if file.lower().endswith(".ini"):
            definition_list.append(file)

    return definition_list


# Maintenance actions
@app.post("/maintenance/deleteRecord")
async def delete_maintenance_record(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the specified maintenance record"""

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
    else:
        file_path = os.path.join(c_config.APP_PATH, "maintenance-logs", data["id"] + ".txt")
        with c_config.maintenanceLock:
            response = c_tools.delete_file(file_path)
    return response


@app.get("/maintenance/getAllStatuses")
async def get_all_maintenance_statuses(config: c_config = Depends(get_config)):
    """Send a list of all the maintenance statuses for known components"""

    record_list = []
    maintenance_path = os.path.join(c_config.APP_PATH, "maintenance-logs")
    for file in os.listdir(maintenance_path):
        if file.lower().endswith(".txt"):
            with c_config.maintenanceLock:
                file_path = os.path.join(maintenance_path, file)
                record_list.append(c_maint.get_maintenance_report(file_path))
    response_dict = {"success": True,
                     "records": record_list}
    return response_dict


@app.post("/maintenance/getStatus")
async def get_maintenance_status(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Return the specified maintenance status"""

    if "id" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id' field."}
        return response
    file_path = os.path.join(c_config.APP_PATH, "maintenance-logs", data["id"] + ".txt")
    with c_config.maintenanceLock:
        response_dict = c_maint.get_maintenance_report(file_path)
    return response_dict


@app.post("/maintenance/updateStatus")
async def update_maintenance_status(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Poll the projector for an update and return it"""

    if "id" not in data or "status" not in data or "notes" not in data:
        response = {"success": False,
                    "reason": "Request missing 'id', 'status', or 'notes' field."}
        return response
    file_path = os.path.join(c_config.APP_PATH, "maintenance-logs", data["id"] + ".txt")
    record = {"id": data["id"],
              "date": datetime.datetime.now().isoformat(),
              "status": data['status'],
              "notes": data["notes"]}
    with c_config.maintenanceLock:
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
    return {"success": success, "reason": reason}


# Projector actions
@app.post("/projector/getUpdate")
async def get_projector_update(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Poll the projector for an update and return it"""

    if "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id'.",
                         "status": None}
        return response_dict
    proj = c_proj.get_projector(data["id"])
    if proj is not None:
        response_dict = {"success": True,
                         "state": proj.state}
    else:
        response_dict = {"success": False,
                         "reason": f"Projector {data['id']} does not exist",
                         "status": "DELETE"}
    return response_dict


@app.post("/projector/queueCommand")
async def queue_projector_command(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Send a command to the specified projector."""

    if "command" not in data or "id" not in data:
        response_dict = {"success": False,
                         "reason": "Missing required field 'id' or 'command'."}
        return response_dict
    c_exhibit.get_exhibit_component(data["id"]).queue_command(data["command"])
    return {"success": True, "reason": ""}


# Schedule actions
@app.post("/schedule/convert")
async def convert_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Convert between date- and day-specific schedules."""

    if "date" not in data or "from" not in data:
        response = {"success": False,
                    "reason": "Request missing 'date' or 'from' field."}
        return response

    with c_config.scheduleLock:
        shutil.copy(c_tools.get_path(["schedules", data["from"].lower() + ".json"], user_file=True),
                    c_tools.get_path(["schedules", data["date"] + ".json"], user_file=True))

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteAction")
async def delete_schedule_action(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the given action from the specified schedule."""

    if "from" not in data or "scheduleID" not in data:
        response = {"success": False,
                    "reason": "Request missing 'from' or 'scheduleID' field."}
        return response

    c_sched.delete_json_schedule_event(data["from"] + ".json", data["scheduleID"])
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/deleteSchedule")
async def delete_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Delete the given schedule."""

    if "name" not in data:
        response = {"success": False,
                    "reason": "Request missing 'name' field."}
        return response
    with c_config.scheduleLock:
        json_schedule_path = c_tools.get_path(["schedules", data["name"] + ".json"], user_file=True)
        os.remove(json_schedule_path)

    # Reload the schedule from disk
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.get("/schedule/refresh")
async def refresh_schedule(config: c_config = Depends(get_config)):
    """Reload the schedule from disk and return it."""

    # This command reloads the schedule from disk. Normal schedule changes are passed during /system/getUpdate
    c_sched.retrieve_json_schedule()

    # Send the updated schedule back
    with c_config.scheduleLock:
        response_dict = {"success": True,
                         "class": "schedule",
                         "updateTime": c_config.scheduleUpdateTime,
                         "schedule": c_config.json_schedule_list,
                         "nextEvent": c_config.json_next_event}
    return response_dict


@app.post("/schedule/update")
async def update_schedule(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Write a schedule update to disk.

    This command handles both adding a new scheduled action and editing an existing action
    """

    if "name" not in data \
            or "timeToSet" not in data \
            or "actionToSet" not in data \
            or "targetToSet" not in data \
            or "valueToSet" not in data \
            or "isAddition" not in data \
            or "scheduleID" not in data:
        response_dict = {"success": False,
                         "reason": "Missing one or more required keys"}
        return response_dict

    # Make sure we were given a valid time to parse
    try:
        dateutil.parser.parse(data["timeToSet"])
    except dateutil.parser._parser.ParserError:
        response_dict = {"success": False,
                         "reason": "Time not valid"}
        return response_dict

    c_sched.update_json_schedule(data["name"] + ".json", {
        data["scheduleID"]: {"time": data["timeToSet"], "action": data["actionToSet"],
                             "target": data["targetToSet"], "value": data["valueToSet"]}})

    error = False
    error_message = ""

    response_dict = {}
    if not error:
        # Reload the schedule from disk
        c_sched.retrieve_json_schedule()

        # Send the updated schedule back
        with c_config.scheduleLock:
            response_dict["class"] = "schedule"
            response_dict["updateTime"] = c_config.scheduleUpdateTime
            response_dict["schedule"] = c_config.json_schedule_list
            response_dict["nextEvent"] = c_config.json_next_event
            response_dict["success"] = True
    else:
        response_dict["success"] = False
        response_dict["reason"] = error_message
    return response_dict


# System actions
@app.get("/system/checkConnection")
async def check_connection(config: c_config = Depends(get_config)):
    """Respond to request to confirm that the connection is active"""

    return {"success": True}


@app.get("/system/getConfiguration")
async def get_configuration(config: c_config = Depends(get_config)):
    """Return a dictionary with galleryConfiguration.ini."""

    config_reader = configparser.ConfigParser(delimiters="=")
    config_reader.optionxform = str  # Override default, which is case in-sensitive
    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    with c_config.galleryConfigurationLock:
        config_reader.read(gal_path)

    config_dict = {}
    for section in config_reader.sections():
        config_dict[section] = {}
        for key, val in config_reader.items(section):
            config_dict[section][key] = val
    return {"success": True, "configuration": config_dict}


@app.get("/system/getConfigurationRawText")
async def get_configuration_raw_text(config: c_config = Depends(get_config)):
    """Return the raw text for galleryConfiguration.ini."""

    gal_path = c_tools.get_path(["galleryConfiguration.ini"], user_file=True)
    with open(gal_path, 'r', encoding='UTF-8') as f:
        text = f.read()
    return {"success": True, "configuration": text}


@app.get("/system/getHelpText")
async def get_help_text(config: c_config = Depends(get_config)):
    """Send the contents of README.md"""
    try:
        readme_path = os.path.join(c_config.APP_PATH, "README.md")
        if not os.path.isfile(readme_path):
            # Handle the case of a Pyinstaller --onefile binary
            readme_path = os.path.join(c_config.EXEC_PATH, "README.md")
        with open(readme_path, 'r', encoding='UTF-8') as f:
            text = f.read()
        response = {"success": True, "text": text}
    except FileNotFoundError:
        with c_config.logLock:
            logging.error("Unable to read README.md")
        response = {"success": False, "reason": "Unable to read README.md"}
    return response


@app.get("/system/getUpdate")
async def get_update(config: c_config = Depends(get_config)):
    """Retrieve an update of everything being managed by Control Server"""
    return c_tools.send_webpage_update()


@app.get("/system/reloadConfiguration")
async def reload_configuration(config: c_config = Depends(get_config)):
    """Reload galleryConfiguration.ini"""
    load_default_configuration()


@app.post("/system/updateConfigurationRawText")
async def update_configuration_raw_text(data: dict[str, Any], config: c_config = Depends(get_config)):
    """Use the given plain text to rewrite galleryConfiguration.ini."""

    if "configuration" not in data:
        return {"success": False, "reason": "Missing required field 'configuration'"}

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
        response_dict[
            "reason"] = f"Section [{e.section}] has a repeated option: {e.option} (line {e.lineno})"
    except configparser.NoSectionError:
        response_dict["success"] = False
        response_dict["reason"] = "You must have a [CURRENT] section"
    except configparser.NoOptionError as e:
        response_dict["success"] = False
        response_dict["reason"] = f"You must have the {e.option} setting in the [{e.section}] section"
    return response_dict


@app.post("/")
async def do_post(data: dict[str, Any], request: Request, config: c_config = Depends(get_config)):
    """POST requests to / are Constellation 1 legacy calls."""

    client_ip = request.client.host
    if client_ip == "::1":
        client_ip = "localhost"
    result = c_legacy.do_POST(data, client_ip)
    return result


app.mount("/js",
          StaticFiles(directory=c_tools.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=c_tools.get_path(["css"])),
          name="css")
app.mount("/",
          StaticFiles(directory=c_tools.get_path([""]), html=True),
          name="root")

if __name__ == "__main__":
    check_file_structure()
    c_exhibit.check_available_exhibits()
    load_default_configuration()
    c_proj.poll_projectors()
    c_exhibit.poll_wake_on_LAN_devices()
    check_for_software_update()

    # Must use only one worker, since we are relying on the config module being in global)
    uvicorn.run(app,
                host=ADDR,
                port=int(server_port),
                reload=False, workers=1)
