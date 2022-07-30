"""A small server to communicate with user-facing interfaces and handle interacting with the system"""

# Standard modules
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import threading
import time
import datetime
import configparser
import json
import sys
import os
import signal
from typing import Union
import cgi
import shutil
import socket
import mimetypes
import urllib
import re
import errno
import webbrowser

# Non-standard modules
import psutil
import dateutil.parser
import requests
import serial

# Constellation modules
import config
import helper_files


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Stub which triggers dispatch of requests into individual threads."""

    daemon_threads = True


class RequestHandler(SimpleHTTPRequestHandler):
    """Respond to request from the client"""

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
        except Exception as e:
            print("Connection ended prematurely", e)

    def do_GET(self):
        """Receive a GET request and respond with a console webpage"""

        # print("do_GET: ENTER")
        self.path = self.path.replace("%20", " ")
        # root_path = os.path.dirname(os.path.abspath(__file__))
        # print("  ", self.path)

        print(f" Active threads: {threading.active_count()}       ", end="\r", flush=True)
        if self.path == "/" or self.path.lower().endswith(".html"):
            # print("  Handling HTML file", self.path)
            user_file = True
            if self.path == "/":
                self.path = "setup.html"  # Load the setup webpage
                user_file = False
            elif self.path[0] == '/':
                self.path = self.path[1:]
            config.HELPING_REMOTE_CLIENT = True

            file_path = helper_files.get_path([self.path], user_file=user_file)
            try:
                with open(file_path, "r", encoding='UTF-8') as f:

                    page = str(f.read())
                    # Build the address that the webpage should contact to reach this helper
                    if self.address_string() == "127.0.0.1":
                        # Request is coming from this machine too
                        address_to_insert = \
                            f"'http://localhost:{config.defaults_dict['helper_port']}'"
                    else:  # Request is coming from the network
                        address_to_insert = f"'{get_local_address()}'"
                    # Then, insert that into the document
                    page = page.replace("INSERT_HELPERIP_HERE", address_to_insert)
                    try:
                        self.send_response(200)
                        self.send_header("Content-type", "text/html")
                        self.send_header("Access-Control-Allow-Origin", "*")
                        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
                        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
                        self.send_header('Access-Control-Allow-Credentials', 'true')
                        self.end_headers()
                        self.wfile.write(bytes(page, encoding="UTF-8"))
                    except BrokenPipeError:
                        print("Connection closed prematurely")

                    # print("do_GET: EXIT")
            except IOError:
                print(f"GET for unexpected file {self.path}")
                print("Cannot find it at:", file_path)
                try:
                    self.send_error(404, f"File Not Found: {self.path}")
                except BrokenPipeError:
                    pass
                # print("do_GET: EXIT")
        else:
            # Open the file requested and send it
            mimetype = mimetypes.guess_type(self.path, strict=False)[0]
            # print(f"  Handling {mimetype}")
            if self.path[0] == '/':
                self.path = self.path[1:]
            file_path = helper_files.get_path([self.path], user_file=True)
            try:
                # print(f"  Opening file {self.path}")
                with open(file_path, 'rb') as f:
                    # print(f"    File opened")
                    if "Range" in self.headers:
                        self.handle_range_request(f)
                    else:
                        try:
                            self.send_response(200)
                            self.send_header('Content-type', mimetype)
                            self.send_header("Access-Control-Allow-Origin", "*")
                            self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
                            self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
                            self.send_header('Access-Control-Allow-Credentials', 'true')
                            self.end_headers()
                            # print(f"    Writing data to client")
                            self.wfile.write(f.read())
                        except BrokenPipeError:
                            print("Connection closed prematurely")
                    # print(f"    Write complete")
                # print(f"  File closed")
                # print("do_GET: EXIT")
                return
            except IOError:
                print(f"GET for unexpected file {self.path}")
                try:
                    self.send_error(404, f"File Not Found: {self.path}")
                except BrokenPipeError:
                    pass
                # logging.error(f"GET for unexpected file {self.path}")
        # print("do_GET: EXIT")

    def do_OPTIONS(self):
        # print("do_OPTIONS: ENTER")
        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.end_headers()
        # print("do_OPTIONS: EXIT")

    def do_POST(self):
        """Receives pings from client devices and respond with any updated information"""

        print(f" Active threads: {threading.active_count()}       ", end="\r", flush=True)

        # print("do_POST: ENTER")
        # print(f"POST from: {self.client_address[0]}")

        self.send_response(200, "OK")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Credentials', 'true')
        self.end_headers()

        # Get the data from the request
        ctype, pdict = cgi.parse_header(self.headers.get('content-type'))

        if ctype == "multipart/form-data":  # File upload
            try:
                pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
                pdict['CONTENT-LENGTH'] = self.headers.get('Content-length')
                fields = cgi.parse_multipart(self.rfile, pdict)
                file = fields.get('file')[0]

                file_path = helper_files.get_path(["content", fields.get("filename")[0]], user_file=True)
                print(f"Saving uploaded file to {file_path}")
                with config.content_file_lock:
                    with open(file_path, "wb") as f:
                        f.write(file)
                mimetype = mimetypes.guess_type(file_path, strict=False)[0]
                if mimetype is not None:
                    helper_files.create_thumbnail(fields.get("filename")[0], mimetype.split("/")[0])

                json_string = json.dumps({"success": True})
            except Exception as e:
                print("Exception in multi-part form data:", type(e).__name__, e)
                json_string = json.dumps({"success": False})

            try:
                self.wfile.write(bytes(json_string, encoding="UTF-8"))
            except BrokenPipeError:
                pass

        elif ctype == "application/json":

            # Unpack the data
            length = int(self.headers['Content-length'])
            try:
                data_str = self.rfile.read(length).decode("utf-8")
            except ConnectionResetError:
                print("Error: connection reset by client")
                return

            try:  # JSON
                data = json.loads(data_str)
            except json.decoder.JSONDecodeError:  # not JSON
                data = {}
                split = data_str.split("&")
                for seg in split:
                    split2 = seg.split("=")
                    if len(split2) > 1:
                        data[split2[0]] = split2[1]

            if "action" in data:
                if data["action"] == "sleepDisplay":
                    sleep_display()
                elif data["action"] == "restart":
                    reboot()
                elif data["action"] in ["shutdown", "power_off"]:
                    shutdown()
                elif data["action"] in ["power_on", "wakeDisplay"]:
                    wake_display()
                elif data["action"] == "commandProjector":
                    if "command" in data:
                        command_projector(data["command"])
                elif data["action"] == "getDefaults":
                    config_to_send = config.defaults_dict.copy()
                    if "allow_restart" not in config_to_send:
                        config_to_send["allow_restart"] = "true"

                    # Add the current update availability to pass to the control server
                    config_to_send["helperSoftwareUpdateAvailable"] = \
                        str(config.helper_software_update_available).lower()

                    # Reformat this content list as an array
                    if "content" in config_to_send:
                        config_to_send['content'] = \
                            [s.strip() for s in config_to_send['content'].split(",")]

                    if config.dictionary_object is not None:
                        # If there are multiple sections, build a meta-dictionary
                        if len(config.dictionary_object.items()) > 1:
                            meta_dict = {"meta": True}
                            for item in config.dictionary_object.items():
                                name = item[0]
                                meta_dict[name] = dict(config.dictionary_object.items(name))
                            config_to_send["dictionary"] = meta_dict
                        else:
                            config_to_send["dictionary"] = \
                                dict(config.dictionary_object.items("CURRENT"))
                    config_to_send["availableContent"] = \
                        {"all_exhibits": helper_files.get_all_directory_contents()}

                    if config.HELPING_REMOTE_CLIENT:
                        # Files will be dispatched by the server
                        content_path = "content"
                    else:
                        # Files will be loaded directly by the client
                        content_path = helper_files.get_path(["content"], user_file=True)
                    config_to_send["contentPath"] = content_path
                    # config_to_send["helperAddress"] = get_local_address()
                    json_string = json.dumps(config_to_send)
                    try:
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
                elif data["action"] == "setDefaults":
                    if "defaults" not in data:
                        return
                    # Add the contents field, if it doesn't exist
                    if "config" not in data["defaults"] and "content" in config.defaults_dict:
                        (data["defaults"])["content"] = config.defaults_dict["content"]
                    set_defaults(data["defaults"])
                    # response = {"success": True, "helperAddress": get_local_address()}
                    # json_string = json.dumps(response)
                    # try:
                    #     self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    # except BrokenPipeError:
                    #     pass
                elif data["action"] == "updateDefaults":
                    # This action is for legacy support only. New applications should utilize the setDefaults action.
                    update_defaults(data)
                elif data["action"] == "getAvailableContent":
                    if "content" in config.defaults_dict:
                        active_content = [s.strip() for s in config.defaults_dict["content"].split(",")]
                    else:
                        active_content = ""
                    response = {"all_exhibits": helper_files.get_all_directory_contents(),
                                "thumbnails": helper_files.get_directory_contents("thumbnails"),
                                "active_content": active_content,
                                "system_stats": get_system_stats()}

                    json_string = json.dumps(response)
                    try:
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
                elif data["action"] == "getCurrentExhibit":
                    try:
                        self.wfile.write(bytes(config.defaults_dict["current_exhibit"],
                                               encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
                elif data["action"] == "deleteFile":
                    if "file" in data:
                        helper_files.delete_file(data["file"])
                        response = {"success": True}
                    else:
                        response = {"success": False,
                                    "reason": "Request missing field 'file'"}
                    json_string = json.dumps(response)
                    try:
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
                elif data["action"] == "updateClipList":
                    if "clipList" in data:
                        config.clipList["clipList"] = data["clipList"]
                elif data["action"] == "updateActiveClip":
                    if "index" in data:
                        config.clipList["activeClip"] = data["index"]
                elif data["action"] == "getClipList":

                    # If we don't have a clip list, ask for one to be sent for
                    # next time.
                    if len(config.clipList) == 0:
                        config.commandList.append("sendClipList")
                        try:
                            self.wfile.write(bytes(json.dumps([]), encoding="UTF-8"))
                        except BrokenPipeError:
                            pass
                    else:
                        json_string = json.dumps(config.clipList)
                        try:
                            self.wfile.write(bytes(json_string, encoding="UTF-8"))
                        except BrokenPipeError:
                            pass
                elif data["action"] == 'gotoClip':
                    if "clipNumber" in data:
                        config.commandList.append("gotoClip_" + str(data["clipNumber"]))
                elif data["action"] == "getUpdate":
                    response_dict = {"commands": config.commandList,
                                     "missingContentWarnings": config.missingContentWarningList}

                    # event_content = check_event_schedule()
                    # if event_content is not None:
                    #     response_dict["content"] = event_content

                    json_string = json.dumps(response_dict)
                    try:
                        self.wfile.write(bytes(json_string, encoding="UTF-8"))
                    except socket.error as e:
                        print("Socket error in getUpdate:", e)
                    except BrokenPipeError:
                        pass
                    config.commandList = []
                elif data["action"] == "setAutoplay":
                    if "state" in data:
                        if data["state"] == "on":
                            config.commandList.append("enableAutoplay")
                        elif data["state"] == "off":
                            config.commandList.append("disableAutoplay")
                        elif data["state"] == "toggle":
                            config.commandList.append("toggleAutoplay")
                elif data["action"] == "seekVideo":
                    if ("direction" in data) and ("fraction" in data):
                        config.commandList.append(f"seekVideo_{data['direction']}_{data['fraction']}")
                elif data["action"] == "pauseVideo":
                    config.commandList.append("pauseVideo")
                elif data["action"] == "playVideo":
                    config.commandList.append("playVideo")
                elif data["action"] == 'getLabelText':
                    if "lang" in data:
                        lang = data["lang"]
                    else:
                        lang = "en"
                    if "name" in data:
                        label_path = helper_files.get_path(["labels", config.defaults_dict["current_exhibit"], lang, data["name"]],
                                              user_file=True)

                        try:
                            with open(label_path, "r", encoding='UTF-8') as f:
                                label = f.read()
                        except FileNotFoundError:
                            print(
                                f"Error: Unknown label {data['name']} requested in language {lang} for exhibit {config.defaults_dict['current_exhibit']}")
                            return ()
                        try:
                            self.wfile.write(bytes(label, encoding="UTF-8"))
                        except BrokenPipeError:
                            pass
                    else:
                        print("Error: Label requested without name")
                else:
                    print("Error: unrecognized action:", data["action"])
        # print("do_POST: EXIT")


def check_for_software_update():
    """Download the version.txt file from GitHub and check if there is an update"""

    print("Checking for update... ", end="")
    try:
        for line in urllib.request.urlopen(
                "https://raw.githubusercontent.com/Cosmic-Chatter/Constellation/main/system_helper/version.txt",
                timeout=1):
            if float(line.decode('utf-8')) > config.HELPER_SOFTWARE_VERSION:
                config.helper_software_update_available = True
                break
    except urllib.error.HTTPError:
        print("cannot connect to update server")
        return
    except urllib.error.URLError:
        print("network connection unavailable")
        return
    if config.helper_software_update_available:
        print("update available!")
    else:
        print("up to date.")


def parse_byte_range(byte_range: str) -> tuple[int, int]:
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


def reboot():
    """Send an OS-appropriate command to restart the computer"""

    reboot_allowed = config.defaults_dict.get("allow_restart", "true")
    if reboot_allowed.lower() in ["true", "yes", '1', 1]:
        print("Rebooting...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to restart'")
        elif sys.platform == "linux":
            os.system("systemctl reboot -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -r")
    else:
        print("Restart requested but not permitted by defaults.ini. Set allow_restart = true to enable")


def shutdown():
    """Send an OS-appropriate command to shut down the computer.

    If shutdown is not allowed, call sleep_display() to put the display to sleep"""

    shutdown_allowed = config.defaults_dict.get("allow_shutdown", "false")
    sleep_allowed = config.defaults_dict.get("allow_sleep", "false")

    if shutdown_allowed.lower() in ["true", "yes", '1', 1]:
        print("Shutting down...")
        if sys.platform == "darwin":  # MacOS
            os.system("osascript -e 'tell app \"System Events\" to shutdown'")
        elif sys.platform == "linux":
            os.system("systemctl shutdown -i")
        elif sys.platform == "win32":
            os.system("shutdown -t 0 -s")
    elif sleep_allowed.lower() in ["true", "yes", '1', 1]:
        print("Shutdown requested but not permitted. Sleeping displays...")
        sleep_display()
    else:
        print(
            "Shutdown requested but not permitted by defaults.ini. Set allow_shutdown = true to enable or set allow_sleep to enable turning off the displays")


def sleep_display():
    if str_to_bool(config.defaults_dict.get("allow_sleep", True)):
        if sys.platform == "darwin":  # MacOS
            os.system("pmset displaysleepnow")
        elif sys.platform == "linux":
            os.system("xset dpms force off")
        elif sys.platform == "win32":
            nircmd_path = helper_files.get_path(["nircmd.exe"])
            os.system(nircmd_path + " monitor async_off")


def wake_display():
    """Wake the display up or power it on"""

    display_type = config.defaults_dict.get("display_type", "screen")

    if display_type == "screen":
        if sys.platform == "darwin":  # MacOS
            os.system("caffeinate -u -t 2")
        elif sys.platform == "linux":
            os.system("xset dpms force on")
        elif sys.platform == "win32":
            # os.system("nircmd.exe monitor async_on")
            nircmd_path = helper_files.get_path(["nircmd.exe"])
            os.system(nircmd_path + " sendkeypress ctrl")
    elif display_type == "projector":
        command_projector("on")


def command_projector(cmd: str):
    """Send commands to a locally-connected projector"""

    make = "Optoma"

    if make == "Optoma":
        ser = serial.Serial("/dev/ttyUSB0", 9600,
                            timeout=0,
                            parity=serial.PARITY_NONE,
                            stopbits=serial.STOPBITS_ONE,
                            bytesize=serial.EIGHTBITS)
        ser.reset_input_buffer()
        ser.reset_output_buffer()

        if cmd == "on":
            ser.write(b"~0000 1\r")
        elif cmd == "off":
            if str_to_bool(config.defaults_dict.get("allow_sleep", True)):
                ser.write(b"~0000 0\r")
        elif cmd == "checkState":
            ser.write(b"~00124 1\r")
            time.sleep(0.3)
            response = ser.readline()
            print(response)
        else:
            print(f"commandProjector: Error: Unknown command: {cmd}")


def get_local_address() -> str:
    """Return the IP address and port of this helper"""

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(0)
    try:
        # Doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except:
        IP = '127.0.0.1'
    finally:
        s.close()

    return "http://" + IP + ":" + str(config.defaults_dict["helper_port"])


def str_to_bool(val: str) -> bool:
    """Take a string value like "false" and convert it to a bool"""

    if isinstance(val, bool):
        val_to_return = val
    else:
        val = str(val).strip()
        if val in ["false", "False", 'FALSE']:
            val_to_return = False
        elif val in ["true", "True", 'TRUE']:
            val_to_return = True
        else:
            val_to_return = False
            print("strToBool: Warning: ambiguous string, returning False", val)
    return val_to_return


def get_system_stats() -> dict[str, Union[int, float]]:
    """Return a dictionary with disk space, CPU load, and RAM amount"""

    result = {}

    # Get the percentage the disk is full
    total, used, free = shutil.disk_usage(os.path.abspath(config.application_path))

    result["disk_pct_free"] = round((free / total) * 100)
    result["disK_free_GB"] = round(free / (2 ** 30))  # GB

    # Get CPU load (percent used in the last 1, 5, 15 min) Doesn't work on Windows
    if sys.platform != "win32":
        cpu_load = [x / psutil.cpu_count() * 100 for x in psutil.getloadavg()]
        result["cpu_load_pct"] = round(cpu_load[1])
    else:
        result["cpu_load_pct"] = 0

    # Get memory usage
    result["ram_used_pct"] = round(psutil.virtual_memory().percent)

    return result


# def perform_manual_content_update(content: list[str]):
#     """Take the given list of content and update the control server"""
#
#     # First, update the control server
#     request_dict = {"class": "webpage",
#                     "id": config.defaults_dict["id"],
#                     "action": "setComponentContent",
#                     "content": content}
#
#     headers = {'Content-type': 'application/json'}
#     ip_address = config.defaults_dict['server_ip_address']
#     port = config.defaults_dict['server_port']
#     requests.post(f"http://{ip_address}:{port}", headers=headers, json=request_dict)


# def retrieve_schedule():
#     """Search the schedules directory for an appropriate schedule"""
#
#     # Try several possible sources for the schedule with increasing generality
#     # root = os.path.dirname(os.path.abspath(__file__))
#     sources_to_try = [config.defaults_dict["current_exhibit"], "default"]
#     today_filename = datetime.datetime.now().date().isoformat() + ".ini"  # eg. 2021-04-14.ini
#     today_day_filename = datetime.datetime.now().strftime("%A").lower() + ".ini"  # eg. monday.ini
#     schedule_to_read = None
#
#     for source in sources_to_try:
#         sched_path = helper_files.get_path(["schedules", source], user_file=True)
#         try:
#             schedules = os.listdir(sched_path)
#             if today_filename in schedules:
#                 print("Found schedule", today_filename, "in", source)
#                 schedule_to_read = os.path.join(sched_path, today_filename)
#                 break
#             if today_day_filename in schedules:
#                 print("Found schedule", today_day_filename, "in", source)
#                 schedule_to_read = os.path.join(sched_path, today_day_filename)
#                 break
#             if "default.ini" in schedules:
#                 print("Found schedule default.ini in", source)
#                 schedule_to_read = os.path.join(sched_path, "default.ini")
#                 break
#         except FileNotFoundError:
#             pass
#
#     if schedule_to_read is not None:
#         parser = configparser.ConfigParser(delimiters="=")
#         parser.read(schedule_to_read)
#         if "SCHEDULE" in parser:
#             read_schedule(parser["SCHEDULE"])
#         else:
#             print("retrieve_schedule: error: no INI section 'SCHEDULE' found!")
#     else:
#         # Check again tomorrow
#         config.schedule = []
#         config.schedule.append((datetime.time(0, 1), ["reload_schedule"]))
#         print("No schedule for today. Checking again tomorrow...")


# def read_schedule(schedule_input):
#     """Parse the configParser section provided in schedule and convert it for later use"""
#
#     config.schedule = []
#     config.missingContentWarningList = []
#
#     content_path = helper_files.get_path(["content"], user_file=True)
#
#     for key in schedule_input:
#         event_time = dateutil.parser.parse(key).time()
#         content = [s.strip() for s in schedule_input[key].split(",")]
#         # Check to make sure that every file in the schedule actually exists.
#         # Otherwise, add it to the warning list to be passed to the control server
#         for item in content:
#             if not os.path.isfile(os.path.join(content_path, item)):
#                 config.missingContentWarningList.append(item)
#         config.schedule.append((event_time, content))
#
#     # Add an event at 12:01 AM to retrieve the new schedule
#     config.schedule.append((datetime.time(0, 1), ["reload_schedule"]))
#
#     queue_next_scheduled_event()


# def queue_next_scheduled_event():
#     """Cycle through the schedule and queue the next event"""
#
#     config.NEXT_EVENT = None
#
#     if config.schedule is not None:
#         sorted_sched = sorted(config.schedule)
#         now = datetime.datetime.now().time()
#
#         content_path = helper_files.get_path(["content"], user_file=True)
#
#         for event in sorted_sched:
#             event_time, content = event
#             # If the content was previously missing, see if it is still missing
#             # (the user may have fixed the problem)
#             for item in content:
#                 if item in config.missingContentWarningList:
#                     if os.path.isfile(os.path.join(content_path, item)):
#                         # It now exists; remove it from the warning list
#                         config.missingContentWarningList = [x for x in config.missingContentWarningList if x != item]
#             if now < event_time:
#                 config.NEXT_EVENT = event
#                 break


# def check_event_schedule():
#     """Check the NEXT_EVENT and see if it is time. If so, set the content"""
#
#     content_to_return = None
#     if config.NEXT_EVENT is not None:
#         event_time, content = config.NEXT_EVENT
#         # print("Checking for scheduled event:", content)
#         # print(f"Now: {datetime.now().time()}, Event time: {time}, Time for event: {datetime.now().time() > time}")
#         if datetime.datetime.now().time() > event_time:  # It is time for this event!
#             print("Scheduled event occurred:", event_time, content)
#             if content == ["reload_schedule"]:
#                 retrieve_schedule()
#             else:
#                 perform_manual_content_update(content)
#                 content_to_return = content
#             config.NEXT_EVENT = None
#
#     queue_next_scheduled_event()
#     return content_to_return


def read_default_configuration(check_directories: bool = True, dict_to_read: dict = None):
    """Load configuration parameters from defaults.ini"""

    config.defaults_object = configparser.ConfigParser(delimiters="=")

    if dict_to_read is not None:
        # Build the meta-dict required by configparser
        meta_dict = {"CURRENT": dict_to_read}
        config.defaults_object.read_dict(meta_dict)
    else:
        # Read defaults.ini
        defaults_path = os.path.join(config.application_path, "defaults.ini")
        if os.path.isfile(defaults_path):
            config.defaults_object.read(defaults_path)
        else:
            handle_missing_defaults_file()
            read_default_configuration(check_directories=check_directories, dict_to_read=dict_to_read)
            webbrowser.open(f"http://localhost:{config.defaults_dict['helper_port']}")
            return

    default = config.defaults_object["CURRENT"]
    config.defaults_dict = dict(default.items())

    if "autoplay_audio" in config.defaults_dict \
            and str_to_bool(config.defaults_dict["autoplay_audio"]) is True:
        print(
            "Warning: You have enabled audio. Make sure the file is whitelisted in the browser or media will not play.")

    # Make sure we have the appropriate file system set up
    if check_directories:
        helper_files.check_directory_structure()


def handle_missing_defaults_file():
    """Create a stub defaults.ini file and launch setup.html for configuration"""

    # Determine an available port
    port = 8000
    port_available = False
    while port_available is False:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind(("127.0.0.1", port))
            port_available = True
        except socket.error as e:
            if e.errno == errno.EADDRINUSE:
                port += 1
            else:
                # Something else raised the socket.error exception
                print(e)

        s.close()

    # Add bare-bones defaults to get things off the ground
    config.defaults_dict = {
        "id": "TEMP",
        "type": "TEMP",
        "current_exhibit": "default",
        "helper_port": port,
        "server_ip_address": "240.0.0.0",
        "server_port": 8082
    }
    config.defaults_object.read_dict({"CURRENT": config.defaults_dict})
    update_defaults(config.defaults_dict, force=True)


def set_defaults(defaults: dict):
    """Take a dictionary and write it to defaults.ini"""

    read_default_configuration(check_directories=False, dict_to_read=defaults)
    update_defaults(config.defaults_dict, force=True)


def update_defaults(data: dict, force: bool = False):
    """Take a dictionary 'data' and write relevant parameters to disk if they have changed."""

    update_made = force
    if "content" in data:
        if isinstance(data["content"], str):
            content = data["content"]
        elif isinstance(data["content"], list):
            content = ""
            for i in range(len(data["content"])):
                file = (data["content"])[i]
                if i != 0:
                    content += ', '
                content += file

        # If content has changed, update our configuration
        if ("content" not in config.defaults_dict) or (content != config.defaults_dict["content"]):
            config.defaults_object.set("CURRENT", "content", content)
            config.defaults_dict["content"] = content
            update_made = True
    if "current_exhibit" in data:
        if ("current_exhibit" not in config.defaults_dict) \
                or (data["current_exhibit"] != config.defaults_dict["current_exhibit"]):
            config.defaults_object.set("CURRENT", "current_exhibit", data["current_exhibit"])
            config.defaults_dict["current_exhibit"] = data["current_exhibit"]
            update_made = True

    # Update file
    if update_made:
        with config.defaults_file_lock:
            defaults_path = helper_files.get_path(['defaults.ini'], user_file=True)
            with open(defaults_path, 'w', encoding='UTF-8') as f:
                config.defaults_object.write(f)


def quit_handler(sig, frame):
    """Called when a user presses ctrl-c to shut down gracefully"""
    try:
        print('\nKeyboard interrupt detected. Cleaning up and shutting down...')
    except RuntimeError:
        # Handle race condition with print and shutdown
        pass
    with config.defaults_file_lock:
        with config.content_file_lock:
            sys.exit(0)


def load_dictionary():
    """Look for a file called dictionary.ini and load it if it exists"""

    dict_path = helper_files.get_path(["dictionary.ini"], user_file=True)

    if os.path.isfile(dict_path):
        config.dictionary_object = configparser.ConfigParser(delimiters="=")
        config.dictionary_object.optionxform = str  # Override the default, which is case-insensitive
        config.dictionary_object.read(dict_path)


if __name__ == "__main__":

    # Check whether we have packaged with Pyinstaller and set teh appropriate root path.
    config.exec_path = os.path.dirname(os.path.abspath(__file__))
    if getattr(sys, 'frozen', False):
        # If the application is run as a --onefile bundle, the PyInstaller bootloader
        # extends the sys module by a flag frozen=True and sets the app
        # path into variable sys.executable.
        config.application_path = os.path.dirname(sys.executable)
    else:
        config.application_path = config.exec_path

    signal.signal(signal.SIGINT, quit_handler)

    read_default_configuration()

    # Check for missing content thumbnails and create them
    helper_files.create_missing_thumbnails()

    # If it exists, load the dictionary that maps one value into another
    load_dictionary()

    # Look for an available schedule and load it
    # retrieve_schedule()

    # Check the GitHub server for an available software update
    check_for_software_update()

    print(f'Launching server at address {get_local_address()} to serve {config.defaults_dict["id"]}.')

    try:
        httpd = ThreadedHTTPServer(("", int(config.defaults_dict["helper_port"])), RequestHandler)
        httpd.serve_forever()
    except OSError as e:
        if e.errno == errno.EADDRINUSE:
            print(f"There is already a server at port {config.defaults_dict['helper_port']}! Shutting down...")
        else:
            print(f"Unexpected error: {e}")
