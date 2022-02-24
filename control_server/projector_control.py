"""Communicate with projectos using PJLink or serial commands"""

# Standard imports
import platform

# Non-standard imports
import serial
import pypjlink

def serial_connect_with_url(ip,
                            baudrate=9600,
                            make=None,
                            port=None,
                            protocol='socket',
                            timeout=4):

    """Establish a serial connection over TCP/IP"""

    if (port is None) and (make is None):
        raise Exception("Must specifiy either a port or a make")
    if port is None:

        port_dict = {"barco": 1025,
                     "christie": 3002,
                     "viewsonic": 8899}

        if make.lower() in port_dict:
            port = port_dict[make.lower()]

    try:
        connection = serial.serial_for_url(protocol + "://" + ip + ":" + str(port),
                                    baudrate=baudrate,
                                    timeout=timeout)
        return connection
    except serial.serialutil.SerialException:
        return None


def serial_connect(baudrate=9600,
                   bytesize=serial.EIGHTBITS,
                   parity=serial.PARITY_NONE,
                   port=None,
                   stopbits=serial.STOPBITS_ONE,
                   timeout=2):

    """Connect to a serial device connected to the machine"""

    if port is None:
        # Assume we're using the default USB port for our platform

        system = platform.system()
        if system == "Linux":
            port = "/dev/ttyUSB0"
        elif system == "Darwin": # MacOS
            port = "/dev/ttyUSB0"
        elif system == "Windows":
            port = "COM1"
        else:
            raise Exception(f"Platform {system} is unknown: you must specify port=")

    try:
        connection = serial.Serial(port,
                                   baudrate,
                                   timeout=timeout,
                                   parity=parity,
                                   stopbits=stopbits,
                                   bytesize=bytesize)
        return connection
    except serial.serialutil.SerialException:
        return None


def serial_send_command(connection, command, char_to_read=None, debug=False, make=None):

    """Send a command to a projector, wait for a response and return that response"""

    command_dict = {
        "error_status": {
            "barco": (lambda x: {'other': "ok"}),
            "christie": (lambda x: {'other': "ok"}),
            "optoma": (lambda x: {'other': "ok"}),
            "viewsonic": (lambda x: {'other': "ok"}),
        },
        "get_source": {
            "barco": serial_barco_get_source,
        },
        "get_model": {
            "barco": (lambda x: "Barco"),
            "christie": (lambda x: "Christie"),
            "optoma": (lambda x: "Optoma"),
            "viewsonic": (lambda x: "Viewsonic"),
        },
        "lamp_status": {
            "barco": serial_barco_lamp_status,
            "christie": serial_christie_lamp_status,
        },
        "power_off": {
            "barco": ":POWR0\r",
            "christie": "(PWR0)",
            "optoma": "~0000 0\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x11\x01\x00\x5E",
        },
        "power_on": {
            "barco": ":POWR1\r",
            "christie": "(PWR1)",
            "optoma": "~0000 1\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x11\x00\x00\x5D"
        },
        "power_state": {
            "barco": ":POST?\r",
            "christie": serial_christie_power_state,
            "optoma": "~00124 1\r",
            "viewsonic": "\x07\x14\x00\x05\x00\x34\x00\x00\x11\x00\x5E"
        },
        "set_dvi_1": {
            "barco": ":IDVI1\r",
        },
        "set_dvi_2": {
            "barco": ":IDVI2\r",
        },
        "set_hdmi_1": {
            "barco": ":IHDM1\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x13\x01\x03\x63",
        },
        "set_hdmi_2": {
            "barco": ":IHDM2\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x13\x01\x07\x67",
        },
        "set_vga_1": {
            "barco": ":IVGA1\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x13\x01\x00\x60",
        },
        "set_vga_2": {
            "barco": ":IVGA2\r",
            "viewsonic": "\x06\x14\x00\x04\x00\x34\x13\x01\x08\x68",
        },
        "shutter_close": {
            "christie": "(SHU1)",
        },
        "shutter_open": {
            "christie": "(SHU0)",
        },
        "shutter_state": {
            "christie": serial_christie_shutter_state,
        },
        "video_mute": {
            "christie": "(PMT1)",
        },
        "video_mute_state": {
            "christie": serial_christie_video_mute_state,
        },
        "video_unmute": {
            "christie": "(PMT0)",
        },
    }

    response_dict = {
        "power_state": {
            "barco": {
                "%001 POST 000000": "off",
                "%001 POST 000001": "off",
                "%001 POST 000002": "powering_on",
                "%001 POST 000003": "on",
                "%001 POST 000004": "powering_off",
                "%001 POST 000008": "powering_off"
            },
            "viewsonic": {
                '\x05\x14\x00\x03\x00\x00\x00\x00\x18': "on",
                '\x05\x14\x00\x03\x00\x00\x00\x01\x18': "on",
                '\x05\x14\x00\x03\x00\x00\x00\x00\x17': "off",
            }
        }
    }

    if (command.lower() in command_dict) and (make is None):
        raise Exception("You must specify a projector make to use a command alias")

    command_to_send = None
    if debug:
        print(command)
    if command.lower() in command_dict:
        if debug:
            print("Command in command_dict")
        # First look up the command alias
        cmd_alias = command_dict[command.lower()]
        # Then, find the make-specific command
        if make.lower() in cmd_alias:
            if debug:
                print(f"Make {make} in cmd_alias")
            command_to_send = cmd_alias[make.lower()]
            if debug:
                print(f"command_to_send: {command_to_send}")
            # If this command is a function, call it instead of continuing
            if callable(command_to_send):
                connection.reset_input_buffer()
                response = command_to_send(connection)
                return response
    else:
        # We've been given a custom command
        command_to_send = command

    if command_to_send is not None:
        # Make sure we've flushed out any prior input before we write/read
        connection.reset_input_buffer()

        connection.write(bytes(command_to_send, 'UTF-8'))
        if char_to_read is None:
            response = connection.readline().decode("UTF-8").strip()
        else:
            response = connection.read(int(char_to_read)).decode("UTF-8").strip()

        if make is not None:
            if command.lower() in response_dict:
                responses_by_make = response_dict[command.lower()]
                if make.lower() in responses_by_make:
                    responses = responses_by_make[make.lower()]
                    if response in responses:
                        response = responses[response]
    else:
        if debug:
            print(f"Command alias {command} not found for make {make}")
        return ""

    return response


