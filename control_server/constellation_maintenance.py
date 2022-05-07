import datetime
import dateutil.parser
import json
import os


def get_maintenance_report(file_path):
    """Retrieve key maintenance info from a maintenance record"""

    try:
        # First, get the most recent maintenance entry
        result = get_last_entry(file_path)

        # Then, calculate the maintenance stats
        entries = load_file(file_path)
        segments = segment_entries(entries)
        summary = summarize_segments(segments)
        response_dict = {"success": True,
                         "id": result["id"],
                         "date": result["date"],
                         "status": result["status"],
                         "notes": result["notes"],
                         "working_pct": summary["working"],
                         "not_working_pct": summary["not_working"],
                         "on_floor_pct": summary["on_floor"],
                         "off_floor_pct": summary["off_floor"]}
    except FileNotFoundError:
        response_dict = {"success": False,
                         "reason": "No maintenance record exists",
                         "status": "Off floor, not working",
                         "notes": "",
                         "working_pct": 0,
                         "not_working_pct": 100,
                         "on_floor_pct": 0,
                         "off_floor_pct": 100
                         }
    return response_dict


def get_last_entry(path):
    """Retrieve the last json entry from the given file"""

    with open(path, 'rb') as f:
        # Seek to the end of the file and return the most recent entry
        try:  # catch OSError in case of a one line file
            f.seek(-2, os.SEEK_END)
            while f.read(1) != b'\n':
                f.seek(-2, os.SEEK_CUR)
        except OSError:
            f.seek(0)
        last_line = f.readline().decode()

        try:
            result = json.loads(last_line)
        except json.JSONDecodeError:
            result = {"id": "UNKNOWN",
                      "date": datetime.datetime.now().isoformat(),
                      "status": "Off floor, not working",
                      "notes": ""}
        return result


def load_file(path):
    """Read the file into an list of dictionaries"""
    entries = []
    with open(path, "r", encoding="UTF-8") as f:
        for line in f.readlines():
            entry = json.loads(line)
            entry["datetime"] = dateutil.parser.isoparse(entry["date"])
            entries.append(entry)
    return entries


def segment_entries(entries):
    """Break the file into time intervals for the various sections"""

    num_entries = len(entries)
    segments = []
    i = 0
    while i < num_entries:
        # Use non-standard loop so we can skip entries as we combine
        entry = entries[i]
        segment = {}

        status_line = entry["status"].split(", ")
        segment["location"] = status_line[0].lower()
        segment["condition"] = status_line[1]

        # Now iterate forward to find the last entry with this same
        # location and condition

        j = 1
        while True:
            if i + j < num_entries:
                next_entry = entries[i + j]
                next_status_line = next_entry["status"].split(", ")
                if segment["location"] == next_status_line[0].lower() and \
                        segment["condition"] == next_status_line[1]:
                    j += 1
                else:
                    break
            else:
                next_entry = entry.copy()
                next_entry["datetime"] = datetime.datetime.now()
                next_entry["date"] = next_entry["datetime"].isoformat()
                break

        segment["duration"] = (next_entry["datetime"] - entry["datetime"]).total_seconds()
        segment["start_time"] = entry["date"]
        segment["end_time"] = next_entry["date"]
        segments.append(segment)
        # Skip the number of entries we have looped over
        i += j

    return segments


def summarize_segments(segments):
    """Take a list of segments and create a simple summary"""

    if len(segments) > 0:
        on_floor = sum([x["duration"] for x in segments if x["location"] == 'on floor'])
        off_floor = sum([x["duration"] for x in segments if x["location"] == 'off floor'])
        working = sum([x["duration"] for x in segments if x["condition"] == 'working'])
        not_working = sum([x["duration"] for x in segments if x["condition"] == 'not working'])

        on_floor_pct = round(on_floor / (on_floor + off_floor) * 100, 2)
        off_floor_pct = round(off_floor / (on_floor + off_floor) * 100, 2)
        working_pct = round(working / (working + not_working) * 100, 2)
        not_working_pct = round(not_working / (working + not_working) * 100, 2)
    else:
        on_floor_pct = 0
        off_floor_pct = 0
        working_pct = 0
        not_working_pct = 0

    return {"on_floor": on_floor_pct,
            "off_floor": off_floor_pct,
            "working": working_pct,
            "not_working": not_working_pct}