# Standard modules
from functools import lru_cache
import io
import mimetypes
import os
import shutil
import sys
import threading
from typing import Any
import uuid

# Third-party modules
import aiofiles
from fastapi import FastAPI, Body, Depends, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from fastapi.staticfiles import StaticFiles
import logging
import uvicorn
import webview
import webview.menu as webview_menu

# Constellation modules
import config as const_config
import helper_dmx
import helper_files
import helper_system
import helper_utilities
import helper_webview

# Set up log file
log_path: str = helper_files.get_path(["apps.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.INFO)

const_config.exec_path = os.path.dirname(os.path.abspath(__file__))
if getattr(sys, 'frozen', False):
    # If the application is run as a --onefile bundle, the PyInstaller bootloader
    # extends the sys module by a flag frozen=True and sets the app
    # path into variable sys.executable.
    const_config.application_path = os.path.dirname(sys.executable)
else:
    const_config.application_path = const_config.exec_path

helper_utilities.convert_defaults_ini()

helper_utilities.read_default_configuration()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/dmx_control",
          StaticFiles(directory=helper_files.get_path(["dmx_control"])),
          name="dmx_control")
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
app.mount("/timeline_explorer",
          StaticFiles(directory=helper_files.get_path(["timeline_explorer"])),
          name="timeline_explorer")
app.mount("/voting_kiosk",
          StaticFiles(directory=helper_files.get_path(["voting_kiosk"])),
          name="voting_kiosk")
app.mount("/word_cloud",
          StaticFiles(directory=helper_files.get_path(["word_cloud"])),
          name="word_cloud")
app.mount("/js",
          StaticFiles(directory=helper_files.get_path(["js"])),
          name="js")
app.mount("/css",
          StaticFiles(directory=helper_files.get_path(["css"])),
          name="css")
app.mount("/configuration",
          StaticFiles(directory=helper_files.get_path(
              ["configuration"], user_file=True)),
          name="configuration")
app.mount("/content",
          StaticFiles(directory=helper_files.get_path(
              ["content"], user_file=True)),
          name="content")
app.mount("/_fonts",
          StaticFiles(directory=helper_files.get_path(["_fonts"])),
          name="_fonts")
app.mount("/images",
          StaticFiles(directory=helper_files.get_path(
              ["images"], user_file=True)),
          name="images")
app.mount("/_static",
          StaticFiles(directory=helper_files.get_path(["_static"])),
          name="_static")
app.mount("/static",
          StaticFiles(directory=helper_files.get_path(
              ["static"], user_file=True)),
          name="static")
app.mount("/style",
          StaticFiles(directory=helper_files.get_path(
              ["style"], user_file=True)),
          name="style")
app.mount("/text",
          StaticFiles(directory=helper_files.get_path(
              ["text"], user_file=True)),
          name="thumbs")
app.mount("/thumbs",
          StaticFiles(directory=helper_files.get_path(
              ["thumbs"], user_file=True)),
          name="thumbs")
app.mount("/thumbnails",
          StaticFiles(directory=helper_files.get_path(
              ["thumbnails"], user_file=True)),
          name="thumbnails")
app.mount("/videos",
          StaticFiles(directory=helper_files.get_path(
              ["videos"], user_file=True)),
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
    file_path = helper_files.get_path([file_name + ".html"], user_file=True)
    if not os.path.isfile(file_path):
        file_path = helper_files.get_path([file_name + ".html"], user_file=False)
    with open(file_path, "r", encoding='UTF-8') as f:
        page = str(f.read())
    return page


@app.get("/README.md", response_class=HTMLResponse)
async def serve_readme():
    # First try a local file and then a Constellation file
    file_path = helper_files.get_path(["README.md"])
    with open(file_path, "r") as f:
        file = str(f.read())
    return file


@app.get("/getAvailableContent")
async def get_available_content(config: const_config = Depends(get_config)):
    """Return a list of all files in the content directory, plus some useful system info."""

    if "content" in config.defaults_dict:
        active_content = [s.strip()
                          for s in config.defaults_dict["content"].split(",")]
    else:
        active_content = ""
    response = {"all_exhibits": helper_files.get_all_directory_contents(),
                "definitions": helper_files.get_available_definitions(),
                "thumbnails": helper_files.get_directory_contents("thumbnails"),
                "active_content": active_content,
                "system_stats": helper_utilities.get_system_stats(),
                "multiple_file_upload": True}

    return response


@app.post('/files/getVideoDetails')
async def get_video_details(filename: str = Body(description='The filename of the file.', embed=True)):
    """Return a dictionary of useful information about a video file in the content directory."""

    success, details = helper_files.get_video_file_details(filename)
    return {"success": success, "details": details}


@app.post('/files/convertVideoToFrames')
async def convert_video_to_frames(filename: str = Body(description='The filename of the file.'),
                                  file_type: str = Body(description='The output filetype to use.', default='jpg')):
    """Convert the given file to a set of frames."""

    success = helper_files.convert_video_to_frames(filename, file_type)

    return {"success": success}


@app.post('/files/thumbnailVideoFromFrames')
async def create_thumbnail_video_from_frames(
        filename: str = Body(description='The name of the output file, without an extension.'),
        frames: list[str] = Body(description='A list of the files to include'),
        duration: float = Body(description='The length of the output video in seconds.', default=5)):
    success = helper_files.create_thumbnail_video_from_frames(frames, filename, duration)
    return {"success": success}


@app.post('/files/uploadThumbnail')
def upload_thumbnail(files: list[UploadFile] = File(),
                           config: const_config = Depends(get_config)):
    """Save uploaded files as thumbnails, formatting them appropriately."""

    for file in files:
        filename = file.filename
        temp_path = helper_files.get_path(["content", filename], user_file=True)
        final_path = helper_files.get_path(["thumbnails", filename], user_file=True)
        with config.content_file_lock:
            # First write the file to content
            try:
                with open(temp_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()
            # Next, generate a thumbnail
            helper_files.create_thumbnail(filename, 'image')
            # Finally, delete the source file
            os.remove(temp_path)
    return {"success": True}


@app.get('/system/getScreenshot', responses={200: {"content": {"image/png": {}}}}, response_class=Response)
async def get_screenshot():
    """Capture a screenshot and return it as a JPEG response."""

    image = helper_utilities.capture_screenshot()
    byte_array = io.BytesIO()
    image.save(byte_array, format='JPEG', quality=85)
    byte_array = byte_array.getvalue()
    return Response(content=byte_array,
                    media_type="image/jpeg",
                    headers={
                        "Pragma-directive": "no-cache",
                        "Cache-directive": "no-cache",
                        "Cache-control": "no-cache",
                        "Pragma": "no-cache",
                        "Expires": "0"
                    })


@app.get("/definitions/{app_id}/getAvailable")
async def get_available_definitions(app_id: str):
    """Return a list of all the definitions for the given app."""

    return {"success": True, "definitions": helper_files.get_available_definitions(app_id)}


@app.get("/definitions/{this_uuid}/delete")
async def delete_definition(this_uuid: str):
    """Delete the given definition."""

    path = helper_files.get_path(["definitions", helper_files.with_extension(this_uuid, "json")], user_file=True)
    helper_files.delete_file(path)

    return {"success": True}


@app.get("/definitions/{this_uuid}/load")
async def load_definition(this_uuid: str):
    """Load the given definition and return the JSON."""

    path = helper_files.get_path(["definitions", helper_files.with_extension(this_uuid, "json")], user_file=True)
    definition = helper_files.load_json(path)
    if definition is None:
        return {"success": False, "reason": f"The definition {this_uuid} does not exist."}
    return {"success": True, "definition": definition}


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
    config_to_send["software_update"] = config.software_update

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


@app.get('/uuid/new')
async def get_new_uuid():
    """Return a new uuid."""

    return {"success": True, "uuid": str(uuid.uuid4())}


@app.get("/getUpdate")
async def send_update(config: const_config = Depends(get_config)):
    """Get some key info for updating the component and web console."""

    response_dict = {
        "allow_refresh": config.defaults_dict.get("allow_refresh", "true"),
        "allow_restart": config.defaults_dict.get("allow_restart", "false"),
        "allow_shutdown": config.defaults_dict.get("allow_shutdown", "false"),
        "allow_sleep": config.defaults_dict.get("allow_sleep", "false"),
        "anydesk_id": config.defaults_dict.get("anydesk_id", ""),
        "autoplay_audio": config.defaults_dict.get("autoplay_audio", "false"),
        "commands": config.commandList,
        "image_duration": config.defaults_dict.get("image_duration", "10"),
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
        raise HTTPException(
            status_code=400, detail="Must include field 'action'")
    else:
        print("Legacy Constellation command received: ", data)


@app.post("/definitions/write")
async def write_definition(definition: dict[str, Any] = Body(description="The JSON dictionary to write.", embed=True)):
    """Save the given JSON data to a definition file in the content directory."""

    if "uuid" not in definition or definition["uuid"] == "":
        # Add a unique identifier
        definition["uuid"] = str(uuid.uuid4())
    path = helper_files.get_path(["definitions",
                                  helper_files.with_extension(definition["uuid"], ".json")],
                                 user_file=True)
    helper_files.write_json(definition, path)
    return {"success": True, "uuid": definition["uuid"]}


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


@app.post("/renameFile")
async def rename_file(current_name: str = Body(description="The file to be renamed."),
                      new_name: str = Body(description="The new name of the file.")):
    """Rename a file in the content directory."""

    return helper_files.rename_file(current_name, new_name)


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
def upload_content(files: list[UploadFile] = File(),
                   config: const_config = Depends(get_config)):
    """Receive uploaded files and save them to disk"""

    for file in files:
        filename = file.filename
        file_path = helper_files.get_path(
            ["content", filename], user_file=True)
        print(f"Saving uploaded file to {file_path}")
        with config.content_file_lock:
            try:
                with open(file_path, 'wb') as out_file:
                    shutil.copyfileobj(file.file, out_file)
            finally:
                file.file.close()

        mimetype = mimetypes.guess_type(file_path, strict=False)[0]
        if mimetype is not None:
            th = threading.Thread(target=helper_files.create_thumbnail, args=(filename, mimetype.split("/")[0]),
                                  daemon=True)
            th.start()
    return {"success": True}


@app.post("/setDefaults")
async def set_defaults(data: dict, force: bool = False, config: const_config = Depends(get_config)):
    """Update the given defaults with the specified values"""

    if "defaults" not in data:
        raise HTTPException(
            status_code=400, detail="Must include field 'defaults'")

    helper_utilities.update_defaults(data["defaults"], force=True)

    return {"success": True}


@app.post("/rewriteDefaults")
async def rewrite_defaults(data: dict, force: bool = False, config: const_config = Depends(get_config)):
    """Replace all defaults with only the given values."""

    if "defaults" not in data:
        raise HTTPException(
            status_code=400, detail="Must include field 'defaults'")

    helper_utilities.update_defaults(data["defaults"], cull=True, force=True)

    return {"success": True}


# DMX actions

@app.get("/DMX/getAvailableControllers")
async def get_dmx_controllers():
    """Return a list of connected DMX controllers."""

    success, reason, controllers = helper_dmx.get_available_controllers()

    return {"success": success, "reason": reason, "controllers": controllers}


@app.get("/DMX/getConfiguration")
async def get_dmx_configuration():
    """Return the JSON DMX configuration file."""

    success, reason = helper_dmx.activate_dmx()
    config_dict = {
        "universes": [],
        "groups": []
    }
    if success is True:
        config_path = helper_files.get_path(
            ["configuration", "dmx.json"], user_file=True)
        config_dict = helper_files.load_json(config_path)

    return {"success": success, "reason": reason, "configuration": config_dict}


@app.get("/DMX/getStatus")
async def get_dmx_status():
    """Return a dictionary with the current channel value for every channel in every fixture."""

    result = {}

    for fixture in const_config.dmx_fixtures:
        result[fixture.uuid] = fixture.get_all_channel_values()

    return {"success": True, "status": result}


@app.post("/DMX/fixture/create")
async def create_dmx_fixture(name: str = Body(description="The name of the fixture."),
                             channels: list[str] = Body(description="A list of channel names."),
                             start_channel: int = Body(description="The first channel to allocate."),
                             universe: str = Body(description='The UUID of the universe this fixture belongs to.')):
    """Create a new DMX fixture"""

    new_fixture = helper_dmx.get_universe(uuid_str=universe).create_fixture(name, start_channel, channels)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "fixture": new_fixture.get_dict()}


@app.post("/DMX/fixture/remove")
async def remove_dmx_fixture(fixture_uuid: str = Body(description="The UUID of the fixture to remove.", embed=True)):
    """Remove the given DMX fixture from its universe and any groups"""

    fixture = helper_dmx.get_fixture(fixture_uuid)
    if fixture is None:
        print(f"/DMX/fixture/remove: Cannot remove fixture {fixture_uuid}. It does not exist.")
        return {"success": False, "reason": "Fixture does not exist."}
    fixture.delete()
    helper_dmx.write_dmx_configuration()

    return {"success": True}


@app.post("/DMX/fixture/{fixture_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(fixture_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given fixture to the specified brightness."""

    fixture = helper_dmx.get_fixture(fixture_uuid)
    fixture.set_brightness(value, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/fixture/{fixture_uuid}/setChannel")
async def set_dmx_fixture_channel(fixture_uuid: str,
                                  channel_name: str = Body(
                                      "The name of the chanel to set."),
                                  value: int = Body(
                                      description="The value to be set."),
                                  duration: float = Body(description="How long the transition should take.",
                                                         default=0)):
    """Set the given channel of the given fixture to the given value."""

    fixture = helper_dmx.get_fixture(fixture_uuid)
    fixture.set_channel(channel_name, value)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/fixture/{fixture_uuid}/setColor")
async def set_dmx_fixture_to_color(fixture_uuid: str,
                                   color: list = Body(
                                       description="The color to be set."),
                                   duration: float = Body(description="How long the color transition should take.",
                                                          default=0)):
    """Set the given fixture to the specified color."""

    fixture = helper_dmx.get_fixture(fixture_uuid)
    fixture.set_color(color, duration)
    return {"success": True, "configuration": fixture.get_dict()}


@app.post("/DMX/group/create")
async def create_dmx_group(name: str = Body(description="The name of the group to create."),
                           fixture_list: list[str] = Body(description="The UUIDs of the fixtures to include.")):
    new_group = helper_dmx.create_group(name)

    fixtures = []
    for uuid in fixture_list:
        fixtures.append(helper_dmx.get_fixture(uuid))
    new_group.add_fixtures(fixtures)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "uuid": new_group.uuid}


@app.post("/DMX/group/{group_uuid}/edit")
async def edit_dmx_group(group_uuid: str,
                         name: str = Body(description="The new name for the group", default=""),
                         fixture_list: list[str] = Body(
                             description="A list of UUIDs for fixtures that should be included.", default=[])):
    group = helper_dmx.get_group(group_uuid)

    if group is None:
        return {"success": False, "reason": f"Group {group_uuid} does not exist."}

    if name != "":
        group.name = name

    if len(fixture_list) > 0:
        # First, remove any fixtures that are in the group, but not in fixture_list
        for uuid in group.fixtures.copy():
            if uuid not in fixture_list:
                group.remove_fixture(uuid)

        # Then, loop through fixture_list and add any that are not included in the group
        fixtures_to_add = []
        for uuid in fixture_list:
            if uuid not in group.fixtures:
                fixture = helper_dmx.get_fixture(uuid)
                if fixture is not None:
                    fixtures_to_add.append(fixture)

        if len(fixtures_to_add) > 0:
            group.add_fixtures(fixtures_to_add)
    helper_dmx.write_dmx_configuration()

    return {"success": True}


@app.get("/DMX/group/{group_uuid}/delete")
async def delete_dmx_group(group_uuid: str):
    helper_dmx.get_group(group_uuid).delete()
    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/createScene")
async def create_dmx_scene(group_uuid: str,
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Create the given scene for the specified group."""

    group = helper_dmx.get_group(group_uuid)
    uuid_str = group.create_scene(name, values, duration=duration)
    helper_dmx.write_dmx_configuration()
    return {"success": True, "uuid": uuid_str}


@app.post("/DMX/group/{group_uuid}/editScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit."),
                           name: str = Body(description="The name of the scene."),
                           values: dict = Body(description="A dictionary of values for the scene."),
                           duration: float = Body(description="The transition length in milliseconds.", default=0)):
    """Edit the given scene for the specified group."""

    group = helper_dmx.get_group(group_uuid)

    scene = group.get_scene(uuid_str=uuid)

    scene.name = name
    scene.duration = duration
    scene.set_values(values)

    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/deleteScene")
async def create_dmx_scene(group_uuid: str,
                           uuid: str = Body(description="The UUID of the scene to edit.", embed=True)):
    """Delete the given scene for the specified group."""

    group = helper_dmx.get_group(group_uuid)
    group.delete_scene(uuid)

    helper_dmx.write_dmx_configuration()
    return {"success": True}


@app.post("/DMX/group/{group_uuid}/setBrightness")
async def set_dmx_fixture_to_brightness(group_uuid: str,
                                        value: int = Body(
                                            description="The brightness to be set."),
                                        duration: float = Body(
                                            description="How long the brightness transition should take.",
                                            default=0)):
    """Set the given group to the specified brightness."""

    group = helper_dmx.get_group(group_uuid)
    group.set_brightness(value, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setChannel")
async def set_dmx_group_channel(group_uuid: str,
                                channel: str = Body(description="The channel to set."),
                                value: int = Body(description="The value to set.")):
    """Set the given channel to the specified value for every fixture in the group."""

    group = helper_dmx.get_group(group_uuid)
    group.set_channel(channel, value)
    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/group/{group_uuid}/setColor")
async def set_dmx_group_to_color(group_uuid: str,
                                 color: list = Body(
                                     description="The color to be set."),
                                 duration: float = Body(description="How long the color transition should take.",
                                                        default=0)):
    """Set the given group to the specified color."""

    group = helper_dmx.get_group(group_uuid)
    group.set_color(color, duration)
    return {"success": True, "configuration": group.get_dict()}


@app.get("/DMX/group/{group_uuid}/getScenes")
async def get_dmx_group_scenes(group_uuid: str):
    """Return a list of the available scenes for the given group."""

    response = {"success": True, "scenes": []}

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = helper_files.load_json(config_path)
    groups = config_dict["groups"]
    matches = [group for group in groups if group.uuid == group_uuid]
    if len(matches) == 0:
        response["success"] = False
        response["reason"] = "group_not_found"
        return response
    group = matches[0]
    response["scenes"] = group["scenes"]
    return response


@app.get("/DMX/getScenes")
async def get_dmx_scenes():
    """Return a list of the available scenes across all groups."""

    response = {"success": True, "groups": []}

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        response["success"] = False
        response["reason"] = "no_config_file"
        return response

    config_dict = helper_files.load_json(config_path)
    groups = config_dict["groups"]

    for group_def in groups:
        group = {}
        group["uuid"] = group_def["uuid"]
        group["name"] = group_def["name"]
        scenes = []
        for scene_def in group_def["scenes"]:
            scene = {"uuid": scene_def["uuid"], "name": scene_def["name"]}
            scenes.append(scene)
        group["scenes"] = scenes
        response["groups"].append(group)

    return response


@app.post("/DMX/group/{group_uuid}/showScene")
async def set_dmx_group_scene(group_uuid: str,
                              uuid: str = Body(
                                  description="The UUID of the scene to be run.",
                                  default="",
                                  embed=True)
                              ):
    """Run a scene for the given group."""

    helper_dmx.activate_dmx()
    group = helper_dmx.get_group(group_uuid)
    group.show_scene(uuid)

    return {"success": True, "configuration": group.get_dict()}


@app.post("/DMX/universe/create")
async def create_dmx_universe(name: str = Body(description="The name of the universe."),
                              controller: str = Body(description="The type of this controller (OpenBMX or uDMX)."),
                              device_details: dict[str, Any] = Body(
                                  description="A dictionary of hardware details for the controller.")):
    """Create a new DMXUniverse."""

    new_universe = helper_dmx.create_universe(name,
                                              controller=controller,
                                              device_details=device_details)
    helper_dmx.write_dmx_configuration()

    return {"success": True, "universe": new_universe.get_dict()}


@app.post("/DMX/universe/rename")
async def create_dmx_universe(uuid: str = Body(description="The UUID of the universe."),
                              new_name: str = Body(description="The new name to set.")):
    """Change the name for a universe."""

    helper_dmx.get_universe(uuid_str=uuid).name = new_name
    helper_dmx.write_dmx_configuration()

    return {"success": True}


def start_app(with_webview: bool = True):
    """Start the webserver.

    If with_webview == True, start as a daemon thread so that when the webview closes, the app shuts down.
    """

    const_config.server_process = threading.Thread(target=_start_server, daemon=with_webview)
    const_config.server_process.start()


def _start_server():
    # Must use only one worker, since we are relying on the config module being in global)
    uvicorn.run(app,
                host="0.0.0.0",
                port=int(const_config.defaults_dict["helper_port"]),
                reload=False, workers=1)


if __name__ == "__main__":
    # Check for missing content thumbnails and create them
    helper_files.create_missing_thumbnails()

    # Check the GitHub server for an available software update
    helper_utilities.check_for_software_update()

    # Activate Smart Restart
    helper_system.smart_restart_check()

    print(
        f"Starting Constellation Apps for ID {const_config.defaults_dict['id']} of group {const_config.defaults_dict['group']} on port {const_config.defaults_dict['helper_port']}.")

    if const_config.defaults_dict.get("remote_display", "True") == "True":
        # Start the server but don't create a GUI window
        start_app(with_webview=False)
    else:
        # Create a GUI window and then start the server
        option_fullscreen = "fullscreen" in sys.argv

        app_window = webview.create_window('Constellation Apps',
                                           confirm_close=False,
                                           fullscreen=option_fullscreen,
                                           height=720,
                                           width=1280,
                                           min_size=(1280, 720),
                                           url='http://localhost:' + str(
                                               const_config.defaults_dict["helper_port"]) + '/media_player.html')

        # Subscribe to event listeners
        app_window.events.closed += helper_webview.on_closed
        app_window.events.closing += helper_webview.on_closing
        app_window.events.shown += helper_webview.on_shown
        app_window.events.loaded += helper_webview.on_loaded
        app_window.events.minimized += helper_webview.on_minimized
        app_window.events.maximized += helper_webview.on_maximized
        app_window.events.restored += helper_webview.on_restored
        app_window.events.resized += helper_webview.on_resized
        app_window.events.moved += helper_webview.on_moved

        # Add menu bar if we are not going into fullscreen
        menu_items = None
        if not option_fullscreen:
            menu_items = [
                webview_menu.Menu(
                    'Settings',
                    [
                        webview_menu.MenuAction('Show settings', helper_webview.show_webview_settings)
                    ]
                )
            ]

        webview.start(func=start_app, menu=menu_items)
