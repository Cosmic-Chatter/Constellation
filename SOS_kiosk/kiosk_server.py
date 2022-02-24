"""This application sets up a small server to communicate with the screen players
and handle interacting with the system (since the browser cannot)
"""

# Standard module imports
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import time
import json
import sys
import os
import signal
import threading
from pathlib import Path
import mimetypes

# Non-standard modules
import requests
from sockio.sio import TCP

# Constellation modules -- copy these from the system_helper module
import helper
import config

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Stub which triggers dispatch of requests into individual threads."""
    daemon_threads = True

class RequestHandler(SimpleHTTPRequestHandler):

    """Handle incoming server requests"""

    def log_request(self, code='-', size='-'):

        """Override to suppress the automatic logging"""

    def do_GET(self):

        """Receive a GET request and respond appropriately"""

        if DEBUG:
            print("GET received: ", self.path)

        print(f" Active threads: {threading.active_count()}      ", end="\r", flush=True)

        if self.path == "/":
            self.path = "/SOS_kiosk.html"

        # Open the static file requested and send it
        try:
            mimetype = mimetypes.guess_type(self.path, strict=False)[0]
            self.send_response(200)
            self.send_header('Content-type', mimetype)
            self.end_headers()
            with open('.' + self.path, 'rb') as f:
                self.wfile.write(f.read())
        except FileNotFoundError:
            print(f"Error: could not find file {self.path}")
        except BrokenPipeError:
            pass
        if DEBUG:
            print("GET complete")

    def do_OPTIONS(self):

        """Respond to OPTIONS requests"""

        if DEBUG:
            print("DO_OPTIONS")

        try:
            self.send_response(200, "OK")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.end_headers()
        except BrokenPipeError:
            pass

        if DEBUG:
            print("DO_OPTIONS complete")

    def do_POST(self):

        """Receives pings from client devices and respond with any updated information"""

        if DEBUG:
            print("POST Received", flush=True)

        print(f" Active threads: {threading.active_count()}      ", end="\r", flush=True)

        try:
            self.send_response(200, "OK")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
            self.send_header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
            self.send_header('Access-Control-Allow-Credentials', 'true')
            self.end_headers()
        except BrokenPipeError:
            pass

        # Get the data from the request
        length = int(self.headers['Content-length'])
        data_str = self.rfile.read(length).decode("utf-8")

        # Unpack the data
        try: # JSON
            data = json.loads(data_str)
        except json.decoder.JSONDecodeError: # not JSON
            data = {}
            split = data_str.split("&")
            for seg in split:
                split2 = seg.split("=")
                if len(split2) > 1:
                    data[split2[0]] = split2[1]

        if "action" in data:
            if DEBUG:
                print(f'  {data["action"]}')
            if data["action"] == "getDefaults":
                config_to_send = dict(config.defaults_dict.items())

                if config.dictionary_object is not None:
                    config_to_send["dictionary"] = dict(config.dictionary_object.items("CURRENT"))

                json_string = json.dumps(config_to_send)
                try:
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "updateDefaults":
                if DEBUG:
                    print("    waiting for defaultWriteLock")
                with defaultWriteLock:
                    helper.update_defaults(data)
                if DEBUG:
                    print("    defaultWriteLock released")
            elif data["action"] == "deleteFile":
                if "file" in data:
                    helper.delete_file(os.path.join("/",
                                                    "home",
                                                    "sos",
                                                    "sosrc",
                                                    data["file"]),
                                       absolute=True)
                    response = {"success": True}
                else:
                    response = {"success": False,
                                "reason": "Request missing field 'file'"}
                json_string = json.dumps(response)
                try:
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "restart":
                helper.reboot()
            elif data["action"] in ["shutdown", "power_off"]:
                helper.shutdown()
            elif data["action"] == "SOS_getCurrentClipName":
                current_clip = send_SOS_command("get_clip_number")
                dataset = send_SOS_command("get_clip_info " + current_clip)

                try:
                    self.wfile.write(bytes(dataset, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "SOS_getClipList":
                # First, get a list of clips
                reply = send_SOS_command("get_clip_info *", multiline=True)
                split = reply.split('\r\n')
                clip_list = []
                for segment in split:
                    split2 = segment.split(" ")
                    clip_list.append(" ".join(split2[1:]))

                # Then, get other improtant info
                clip_dict_list = []
                counter = 1
                for clip in clip_list:
                    if clip != '':
                        temp = {'name': clip, 'clipNumber': counter}
                        path = send_SOS_command(f"get_clip_info {counter} clip_filename")
                        split = path.split('/')
                        try:
                            if split[-2] == "playlist":
                                icon_root = '/'.join(split[:-2])
                            else:
                                icon_root = '/'.join(split[:-1])
                        except IndexError:
                            print(f"Clip path error: {path}")

                        icon_path = icon_root + '/media/thumbnail_big.jpg'
                        filename = ''.join(e for e in clip if e.isalnum()) + ".jpg"
                        temp["icon"] = filename
                        # Cache the icon locally for use by the app.
                        os.system(f'cp "{icon_path}" ./thumbnails/{filename}')

                        clip_dict_list.append(temp)
                    counter += 1
                json_string = json.dumps(clip_dict_list)
                try:
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "SOS_getPlaylistName":
                reply = send_SOS_command("get_playlist_name")
                playlist = reply.split("/")[-1]
                try:
                    self.wfile.write(bytes(playlist, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "SOS_openPlaylist":
                if "name" in data:
                    SOS_open_playlist(data["name"])
            elif data["action"] == "SOS_getState":
                reply = send_SOS_command("get_state 0")

                # Parse the response (with nested braces) and build a dictionary
                state_dict = {}
                segment_list = []

                for char in reply:
                    if char == '{':
                        segment_list.append([])
                    elif char == '}':
                        if len(segment_list) == 1:
                            # Key-value are separated by a space
                            segment = ''.join(segment_list.pop())
                            split = segment.split(" ")
                            state_dict[split[0]] = split[1]
                        elif len(segment_list) == 2:
                            # Key-value are separated into two lists
                            key = ''.join(segment_list[0])
                            value = ''.join(segment_list[1])
                            state_dict[key] = value
                            segment_list = []
                        elif len(segment_list) > 2:
                            print("Error parsing state: too many nested braces")
                    else:
                        if len(segment_list) > 0:
                            segment_list[-1].append(char)

                json_string = json.dumps(state_dict)
                try:
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            elif data["action"] == "SOS_gotoClip":
                if "clipNumber" in data:
                    send_SOS_command("play " + data["clipNumber"])
            elif data["action"] == "SOS_moveSphere":
                if ("dLat" in data) and ("dLon" in data):
                    tilt = send_SOS_command("get_tilt")
                    split = tilt.split(' ')
                    tilt_x = float(split[0])
                    tilt_y = float(split[1])
                    tilt_z = float(split[2])
                    dLat = float(data["dLat"])
                    dLon = float(data["dLon"])

                    send_SOS_command(f"set_tilt {tilt_x} {tilt_y + dLat/2} {tilt_z + dLon/2}")
            elif data["action"] == "SOS_rotateX":
                if "increment" in data:
                    tilt = send_SOS_command("get_tilt")
                    split = tilt.split(' ')
                    tilt_x = float(split[0])
                    tilt_y = float(split[1])
                    tilt_z = float(split[2])
                    dX = float(data['increment'])

                    send_SOS_command(f"set_tilt {tilt_x + dX} {tilt_y} {tilt_z}")
            elif data["action"] == "SOS_rotateY":
                if "increment" in data:
                    tilt = send_SOS_command("get_tilt")
                    split = tilt.split(' ')
                    tilt_x = float(split[0])
                    tilt_y = float(split[1])
                    tilt_z = float(split[2])
                    dY = float(data['increment'])

                    send_SOS_command(f"set_tilt {tilt_x} {tilt_y + dY} {tilt_z}")
            elif data["action"] == "SOS_rotateZ":
                if "increment" in data:
                    tilt = send_SOS_command("get_tilt")
                    split = tilt.split(' ')
                    tilt_x = float(split[0])
                    tilt_y = float(split[1])
                    tilt_z = float(split[2])
                    dZ = float(data['increment'])

                    send_SOS_command(f"set_tilt {tilt_x} {tilt_y} {tilt_z + dZ}")
            elif data["action"] == "SOS_startAutorun":
                send_SOS_command("set_auto_presentation_mode 1")
            elif data["action"] == "SOS_stopAutorun":
                send_SOS_command("set_auto_presentation_mode 0")
            elif data["action"] == "SOS_readPlaylist":
                if "playlistName" in data:
                    reply = send_SOS_command(f"playlist_read {data['playlistName']}", multiline=True)
                    try:
                        self.wfile.write(bytes(reply, encoding="UTF-8"))
                    except BrokenPipeError:
                        pass
            elif data["action"] == 'getAvailableContent':
                active_content = \
                    [s.strip() for s in config.defaults_dict.get("content", "").split(",")]
                all_content = list(Path("/home/sos/sosrc/").rglob("*.[sS][oO][sS]"))
                response = {"all_exhibits": [str(os.path.relpath(x, '/home/sos/sosrc/')) for x in all_content],
                            "active_content": active_content,
                            "system_stats": helper.getSystemStats()}
                json_string = json.dumps(response)
                try:
                    self.wfile.write(bytes(json_string, encoding="UTF-8"))
                except BrokenPipeError:
                    pass
            else:
                print(f"Warning: action {data['action']} not recognized!")
        if DEBUG:
            print("POST complete")


def send_SOS_command(cmd, multiline=False):

    """Send a command to Science on a Sphere adn read its response"""

    if DEBUG:
        print("    send_SOS_command:", cmd)

    global SOS_SOCKET

    try:
        if not multiline:
            return SOS_SOCKET.write_readline(bytes(cmd + '\n', encoding='UTF-8')).decode('UTF-8').strip()
        SOS_SOCKET.write(bytes(cmd + '\n', encoding='UTF-8'))
        return(SOS_SOCKET.read(10000).decode("UTF-8"))
    except Exception as e:
        print(e)
        SOS_SOCKET = connect_to_SOS()
    return ""

def sendPing():

    """Send a heartbeat message to the control server and process any response"""

    if DEBUG:
        print("Sending ping")

    allowed_actions = {"restart": config.defaults_dict.get("allow_restart", "true"),
                       "shutdown": config.defaults_dict.get("allow_shutdown", "false")
                      }

    headers = {'Content-type': 'application/json'}
    request_dict = {"class": "exhibitComponent",
                   "id": config.defaults_dict["id"],
                   "type": config.defaults_dict["type"],
                   "allowed_actions": allowed_actions}

    server_full_address = f"http://{str(config.defaults_dict['server_ip_address'])}:{str(config.defaults_dict['server_port'])}"

    try:
        response = requests.post(server_full_address, headers=headers, json=request_dict, timeout=1)
    except:
        type, value, traceback = sys.exc_info()
        print("Error sending request", type, value)
        return()

    updates = response.json()

    if "content" in updates:
        content = (updates["content"])[0] # No support for multiple files
        updates["content"] = [content]
        if content != config.defaults_dict.get("content", ""):
            print("new content detected:", content)
            SOS_open_playlist(content)

    if DEBUG:
        print("    waiting for defaultWriteLock")
    with defaultWriteLock:
        helper.update_defaults(updates)
    if DEBUG:
        print("    defaultWriteLock released")
        print("Ping complete")

def send_ping_at_interval():

    """Send a ping, then spawn a thread that will call this function again"""

    global PING_THREAD

    sendPing()
    PING_THREAD = threading.Timer(5, send_ping_at_interval)
    PING_THREAD.start()

def SOS_open_playlist(content):

    """Send an SOS command to change to the specified playlist"""

    send_SOS_command("open_playlist " + content)
    send_SOS_command("play 1")

def quit_handler(*args):

    """Stop threads, shutdown connections, etc."""

    print('\nKeyboard interrupt detected. Cleaning up and shutting down...')

    if PING_THREAD is not None:
        PING_THREAD.cancel()
    if SOS_SOCKET is not None:
        SOS_SOCKET.write(b'exit\n')
    sys.exit(0)

def connect_to_SOS():

    """Establish a connection with the Science on a Sphere application"""

    while True:
        # Sleep for 5 seconds so that we don't spam the connection
        print("Connecting in 5 seconds...")
        time.sleep(5)

        try:
            # Send Science on a Sphere command to begin communication
            socket = TCP(config.defaults_dict["sos_ip_address"], 2468)
            socket.write_readline(b'enable\n')
            print("Connected!")
            break
        except ConnectionRefusedError as e:
            print("Error: Connection with Science on a Sphere failed to initialize. Make sure you have specificed sos_ip_address in defaults.ini, both computers are on the same network (or are the same machine), and port 2468 is accessible.")
            if DEBUG:
                print(e)

    return socket

signal.signal(signal.SIGINT, quit_handler)

DEBUG = False

# Threading resources
PING_THREAD = None
defaultWriteLock = threading.Lock()

helper.read_default_configuration(checkDirectories=False)
helper.load_dictionary()

SOS_SOCKET = connect_to_SOS()

send_ping_at_interval()

httpd = ThreadedHTTPServer(("", int(config.defaults_dict["helper_port"])), RequestHandler)
httpd.serve_forever()
