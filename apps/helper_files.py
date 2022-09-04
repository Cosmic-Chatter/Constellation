"""System Helper functions for managing files"""

# Standard modules
import configparser
import os
import subprocess
import sys
from typing import Union

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


def create_thumbnail(filename: str, mimetype: str):
    """Create a thumbnail from the given media file and add it to the thumbnails directory.

    If the input is an image, a jpg is created. If the input is a video, a short preview gif is created."""

    with config.content_file_lock:
        # try:
        #     image = Image.open(helper_files.get_path(["content", filename], user_file=True))
        # except UnidentifiedImageError:
        #     pass
        # max_size = (400, 400)
        #
        # image.thumbnail(max_size, resample=Image.LANCZOS, reducing_gap=3.0)
        # image = image.convert('RGB')
        # image.save(helper_files.get_path(["thumbnails", helper_files.with_extension(filename, "jpg")], user_file=True))

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


def load_dictionary():
    """Look for a file called dictionary.ini and load it if it exists"""

    dict_path = get_path(["dictionary.ini"], user_file=True)

    if os.path.isfile(dict_path):
        config.dictionary_object = configparser.ConfigParser(delimiters="=")
        config.dictionary_object.optionxform = str  # Override the default, which is case-insensitive
        config.dictionary_object.read(dict_path)


def get_thumbnail(filename: str) -> (Union[str, None], str):
    """Check the thumbnails directory for a file corresponding to the given filename and return its path and mimetype"""

    mimetype, _ = mimetypes.guess_type(filename)
    try:
        mimetype = mimetype.split("/")[0]
    except AttributeError:
        mimetype = None
    if mimetype == "image":
        thumb_path = get_path(["thumbnails", with_extension(filename, "jpg")], user_file=True)
    elif mimetype == "video":
        thumb_path = get_path(["thumbnails", with_extension(filename, "mp4")], user_file=True)
    else:
        thumb_path = None

    if thumb_path is not None and not os.path.exists(thumb_path):
        thumb_path = None

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
    """Return the contents of an exhibit directory

    if absolute == False, the path is appended to the default content directory
    """

    if absolute:
        contents = os.listdir(directory)
    else:
        content_path = get_path([directory], user_file=True)
        contents = os.listdir(content_path)
    return [x for x in contents if x[0] != "."]  # Don't return hidden files


def check_directory_structure():
    """Make sure the appropriate content directories are present and create them if they are not."""

    dir_list = ["content", "thumbnails"]

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
