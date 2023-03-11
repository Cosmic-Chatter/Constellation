"""System Helper functions for managing files"""

# Standard modules
import glob
import json
import logging
import os
import subprocess
import sys
from typing import Any, Union

# Non-standard imports
import mimetypes
# from PIL import Image, UnidentifiedImageError
import pyffmpeg

# Constellation modules
import config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.application_path, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.exec_path, *path_list)

    return _path


def load_json(path: str):
    """Load the requested JSON file from disk and return it as a dictionary."""

    if not os.path.exists(path):
        if config.debug:
            print(f"load_json: file does not exist: {path}")
        return None

    with config.content_file_lock:
        with open(path, 'r', encoding='UTF-8') as f:
            try:
                result = json.load(f)
            except json.decoder.JSONDecodeError:
                result = None
            return result


def write_json(data, path: str, append: bool = False) -> None:
    """Take the given object and try to write it to a JSON file."""

    if append:
        mode = 'a'
    else:
        mode = 'w'

    with config.content_file_lock:
        with open(path, mode, encoding='UTF-8') as f:
            json.dump(data, f, indent=2, sort_keys=True)


def get_available_definitions(app_id: str = "all") -> dict[str, Any]:
    """Return all the *.json definition files that match the given app_id (or all of them)."""

    all_def = glob.glob(get_path(["definitions"], user_file=True) + "/*.json")
    to_return = {}
    for path in all_def:
        json_def = load_json(path)
        if json_def is not None:
            try:
                if app_id == "all" or json_def["app"] == app_id:
                    to_return[json_def["uuid"]] = json_def
            except KeyError:
                print("Error: Key not found: 'app'")

    return to_return


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    return os.path.splitext(filename)[0] + "." + ext


def delete_file(file: str, absolute: bool = False):
    """Delete a file"""

    if absolute:
        file_path = file
    else:
        file_path = get_path(["content", file], user_file=True)

    print("Deleting file:", file_path)
    with config.content_file_lock:
        os.remove(file_path)

    thumb_path, _ = get_thumbnail(file)
    if thumb_path is not None and os.path.exists(thumb_path):
        with config.content_file_lock:
            os.remove(thumb_path)


def rename_file(old_name: str, new_name: str, absolute: bool = False):
    """Rename the given file."""

    if absolute:
        old_path = old_name
        new_path = new_name
    else:
        old_path = get_path(["content", old_name], user_file=True)
        new_path = get_path(["content", new_name], user_file=True)

    # If there is already a file at new_path, fail so that we don't overwrite it.
    if os.path.exists(new_path):
        return {
            "success": False,
            "error": "file_exists",
            "reason": f"File {new_path} already exists."
        }

    thumb_path, _ = get_thumbnail(old_name)

    print(f"Renaming file {old_path} to {new_path}")
    logging.info("Renaming file %s to %s", old_path, new_path)

    try:
        with config.content_file_lock:
            os.rename(old_path, new_path)
            if thumb_path is not None:
                new_thumb = get_thumbnail_name(new_name)
                new_thumb_path = get_path(["thumbnails", new_thumb], user_file=True)
                os.rename(thumb_path, new_thumb_path)
    except FileExistsError:
        return {
            "success": False,
            "error": "file_exists",
            "reason": f"File {new_path} already exists."
        }
    except FileNotFoundError:
        return {
            "success": False,
            "error": "file_not_found",
            "reason": f"File {old_path} does not exist."
        }
    return {"success": True}


