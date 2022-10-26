"""Functions to handle legacy Constellation v1.1 interface under FAST API"""

# Standard imports
import cgi
import datetime
import configparser
import json
import logging
import os
import shutil
import time

# Non-standard imports
import dateutil.parser
from fastapi import HTTPException

# Constellation imports
import config as c_config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_maintenance as c_maint
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tracker as c_track
import constellation_tools as c_tools


def do_POST(data, ip_address):
    """Receives pings from client devices and respond with any updated information"""

    # print("===============")
    # print("BEGIN POST")

    # Get the data from the request
    # try:
    #     ctype, pdict = cgi.parse_header(self.headers.get('content-type'))
    # except:
    #     print("DO_POST: Error: Are we missing the Content-Type header?")
    #     with config.logLock:
    #         logging.warning("POST received without content-type header")
    #     print(self.headers)
    #     return
    #
    # if ctype == "multipart/form-data":  # File upload
    #     try:
    #         pdict['boundary'] = bytes(pdict['boundary'], "utf-8")
    #         content_len = int(self.headers.get('Content-length'))
    #         pdict['CONTENT-LENGTH'] = content_len
    #         fields = cgi.parse_multipart(self.rfile, pdict)
    #         file = fields.get('file')[0]
    #
    #         action = fields.get("action")[0]
    #         if action == "uploadIssueMedia":
    #             content_path = os.path.join(config.APP_PATH, "issues", "media")
    #             _, extension = os.path.splitext(fields.get("filename")[0])
    #             # Create a new filename so we never have collisions
    #             new_filename = str(time.time()).replace(".", "") + extension
    #             filepath = os.path.join(content_path, new_filename)
    #             print(f"Saving uploaded file to {filepath}")
    #             with config.issueMediaLock:
    #                 with open(filepath, "wb") as f:
    #                     f.write(file)
    #         else:
    #             print("Unknown file upload action:", action)
    #             return
    #
    #         json_string = json.dumps({"success": True, "filename": new_filename})
    #     except:
    #         json_string = json.dumps({"success": False})
    #
    #     self.configure_response(200, "application/json")
    #     try:
    #         self.wfile.write(bytes(json_string, encoding="UTF-8"))
    #     except BrokenPipeError:
    #         pass
    #     return

    try:
        ping_class = data["class"]
    except KeyError:
        print("Error: ping received without class field")
        response = {"success": False,
                    "reason": "Request missing 'class' field."}
        return response

    # print(f"  class = {ping_class}")
    try:
        print(data["action"])
    except:
        pass

    if ping_class == "exhibitComponent":
        if "action" in data:  # not a ping
            action = data["action"]
        else:  # it's a ping
            try:
                id = data["id"]
                if id == "UNKNOWN":
                    print(f"Warning: exhibitComponent ping with id=UNKNOWN coming from {ip_address}")
                    return {}
            except KeyError:
                print("Error: exhibitComponent ping received without id or type field")
                raise HTTPException(status_code=404, detail="Error: exhibitComponent ping received without id or type field")

            c_exhibit.update_exhibit_component_status(data, ip_address)

            if len(c_exhibit.get_exhibit_component(id).config["commands"]) > 0:
                # Clear the command list now that we have sent
                c_exhibit.get_exhibit_component(id).config["commands"] = []
            return c_exhibit.get_exhibit_component(id).config
    else:
        print(f"Error: ping with unknown class '{ping_class}' received")
        response = {"success": False,
                    "reason": f"Unknown class {ping_class}"}
        return response
