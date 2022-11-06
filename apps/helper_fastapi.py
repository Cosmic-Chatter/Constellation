# Standard modules
from functools import lru_cache
import mimetypes
import os
import sys
import threading
import time
from typing import Any

# Third-party modules
import aiofiles
from fastapi import FastAPI, Depends, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Constellation modules
import config as const_config
import helper_files
import helper_system
import helper_utilities


const_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    const_config.application_path = os.path.dirname(sys.executable)
else:
    const_config.application_path = const_config.exec_path

helper_utilities.read_default_configuration()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/InfoStation",
          StaticFiles(directory=helper_files.get_path(["InfoStation"])),
          name="InfoStation")
app.mount("/media_browser",
          StaticFiles(directory=helper_files.get_path(["media_browser"])),
          name="media_browser")
app.mount("/media_player",
          StaticFiles(directory=helper_files.get_path(["media_player"])),
          name="media_player")
app.mount("/timelapse_viewer",
          StaticFiles(directory=helper_files.get_path(["timelapse_viewer"])),
          name="timelapse_viewer")
app.mount("/js",
          StaticFiles(directory=helper_files.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=helper_files.get_path(["css"])),
          name="css")
app.mount("/content",
          StaticFiles(directory=helper_files.get_path(["content"], user_file=True)),
          name="content")
app.mount("/images",
          StaticFiles(directory=helper_files.get_path(["images"], user_file=True)),
          name="images")
app.mount("/_static",
          StaticFiles(directory=helper_files.get_path(["_static"])),
          name="_static")
app.mount("/static",
          StaticFiles(directory=helper_files.get_path(["static"], user_file=True)),
          name="static")
app.mount("/style",
          StaticFiles(directory=helper_files.get_path(["style"], user_file=True)),
          name="style")
app.mount("/text",
          StaticFiles(directory=helper_files.get_path(["text"], user_file=True)),
          name="thumbs")
app.mount("/thumbs",
          StaticFiles(directory=helper_files.get_path(["thumbs"], user_file=True)),
          name="thumbs")
app.mount("/thumbnails",
          StaticFiles(directory=helper_files.get_path(["thumbnails"], user_file=True)),
          name="thumbnails")
app.mount("/videos",
          StaticFiles(directory=helper_files.get_path(["videos"], user_file=True)),
          name="videos")


@lru_cache()
def get_config():
    return const_config


@app.get("/", response_class=HTMLResponse)
async def root():
    return await serve_html("setup")


@app.get("/{file_name}.html", response_class=HTMLResponse)
async def serve_html(file_name):
    # First try a local file and then a Constellation file
    file_path = helper_files.get_path([file_name+".html"], user_file=True)
    if not os.path.isfile(file_path):
        file_path = helper_files.get_path([file_name + ".html"], user_file=False)
    with open(file_path, "r") as f:
        page = str(f.read())
    return page


@app.get("/getAvailableContent")
async def get_available_content(config: const_config = Depends(get_config)):
    """Return a list of all files in the content directory, plus some useful system info."""

    if "content" in config.defaults_dict:
        active_content = [s.strip() for s in config.defaults_dict["content"].split(",")]
    else:
        active_content = ""
    response = {"all_exhibits": helper_files.get_all_directory_contents(),
                "thumbnails": helper_files.get_directory_contents("thumbnails"),
                "active_content": active_content,
                "system_stats": helper_utilities.get_system_stats(),
                "multiple_file_upload": True}

    return response


@app.get("/getClipList")
async def send_clip_list(config: const_config = Depends(get_config)):
    """Get the list of currently playing content"""

    # If we don't have a clip list, ask for one to be sent for
    # next time.
    response = {"clipList": []}
    if len(config.clipList) == 0:
        config.commandList.append("sendClipList")
    else:
        response["clipList"] = config.clipList
    return response


@app.get("/getDefaults")
async def send_defaults(config: const_config = Depends(get_config)):

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

    config_to_send["contentPath"] = "content"
    return config_to_send