def create_thumbnail(filename: str, mimetype: str):
    """Create a thumbnail from the given media file and add it to the thumbnails directory.

    If the input is an image, a jpg is created. If the input is a video, a short preview gif is created."""

    try:
        ff = pyffmpeg.FFmpeg()
        if mimetype == "image":
            subprocess.call([ff.get_ffmpeg_bin(), "-y",
                             "-i", get_path(['content', filename], user_file=True),
                             "-vf", "scale=400:-1",
                             get_path(['thumbnails', with_extension(filename, 'jpg')], user_file=True)])
        elif mimetype == "video":
            # First, find the length of the video
            file_path = get_path(['content', filename], user_file=True)
            pipe = subprocess.Popen([ff.get_ffmpeg_bin(), "-i", file_path], stderr=subprocess.PIPE, encoding="UTF-8")
            ffmpeg_text = pipe.stderr.read()
            duration_index = ffmpeg_text.find("Duration")
            duration_str = ffmpeg_text[duration_index + 10: duration_index + 21]  # Format: HH:MM:SS.SS
            duration_split = duration_str.split(":")
            duration_sec = int(duration_split[0]) * 3600 + int(duration_split[1]) * 60 + round(
                float(duration_split[2]))
            subprocess.Popen([ff.get_ffmpeg_bin(), "-y",
                              "-i", file_path,
                              "-filter:v", f'fps=1,setpts=({min(duration_sec, 10)}/{duration_sec})*PTS,scale=400:-2',
                              "-an",
                              get_path(['thumbnails', with_extension(filename, 'mp4')], user_file=True)])

    except OSError as e:
        print("create_thumbnail: error:", e)
    except ImportError as e:
        print("create_thumbnail: error loading FFmpeg: ", e)


def get_thumbnail_name(filename: str) -> str:
    """Return the filename converted to the appropriate Constellation thumbnail format"""

    mimetype, _ = mimetypes.guess_type(filename)

    try:
        mimetype = mimetype.split("/")[0]
    except AttributeError:
        return ""
    if mimetype == "image":
        return with_extension(filename, "jpg")
    elif mimetype == "video":
        return with_extension(filename, "mp4")

    return ""


def get_thumbnail(filename: str) -> (Union[str, None], str):
    """Check the thumbnails directory for a file corresponding to the given filename and return its path and mimetype"""

    thumb_name = get_thumbnail_name(filename)
    mimetype, _ = mimetypes.guess_type(filename)
    try:
        mimetype = mimetype.split("/")[0]
    except AttributeError:
        pass

    if thumb_name == "":
        return None, mimetype

    thumb_path = get_path(["thumbnails", thumb_name], user_file=True)

    if not os.path.exists(thumb_path):
        return None, mimetype

    return thumb_path, mimetype


def create_missing_thumbnails():
    """Check the content directory for files without thumbnails and create them"""

    content = get_all_directory_contents("content")

    for file in content:
        file_path, mimetype = get_thumbnail(file)
        if file_path is None:
            create_thumbnail(file, mimetype)


def get_all_directory_contents(directory: str = "content") -> list:
    """Recursively search for files in the content directory and its subdirectories"""
    content_path = get_path([directory], user_file=True)
    result = [os.path.relpath(os.path.join(dp, f), content_path) for dp, dn, fn in os.walk(content_path) for f in fn]

    return [x for x in result if x.find(".DS_Store") == -1]


def get_directory_contents(directory: str, absolute: bool = False) -> list:
    """Return the contents of a directory."""

    if absolute:
        contents = os.listdir(directory)
    else:
        content_path = get_path([directory], user_file=True)
        contents = os.listdir(content_path)
    return [x for x in contents if x[0] != "."]  # Don't return hidden files


def check_directory_structure():
    """Make sure the appropriate content directories are present and create them if they are not."""

    dir_list = ["content", "definitions", "images", "static", "style", "text", "thumbnails", "thumbs", "videos"]

    for directory in dir_list:
        content_path = get_path([directory], user_file=True)
        try:
            os.listdir(content_path)
        except FileNotFoundError:
            print(f"Warning: {directory} directory not found. Creating it...")

            try:
                os.mkdir(content_path)
            except PermissionError:
                print("Error: unable to create directory. Do you have write permission?")


# Set up log file
log_path: str = get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
