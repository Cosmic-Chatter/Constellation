"""Functions enabling the Constellation Flexible Tracker and Flexible Voter"""

# Standard modules
import configparser
import json
import logging
import os

# Constellation modules
import config


def get_layout_definition(name, kind="flexible-tracker"):
    """Load a given INI file and return a dictionary defining a tracker template."""

    layout = configparser.ConfigParser(delimiters="=")
    layout_definition = {}
    success = True
    reason = ""
    try:
        template_path = os.path.join(config.APP_PATH, kind, "templates", name)
        layout.read(template_path)
        layout_definition = {s: dict(layout.items(s)) for s in layout.sections()}
    except configparser.DuplicateSectionError:
        success = False
        reason = "There are two sections with the same name!"

    return layout_definition, success, reason


def get_raw_text(name, kind='flexible-tracker'):
    """Return the contents of a text file."""

    file_path = os.path.join(config.APP_PATH, kind, "data", name)
    success = True
    reason = ""
    result = ""

    try:
        with config.trackingDataWriteLock:
            with open(file_path, "r", encoding='UTF-8') as f:
                result = f.read()
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} not found."
    except PermissionError:
        success = False
        reason = f"You do not have read permission for the file {file_path}"

    return result, success, reason


def write_JSON(data, file_path):
    """Take an object, convert it to JSON and append it to the appropriate file."""

    # file_path = os.path.join(config.APP_PATH, kind, "data", name)
    success = True
    reason = ""

    try:
        with config.trackingDataWriteLock:
            with open(file_path, "a", encoding='UTF-8') as f:
                json_str = json.dumps(data)
                f.write(json_str + "\n")
    except TypeError:
        success = False
        reason = "Data is not JSON serializable"
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason


def write_raw_text(data, name, kind="flexible-tracker"):
    """Write an un-formatted string to file"""

    file_path = os.path.join(config.APP_PATH, kind, "data", name)
    success = True
    reason = ""

    try:
        with config.trackingDataWriteLock:
            with open(file_path, "a", encoding="UTF-8") as f:
                f.write(data["text"] + "\n")
    except FileNotFoundError:
        success = False
        reason = f"File {file_path} does not exist"
    except PermissionError:
        success = False
        reason = f"You do not have write permission for the file {file_path}"

    return success, reason

# Set up log file
log_path = os.path.join(config.APP_PATH, "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)