# Standard imports
import logging
import threading
import time

# Constellation imports
import config
import constellation_tools as c_tools
import constellation_exhibit as c_exhibit
import constellation_maintenance as c_maint


def get_projector(this_id: str) -> c_exhibit.Projector:
    """Return a projector with the given id, or None if no such projector exists"""

    return next((x for x in config.projectorList if x.id == this_id), None)


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


def read_projector_configuration():
    """Read the projectors.json configuration file and set up any new projectors."""

    config_path = c_tools.get_path(["configuration", "projectors.json"], user_file=True)
    proj_config = c_tools.load_json(config_path)
    if proj_config is None:
        return
    for proj in config.projectorList:
        proj.clean_up()
    config.projectorList = []

    for proj in proj_config:
        if get_projector(proj["id"]) is None:
            new_proj = c_exhibit.Projector(proj["id"],
                                           proj.get("group", "Projectors"),
                                           proj.get('ip_address', ''), "pjlink",
                                           password=proj.get("password", None))

            # Check if device has an existing maintenance status.
            maintenance_path = c_tools.get_path(["maintenance-logs", proj["id"] + '.txt'], user_file=True)
            new_proj.config["maintenance_status"] = c_maint.get_maintenance_report(maintenance_path)["status"]
            config.projectorList.append(new_proj)

    config.last_update_time = time.time()


# Set up log file
log_path = c_tools.get_path(["control_server.log"], user_file=True)
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
