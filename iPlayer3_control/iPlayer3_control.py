"""A module for communicating with the iPlayer 3 DMX controller
"""

# Standard modules
import time
import platform

# External modules
import serial

def connect(port=None):

    """Establish a serial connection"""

    if port is None:
        system = platform.system()
        if system == "Linux":
            port = "/dev/ttyUSB0"
        elif system == "Darwin": # MacOS
            port = "/dev/ttyUSB0"
        elif system == "Windows":
            port = "COM1"
        else:
            raise Exception(f"Platform {system} is unknown: you must specify port=")

    connection = serial.Serial(port, 9600,
                               timeout=.01,
                               parity=serial.PARITY_NONE,
                               stopbits=serial.STOPBITS_ONE,
                               bytesize=serial.EIGHTBITS)
    return connection

def trigger_show(connection, show_number, await_response=False):

    """Send a serial command over the given connection to trigger playback of the given show."""

    command = "X04" + hex(show_number)[2:].upper().rjust(2,'0')
    connection.write(bytes(command, 'UTF-8'))
    if await_response:
        response = connection.readline().decode("UTF-8").strip()
        return response

    return True

def lights_off(connection, await_response=False):

    """Send a serial command over the given connection to turn off all lights"""

    command = "X0100"

    connection.write(bytes(command, 'UTF-8'))
    if await_response:
        response = connection.readline().decode("UTF-8").strip()
        return response == "Y0100"

    return True

def set_absolute_intensity(connection, val, await_response=False):

    """Send a serial command over the given connection to set the overall intensity.

    val should be in the range [0:1] or [1:100]
    """

    if 1 < val <= 100:
        val = val / 100
    elif val > 100:
        print("set_intensity: error: must use a value between 0 and 1 or 1 and 100")
        return False

    # Scale to 0 - 255
    setting = int(val*255)

    command = "X02" + hex(setting)[2:].upper().rjust(2,'0')

    connection.write(bytes(command, 'UTF-8'))
    if await_response:
        response = connection.readline().decode("UTF-8").strip()
        return response.startswith("Y02")

    return True

def fade_to_black(connection):

    """Transition from the current brightness to zero in a smooth fade"""

    command = "X03FE" # Lowers by 2 points

    # Loop until the number is 0
    i = 0
    while i < 128:
        connection.write(bytes(command, 'UTF-8'))
        i += 1
        time.sleep(0.03)

    return True

def fade_to_bright(connection):

    """Transition from the current brightness to max in a smooth fade"""

    command = "X0301" # Lowers by 2 points

    # Loop until the number is 0
    i = 0
    while i < 255:
        connection.write(bytes(command, 'UTF-8'))
        time.sleep(0.03)
        i += 1
    return True