def serial_barco_lamp_status(connection):

    """Build the lamp status list for a Barco projector
    This list has format [(lamp1_hours, lamp1_on), (lamp2_hours, lamp2_on)]"""

    connection.reset_input_buffer()

    # True means lamp is on (or warming up)
    lamp_status_codes = {
    "0": False,
    "1": True,
    "2": True,
    "3": False,
    "4": False,
    }

    lamp_status = []

    l1_hours_response = serial_send_command(connection, ":LTR1?\r")
    l1_hours = int(l1_hours_response[10:])
    l1_state_response = serial_send_command(connection, ":LST1?\r")
    l1_state = l1_state_response[-1]
    l2_hours_response = serial_send_command(connection, ":LTR2?\r")
    l2_hours = int(l2_hours_response[10:])
    l2_state_response = serial_send_command(connection, ":LST2?\r")
    l2_state = l2_state_response[-1]

    if l1_state != '5':
        lamp_status.append((l1_hours, lamp_status_codes[l1_state]))
    if l2_state != '5':
        lamp_status.append((l2_hours, lamp_status_codes[l2_state]))

    return lamp_status


def serial_barco_get_source(connection):

    """Iterate through the Barco inputs to find the one that is active"""

    connection.reset_input_buffer()

    # (Barco name, English name, number)
    inputs = [("IDVI", "DVI"),("IHDM", "HDMI"), ("IVGA", "VGA"),("IDHD", "Dual Head DVI"),
                ("IDHH", "Dual Head HDMI"),("IDHX", "Dual Head XP2"), ("IXP2", "XP2"),
                ("IYPP", "Component")]

    for this_input in inputs:
        code, name = this_input
        response = serial_send_command(connection, ":" + code + "?\r")
        if len(response) > 0:
            num = response[-1]
            if num != "0":
                return name + " " + num

    return ""


def serial_christie_lamp_status(connection):

    """Build the lamp status list for a Christie projector
    This list has format [(lamp1_hours, lamp1_on), (lamp2_hours, lamp2_on)]"""

    connection.reset_input_buffer()

    # Get lamp hours
    l1_hours_response = serial_send_command(connection, "(LPH?)", char_to_read=23)
    try:
        l1_hours = int(l1_hours_response[17:22])
        connection.reset_input_buffer()
    except Exception as e:
        print(e)
        l1_hours = -1
    return [(l1_hours, None)]


def serial_christie_power_state(connection):

    """Ask a Christie projector for its power state and parse the response"""

    connection.reset_input_buffer()

    response = serial_send_command(connection, "(PWR?)", char_to_read=21)
    result = None
    if len(response) > 0:
        if "PWR!001" in response:
            result = "on"
        if "PWR!000" in response:
            result = "off"
        if "PWR!010" in response:
            result = "powering_off"
        if "PWR!011" in response:
            result = "powering_on"
    return result


def serial_christie_shutter_state(connection):

    """Ask a Christie projector for the status of its shutter"""

    connection.reset_input_buffer()

    response = serial_send_command(connection, "(SHU?)", char_to_read=21)
    result = "unknown"
    if "SHU!000" in response:
        result = "open"
    if "SHU!001" in response:
        result = "closed"
    return result


def serial_christie_video_mute_state(connection):

    """Ask a Christie projector for the status of its video mute"""

    connection.reset_input_buffer()

    response = serial_send_command(connection, "(PMT?)", char_to_read=21)
    result = "unknown"
    if "PMT!000" in response:
        result = "unmuted"
    if "PMT!001" in response:
        result = "muted"
    return result


def pjlink_connect(ip, password=None, timeout=2):

    """Connect to a PJLink projector using pypjlink"""

    projector = pypjlink.Projector.from_address(ip, timeout=timeout)
    projector.authenticate(password=password)

    return projector


def pjlink_send_command(connection, command):

    """Send a command using the PJLink protocol"""

    result = None
    if command == "error_status":
        result = connection.get_errors()
    elif command == "get_model":
        result = connection.get_manufacturer() + " " + connection.get_product_name()
    elif command == "lamp_status":
        result = connection.get_lamps()
    elif command == "power_off":
        connection.set_power("off")
        result = "off"
    elif command == "power_on":
        connection.set_power("on")
        result = "on"
    elif command == "power_state":
        result = connection.get_power()
    else:
        print(f"Command alias {command} not found for PJLink")
    return result
