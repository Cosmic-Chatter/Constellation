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

    if ping_class == "webpage":
        try:
            action = data["action"]
        except KeyError:
            print("Error: webpage ping received without action field")
            # print("END POST")
            # print("===============")
            response = {"success": True,
                        "reason": "Missing required field 'action'."}
            return response
        if action == "setExhibit":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            print("Changing exhibit to:", data["name"])
            c_exhibit.read_exhibit_configuration(data["name"], update_default=True)

            # Update the components that the configuration has changed
            for component in c_config.componentList:
                component.update_configuration()
            return {"success": True, "reason": ""}
        elif action == "createExhibit":
            if "name" not in data or data["name"] == "":
                response = {"success": False,
                            "reason": "Request missing 'name' field or name is blank."}
                return response
            clone = None
            if "cloneFrom" in data and data["cloneFrom"] != "":
                clone = data["cloneFrom"]
            c_exhibit.create_new_exhibit(data["name"], clone)
            return {"success": True, "reason": ""}
        elif action == "deleteExhibit":
            if "name" not in data or data["name"] == "":
                response = {"success": False,
                            "reason": "Request missing 'name' field or name is empty."}
                return response
            c_exhibit.delete_exhibit(data["name"])
            response = {"success": True, "reason": ""}
            return response
        elif action == "setComponentContent":
            if "id" not in data or "content" not in data:
                response = {"success": False,
                            "reason": "Request missing 'id' or 'content' field."}
                return response
            content_to_set = data["content"]
            print(f"Changing content for {data['id']}:", content_to_set)
            if not isinstance(content_to_set, list):
                content_to_set = [data["content"]]
            c_exhibit.set_component_content(data['id'], content_to_set)
            return {"success": True, "reason": ""}

        elif action == "getHelpText":
            try:
                readme_path = os.path.join(c_config.APP_PATH,
                                           "README.md")
                if not os.path.isfile(readme_path):
                    # Handle the case of a Pyinstaller --onefile binary
                    readme_path = os.path.join(c_config.EXEC_PATH, "README.md")
                with open(readme_path, 'r', encoding='UTF-8') as f:
                    text = f.read()
                response = {"success": True, "text": text}
            except FileNotFoundError:
                with c_config.logLock:
                    logging.error("Unable to read README.md")
                response = {"success": False, "reason": "Unable to read README.md"}
            return response
        elif action == "createIssue":
            if "details" in data:
                with c_config.issueLock:
                    new_issue = c_issues.Issue(data["details"])
                    c_config.issueList.append(new_issue)
                    c_issues.save_issueList()
                response_dict = {"success": True}
            else:
                response_dict = {"success": False,
                                 "reason": "Must include field 'details'"}
            return response_dict
        elif action == "editIssue":
            if "details" in data and "id" in data["details"]:
                c_issues.edit_issue(data["details"])
                c_issues.save_issueList()
                response_dict = {"success": True}
            else:
                response_dict = {
                    "success": False,
                    "reason": "Must include field 'details' with proper"
                              "ty 'id'"
                }
            return response_dict
        elif action == "deleteIssue":
            if "id" in data:
                c_issues.remove_issue(data["id"])
                c_issues.save_issueList()
                response_dict = {"success": True, "reason": ""}
            else:
                response_dict = {"success": False, "reason": "Must include field 'id'"}
            return response_dict
        elif action == "getIssueList":
            response = {
                "success": True,
                "issueList": [x.details for x in c_config.issueList]
            }
            return response
        elif action == "issueMediaDelete":
            if "filename" not in data:
                response = {"success": False,
                            "reason": "Request missing 'filename' field."}
                return response
            this_id = None
            if "id" in data:
                this_id = data["id"]
            c_issues.delete_issue_media_file(data["filename"], owner=this_id)
            response = {"success": True}
            return response
        elif action == 'updateMaintenanceStatus':
            if "id" not in data or "status" not in data or "notes" not in data:
                response = {"success": False,
                            "reason": "Request missing 'id', 'status', or 'notes' field."}
                return response
            file_path = os.path.join(c_config.APP_PATH, "maintenance-logs", data["id"] + ".txt")
            record = {"id": data["id"],
                      "date": datetime.datetime.now().isoformat(),
                      "status": data['status'],
                      "notes": data["notes"]}
            with c_config.maintenanceLock:
                try:
                    with open(file_path, 'a', encoding='UTF-8') as f:
                        f.write(json.dumps(record) + "\n")
                    success = True
                    reason = ""
                except FileNotFoundError:
                    success = False
                    reason = f"File path {file_path} does not exist"
                except PermissionError:
                    success = False
                    reason = f"You do not have write permission for the file {file_path}"
            return {"success": success, "reason": reason}
        elif action == 'getMaintenanceStatus':
            if "id" not in data:
                response = {"success": False,
                            "reason": "Request missing 'id' field."}
                return response
            file_path = os.path.join(c_config.APP_PATH,
                                     "maintenance-logs", data["id"] + ".txt")
            with c_config.maintenanceLock:
                response_dict = c_maint.get_maintenance_report(file_path)
            return response_dict
        elif action == "getAllMaintenanceStatuses":
            record_list = []
            maintenance_path = os.path.join(c_config.APP_PATH,
                                            "maintenance-logs")
            for file in os.listdir(maintenance_path):
                if file.lower().endswith(".txt"):
                    with c_config.maintenanceLock:
                        file_path = os.path.join(maintenance_path, file)
                        record_list.append(c_maint.get_maintenance_report(file_path))
            response_dict = {"success": True,
                             "records": record_list}
            return response_dict
        else:
            print(f"Error: Unknown webpage command received: {action}")
            with c_config.logLock:
                logging.error(f"Unknown webpage command received: {action}")

    elif ping_class == "exhibitComponent":
        if "action" in data:  # not a ping
            action = data["action"]

            if action == "beginSynchronization":
                if "synchronizeWith" in data:
                    c_exhibit.update_synchronization_list(data["id"], data["synchronizeWith"])
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
    elif ping_class == "tracker":
        if "action" not in data:
            response = {"success": False,
                        "reason": "Request missing 'action' field."}
            return response
        action = data["action"]

        if action == "getLayoutDefinition":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")

            layout_definition, success, reason = c_track.get_layout_definition(data["name"] + ".ini",
                                                                               kind=kind)

            response = {"success": success,
                        "reason": reason,
                        "layout": layout_definition}
            return response
        elif action == "submitData":
            if "data" not in data or "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'data' or 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            # file_path = os.path.join(config.APP_PATH, kind, "data", data["name"] + ".txt")
            file_path = c_tools.get_path([kind, "data", data["name"] + ".txt"], user_file=True)
            success, reason = c_track.write_JSON(data["data"], file_path)
            response = {"success": success, "reason": reason}
            return response
        elif action == "submitRawText":
            if "text" not in data or "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'text' or 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            mode = data.get("mode", "a")
            if mode != "a" and mode != "w":
                response = {"success": False,
                            "reason": "Invalid mode field: must be 'a' (append, [default]) or 'w' (overwrite)"}
                return response
            success, reason = c_track.write_raw_text(data["text"], data["name"] + ".txt", kind=kind, mode=mode)
            response = {"success": success, "reason": reason}
            return response
        elif action == "retrieveRawText":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            result, success, reason = c_track.get_raw_text(data["name"] + ".txt", kind)
            response = {"success": success, "reason": reason, "text": result}
            return response
        elif action == "submitAnalytics":
            if "data" not in data or 'name' not in data:
                response = {"success": False,
                            "reason": "Request missing 'data' or 'name' field."}
                return response
            file_path = os.path.join(c_config.APP_PATH, "analytics", data["name"] + ".txt")
            success, reason = c_track.write_JSON(data["data"], file_path)
            response = {"success": success, "reason": reason}
            return response
        elif action == "getAvailableDefinitions":
            kind = data.get("kind", "flexible-tracker")
            definition_list = []
            template_path = os.path.join(c_config.APP_PATH, kind, "templates")
            for file in os.listdir(template_path):
                if file.lower().endswith(".ini"):
                    definition_list.append(file)

            return definition_list
        elif action == "getAvailableTrackerData":
            kind = data.get("kind", "flexible-tracker")
            data_path = os.path.join(c_config.APP_PATH, kind, "data")
            data_list = []
            for file in os.listdir(data_path):
                if file.lower().endswith(".txt"):
                    data_list.append(file)
            response = {"success": True,
                        "data": data_list}
            return response
        elif action == "downloadTrackerData":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            name = data["name"]
            if not name.lower().endswith(".txt"):
                name += ".txt"
            data_path = os.path.join(c_config.APP_PATH, kind, "data", name)
            result = c_track.create_CSV(data_path)
            response = {"success": True,
                        "csv": result}
            return response
        elif action == "clearTrackerData":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            name = data["name"]
            if name is None:
                response = {"success": False,
                            "reason": "'name' field is blank."}
                return response
            if not name.lower().endswith(".txt"):
                name += ".txt"
            data_path = os.path.join(c_config.APP_PATH, kind, "data", name)
            success = True
            reason = ""
            with c_config.trackingDataWriteLock:
                try:
                    os.remove(data_path)
                except PermissionError:
                    success = False
                    reason = f"You do not have write permission for the file {data_path}"
                except FileNotFoundError:
                    success = True  # This error results in the user's desired action!
                    reason = f"File does not exist: {data_path}"
            if reason != "":
                print(reason)
            response = {"success": success,
                        "reason": reason}
            return response
        elif action == "createTemplate":
            if "name" not in data or "template" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' or 'template' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            name = data["name"]
            if not name.lower().endswith(".ini"):
                name += ".ini"
            file_path = os.path.join(c_config.APP_PATH, kind, "templates", name)
            success = c_track.create_template(file_path, data["template"])
            response = {"success": success}
            return response
        elif action == "deleteTemplate":
            if "name" not in data:
                response = {"success": False,
                            "reason": "Request missing 'name' field."}
                return response
            kind = data.get("kind", "flexible-tracker")
            file_path = os.path.join(c_config.APP_PATH, kind, "templates", data["name"] + ".ini")
            with c_config.trackerTemplateWriteLock:
                response = c_tools.delete_file(file_path)
            return response
        elif action == "checkConnection":
            return {"success": True}
    else:
        print(f"Error: ping with unknown class '{ping_class}' received")
        response = {"success": False,
                    "reason": f"Unknown class {ping_class}"}
        return response