@app.get("/getUpdate")
async def send_update(config: const_config = Depends(get_config)):
    "Get some key info for updating the component and web console."

    response_dict = {
        "allow_refresh": config.defaults_dict["allow_refresh"],
        "allow_restart": config.defaults_dict["allow_restart"],
        "allow_shutdown": config.defaults_dict["allow_shutdown"],
        "allow_sleep": config.defaults_dict["allow_sleep"],
        "anydesk_id": config.defaults_dict["anydesk_id"],
        "autoplay_audio": config.defaults_dict["autoplay_audio"],
        "commands": config.commandList,
        "image_duration":  config.defaults_dict["image_duration"],
        "missingContentWarnings": config.missingContentWarningList
    }
    return response_dict


@app.get("/restart")
async def do_restart():

    helper_system.reboot()


@app.get("/sleepDisplay")
async def do_sleep():

    helper_system.sleep_display()


@app.get("/shutdown")
@app.get("/powerOff")
async def do_shutdown():

    helper_system.shutdown()


@app.get("/powerOn")
@app.get("/wakeDisplay")
async def do_wake():

    helper_system.wake_display()


@app.post("/")
async def do_post(data: dict[str, Any], config: const_config = Depends(get_config)):
    """POST requests to / are Constellation 1 legacy calls kept for compatibility with the web console"""

    if "action" not in data:
        raise HTTPException(status_code=400, detail="Must include field 'action'")
    else:
        action = data["action"]


@app.post("/deleteFile")
async def delete_file(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Delete the specified file from the content directory"""

    if "file" in data:
        helper_files.delete_file(data["file"])
        response = {"success": True}
    else:
        response = {"success": False,
                    "reason": "Request missing field 'file'"}
    return response


@app.post("/gotoClip")
async def goto_clip(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Command the client to display the given clip number"""

    if "clipNumber" in data:
        config.commandList.append("gotoClip_" + str(data["clipNumber"]))


@app.post("/setAutoplay")
async def set_autoplay(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Command the client to change the state of autoplay"""

    if "state" in data:
        if data["state"] == "on":
            config.commandList.append("enableAutoplay")
        elif data["state"] == "off":
            config.commandList.append("disableAutoplay")
        elif data["state"] == "toggle":
            config.commandList.append("toggleAutoplay")


@app.post("/updateActiveClip")
async def update_active_clip(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Store the active media clip index"""

    if "index" in data:
        config.clipList["activeClip"] = data["index"]


@app.post("/updateClipList")
async def update_clip_list(data: dict[str, Any], config: const_config = Depends(get_config)):
    """Store the current list of active media clips"""

    if "clipList" in data:
        config.clipList["clipList"] = data["clipList"]


@app.post("/uploadContent")
async def upload_content(files: list[UploadFile] = File(),
                         config: const_config = Depends(get_config)):
    """Receive uploaded files and save them to disk"""

    for file in files:
        filename = file.filename
        file_path = helper_files.get_path(["content", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with config.content_file_lock:
            async with aiofiles.open(file_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content)  # async write
        mimetype = mimetypes.guess_type(file_path, strict=False)[0]
        if mimetype is not None:
            th = threading.Thread(target=helper_files.create_thumbnail, args=(filename, mimetype.split("/")[0]), daemon=True)
            th.start()
    return {"success": True}


@app.post("/setDefaults")
async def set_defaults(data: dict, force: bool = False, config: const_config = Depends(get_config)):
    """Update the given defaults with the specified values"""

    if "defaults" not in data:
        raise HTTPException(status_code=400, detail="Must include field 'defaults'")

    helper_utilities.update_defaults(data["defaults"], force=True)

    return {"success": True}


@app.post("/rewriteDefaults")
async def rewrite_defaults(data: dict, force: bool = False, config: const_config = Depends(get_config)):
    """Replace all defaults with only the given values."""

    if "defaults" not in data:
        raise HTTPException(status_code=400, detail="Must include field 'defaults'")

    helper_utilities.update_defaults(data["defaults"], cull=True, force=True)

    return {"success": True}

if __name__ == "__main__":
    # Check for missing content thumbnails and create them
    helper_files.create_missing_thumbnails()

    # If it exists, load the dictionary that maps one value into another
    helper_files.load_dictionary()

    # Check the GitHub server for an available software update
    helper_utilities.check_for_software_update()

    # Activate Smart Restart
    helper_system.smart_restart_check()

    # Must use only one worker, since we are relying on the config module being in global)
    uvicorn.run(app,
                host="0.0.0.0",
                port=int(const_config.defaults_dict["helper_port"]),
                reload=False, workers=1)
