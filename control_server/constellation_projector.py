# Standard imports
import logging
import os.path
import threading
import time

# Constellation imports
import config
import constellation_tools as c_tools
import constellation_exhibit as c_exhibit
import constellation_maintenance as c_maint


def get_projector(projector_id: str = "", projector_uuid: str = "") -> c_exhibit.Projector | None:
    """Return a projector with the given id or uuid, or None if no such projector exists"""

    if projector_uuid != "" and projector_id != "":
        raise ValueError("Must specify only one of 'projector_id' or 'projector_uuid'")
    elif projector_uuid == "" and projector_id == "":
        raise ValueError("Must specify one of 'projector_id' or 'projector_uuid'")

    if projector_id != "":
        return next((x for x in config.projectorList if x.id == projector_id), None)
    if projector_uuid != "":
        return next((x for x in config.projectorList if x.uuid == projector_uuid), None)
    return None

def poll_projectors():
    """Ask each projector to send a status update at an interval.
    """

    for projector in config.projectorList:
        new_thread = threading.Thread(target=projector.update, name=f"PollProjector_{projector.id}_{str(time.time())}")
        new_thread.daemon = True  # So it dies if we exit
        new_thread.start()

    config.polling_thread_dict["poll_projectors"] = threading.Timer(10, poll_projectors)
    config.polling_thread_dict["poll_projectors"].daemon = True
    config.polling_thread_dict["poll_projectors"].start()


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
