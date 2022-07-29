"""System Helper functions for managing files"""

# Standard modules
import os
import sys
from typing import Union

# Non-standard imports
import mimetypes

# Constellation modules
import config


def get_path(path_list: list[str], user_file: bool = False) -> str:
    """Return a path that takes into account whether the app has been packaged by Pyinstaller"""

    _path = os.path.join(config.application_path, *path_list)
    if getattr(sys, 'frozen', False) and not user_file:
        # Handle the case of a Pyinstaller --onefile binary
        _path = os.path.join(config.exec_path, *path_list)

    return _path


def with_extension(filename: str, ext: str) -> str:
    """Return the filename with the current extension replaced by the given one"""

    if ext.startswith("."):
        ext = ext[1:]

    split = filename.split(".")
    return ".".join(split[0:-1]) + "." + ext


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


def get_thumbnail(filename: str) -> (Union[str, None], str):
    """Check the thumbnails directory for a file corresponding to the given filename and return its path and mimetype"""

    mimetype, _ = mimetypes.guess_type(filename)
    mimetype = mimetype.split("/")[0]
    if mimetype == "image":
        thumb_path = get_path(["thumbnails", with_extension(filename, "jpg")], user_file=True)
    elif mimetype == "video":
        thumb_path = get_path(["thumbnails", with_extension(filename, "mp4")], user_file=True)
    else:
        thumb_path = None

    if thumb_path is not None and not os.path.exists(thumb_path):
        thumb_path = None

    return thumb_path, mimetype
