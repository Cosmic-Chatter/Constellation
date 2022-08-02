# Standard imports
import datetime
import json
import logging
import os
import time
from typing import Union

# Constellation imports
import config


class Issue:
    """Contains information relevant for tracking an issue."""

    def __init__(self, details):
        """Populate the Issue with the information stored in a dictionary"""

        self.details = {}
        now_date = datetime.datetime.now().isoformat()
        self.details["id"] = details.get("id", str(time.time()).replace(".", ""))
        self.details["creationDate"] = details.get("creationDate", now_date)
        self.details["lastUpdateDate"] = details.get("lastUpdateDate", now_date)
        self.details["priority"] = details.get("priority", "medium")
        self.details["issueName"] = details.get("issueName", "New Issue")
        self.details["issueDescription"] = details.get("issueDescription", "")
        self.details["relatedComponentIDs"] = details.get("relatedComponentIDs", [])
        self.details["assignedTo"] = details.get("assignedTo", [])
        self.details["media"] = details.get("media", None)

    def refresh_last_update_date(self):
        self.details["lastUpdateDate"] = datetime.datetime.now().isoformat()
        config.issueList_last_update_date = self.details["lastUpdateDate"]


def delete_issue_media_file(file: str, owner: str = None):
    """Delete a media file from an issue"""

    file_path = os.path.join(config.APP_PATH, "issues", "media", file)
    print("Deleting issue media file:", file)
    with config.logLock:
        logging.info("Deleting issue media file %s", file)
    with config.issueMediaLock:
        try:
            os.remove(file_path)
        except FileNotFoundError:
            with config.logLock:
                logging.error("Cannot delete requested issue media file %s: file not found", file)
            print(f"Cannot delete requested issue media file {file}: file not found")

    if owner is not None:
        with config.issueLock:
            issue = get_issue(owner)
            issue.details["media"] = None
            # issue.details["lastUpdateDate"] = datetime.datetime.now().isoformat()
            issue.refresh_last_update_date()
            save_issueList()


def edit_issue(details: dict):
    """Edit issue with the id given in details dict"""
    if "id" in details:
        issue = get_issue(details["id"])
        with config.issueLock:
            issue.details["priority"] = details.get("priority", issue.details["priority"])
            issue.details["issueName"] = details.get("issueName", issue.details["issueName"])
            issue.details["issueDescription"] = details.get("issueDescription",
                                                            issue.details["issueDescription"])
            issue.details["relatedComponentIDs"] = details.get("relatedComponentIDs",
                                                               issue.details["relatedComponentIDs"])
            issue.details["assignedTo"] = details.get("assignedTo",
                                                      issue.details["assignedTo"])
            issue.refresh_last_update_date()
            issue.details["media"] = details.get("media", issue.details["media"])


def get_issue(this_id: str) -> Issue:
    """Return an Issue with the given id, or None if no such Issue exists"""

    return next((x for x in config.issueList if x.details["id"] == this_id), None)


def remove_issue(this_id: str):
    """Remove an Issue with the given id from the issueList"""

    # First, if there is a media file, delete it
    issue = get_issue(this_id)
    if issue is not None:
        if "media" in issue.details and issue.details["media"] is not None:
            delete_issue_media_file(issue.details["media"])

        with config.issueLock:
            config.issueList = [x for x in config.issueList if x.details["id"] != this_id]
            issue.refresh_last_update_date()
            save_issueList()


def save_issueList():
    """Write the current issueList to file"""

    issue_file = os.path.join(config.APP_PATH, "issues", "issues.json")

    with open(issue_file, "w", encoding="UTF-8") as file_object:
        json.dump([x.details for x in config.issueList], file_object)


# Set up log file
log_path = os.path.join(config.APP_PATH, "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)