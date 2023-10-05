# Standard imports
import datetime
import json
import logging
import os
import time
from typing import Any, Union
import uuid

# Constellation imports
import config
import constellation_tools as c_tools


class Issue:
    """Contains information relevant for tracking an issue."""

    def __init__(self, details):
        """Populate the Issue with the information stored in a dictionary"""

        self.details = {}
        now_date = datetime.datetime.now().isoformat()
        self.details["id"] = details.get("id", str(uuid.uuid4()))
        self.details["creationDate"] = details.get("creationDate", now_date)
        self.details["lastUpdateDate"] = details.get("lastUpdateDate", now_date)
        self.details["priority"] = details.get("priority", "medium")
        self.details["issueName"] = details.get("issueName", "New Issue")
        self.details["issueDescription"] = details.get("issueDescription", "")
        self.details["relatedComponentIDs"] = details.get("relatedComponentIDs", [])
        self.details["assignedTo"] = details.get("assignedTo", [])
        self.details["media"] = details.get("media", None)

    def __repr__(self):
        return repr(f"[Issue Name: {self.details['issueName']}]")

    def refresh_last_update_date(self):
        self.details["lastUpdateDate"] = datetime.datetime.now().isoformat()
        config.issueList_last_update_date = self.details["lastUpdateDate"]


def delete_issue_media_file(file: str, owner: Union[str, None] = None) -> None:
    """Delete a media file from an issue"""

    file_path = c_tools.get_path(["issues", "media", file], user_file=True)
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
            issue.refresh_last_update_date()
            save_issue_list()
        config.last_update_time = time.time()


def create_issue(details: dict[str, Any]) -> Issue:
    """Create a new issue and add it to the issueList"""

    with config.issueLock:
        new_issue = Issue(details)
        config.issueList.append(new_issue)
    config.last_update_time = time.time()
    return new_issue


def edit_issue(details: dict) -> None:
    """Edit issue with the id given in details dict"""
    if "id" in details:
        issue = get_issue(details["id"])
        with config.issueLock:
            issue.details = issue.details | details
            issue.refresh_last_update_date()
        config.last_update_time = time.time()


def get_issue(this_id: str) -> Issue:
    """Return an Issue with the given id, or None if no such Issue exists"""

    return next((x for x in config.issueList if x.details["id"] == this_id), None)


def remove_issue(this_id: str) -> None:
    """Remove an Issue with the given id from the issueList"""

    # First, if there is a media file, delete it
    issue = get_issue(this_id)
    if issue is not None:
        if "media" in issue.details and issue.details["media"] is not None:
            delete_issue_media_file(issue.details["media"])

        with config.issueLock:
            config.issueList = [x for x in config.issueList if x.details["id"] != this_id]
            issue.refresh_last_update_date()
            save_issue_list()
    config.last_update_time = time.time()


def read_issue_list() -> None:
    """Read issues.json and set up the issueList"""

    try:
        issue_file = c_tools.get_path(["issues", "issues.json"], user_file=True)
        with open(issue_file, "r", encoding="UTF-8") as file_object:
            issues = json.load(file_object)

        for issue in issues:
            create_issue(issue)
    except FileNotFoundError:
        print("No stored issues to read")


def save_issue_list() -> None:
    """Write the current issueList to file"""

    issue_file = c_tools.get_path(["issues", "issues.json"], user_file=True)

    with open(issue_file, "w", encoding="UTF-8") as file_object:
        json.dump([x.details for x in config.issueList], file_object, indent=2, sort_keys=True)


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
