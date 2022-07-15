# Standard imports
import configparser
import datetime
import dateutil
import logging
import os
import _thread
import threading

# Constellation imports
import config
import constellation_exhibit as c_exhibit


def check_event_schedule():
    """Read the "Next event" tuple in schedule_dict and take action if necessary
    Also check if it's time to reboot the server"""

    if config.nextEvent["date"] is not None:
        if datetime.datetime.now() > config.nextEvent["date"]:
            # Execute action
            next_action = config.nextEvent["action"]
            target = None
            value = None
            if isinstance(next_action, list):
                if len(next_action) == 1:
                    action = next_action[0]
                elif len(next_action) == 2:
                    action = next_action[0]
                    target = next_action[1]
                elif len(next_action) == 3:
                    action = next_action[0]
                    target = next_action[1]
                    value = next_action[2]
                else:
                    print(f"Error: unrecognized event format: {next_action}")
                    with config.logLock:
                        logging.error("Unrecognized event format: %s", next_action)
                    queue_next_on_off_event()
                    return

                if action == 'reload_schedule':
                    retrieve_schedule()
                elif action == 'set_content' and target is not None and value is not None:
                    if isinstance(value, str):
                        value = [value]
                    if target.startswith("__id_"):
                        target = target[5:]
                    print(f"Changing content for {target} to {value}")
                    logging.info("Changing content for %s to %s", target, value)
                    c_exhibit.set_component_content(target, value)
                elif action == 'set_exhibit' and target is not None:
                    print("Changing exhibit to:", target)
                    logging.info("Changing exhibit to %s", target)
                    c_exhibit.read_exhibit_configuration(target, update_default=True)

                    # Update the components that the configuration has changed
                    for component in config.componentList:
                        component.update_configuration()
                elif target is not None:
                    if target == "__all":
                        c_exhibit.command_all_exhibit_components(action)
                    elif target.startswith("__type"):
                        this_type = target[7:]
                        if this_type == "PROJECTOR":
                            for projector in config.projectorList:
                                projector.queue_command(action)
                        elif this_type == "WAKE_ON_LAN":
                            for device in config.wakeOnLANList:
                                device.queue_command(action)
                        else:
                            for component in config.componentList:
                                if component.type == this_type:
                                    component.queue_command(action)
                    elif target.startswith("__id"):
                        c_exhibit.get_exhibit_component(target[5:]).queue_command(action)
                else:
                    c_exhibit.command_all_exhibit_components(action)
                    # print(f"DEBUG: Event executed: {config.nextEvent['action']} -- THIS EVENT WAS NOT RUN")
                queue_next_on_off_event()

    # Check for server reboot time
    if config.serverRebootTime is not None:
        if datetime.datetime.now() > config.serverRebootTime:
            config.rebooting = True
            _thread.interrupt_main()


def check_if_schedule_time_exists(path: str, time_to_set) -> bool:
    """Check the schedule given by `path` for an existing item with the same time as `time_to_set`.
    """

    with config.scheduleLock:
        with open(path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                split = line.split("=")
                if len(split) == 2:
                    # We have a valid ini line
                    if dateutil.parser.parse(split[0]).time() == time_to_set:
                        return True
    return False


def delete_schedule_action(schedule: str, time_to_delete):
    """Delete an action from the specified schedule"""

    schedule_path = os.path.join(config.APP_PATH, "schedules", schedule + ".ini")
    output_text = ""
    time_to_delete = dateutil.parser.parse(time_to_delete).time()
    with config.scheduleLock:
        with open(schedule_path, 'r', encoding="UTF-8") as f:
            for line in f.readlines():
                split = line.split("=")
                if len(split) == 2:
                    # We have a valid ini line
                    if dateutil.parser.parse(split[0]).time() != time_to_delete:
                        # This line doesn't match, so add it for writing
                        output_text += line
                else:
                    output_text += line

        with open(schedule_path, 'w', encoding="UTF-8") as f:
            f.write(output_text)


def poll_event_schedule():
    """Periodically check the event schedule in an independent thread.
    """

    check_event_schedule()
    config.polling_thread_dict["eventSchedule"] = threading.Timer(10, poll_event_schedule)
    config.polling_thread_dict["eventSchedule"].start()


def retrieve_schedule():
    """Build a schedule for the next 21 days based on the available schedule files"""

    with config.scheduleLock:
        config.scheduleUpdateTime = (datetime.datetime.now() - datetime.datetime.utcfromtimestamp(0)).total_seconds()
        config.scheduleList = []  # Each entry is a dict for a day, in calendar order

        today = datetime.datetime.today().date()
        upcoming_days = [today + datetime.timedelta(days=x) for x in range(21)]

        for day in upcoming_days:
            day_dict = {"date": day.isoformat(),
                        "dayName": day.strftime("%A"),
                        "source": "none"}
            reload_datetime = datetime.datetime.combine(day, datetime.time(0, 1))
            # We want to make sure to reload the schedule at least once per day
            day_schedule = [[reload_datetime,
                             reload_datetime.strftime("%-I:%M %p"),
                             ["reload_schedule"]]]

            date_specific_filename = day.isoformat() + ".ini"  # e.g., 2021-04-14.ini
            day_specific_filename = day.strftime("%A").lower() + ".ini"  # e.g., monday.ini

            sources_to_try = [date_specific_filename, day_specific_filename, 'default.ini']
            source_dir = os.listdir(os.path.join(config.APP_PATH, "schedules"))
            schedule_to_read = None

            for source in sources_to_try:
                if source in source_dir:
                    schedule_to_read = os.path.join(config.APP_PATH, "schedules", source)
                    if source == date_specific_filename:
                        day_dict["source"] = 'date-specific'
                    elif source == day_specific_filename:
                        day_dict["source"] = 'day-specific'
                    elif source == "default.ini":
                        day_dict["source"] = 'default'
                    break

            if schedule_to_read is not None:
                parser = configparser.ConfigParser(delimiters="=")
                try:
                    parser.read(schedule_to_read)
                except configparser.DuplicateOptionError:
                    print("Error: Schedule cannot contain two actions with identical times!")
                if "SCHEDULE" in parser:
                    sched = parser["SCHEDULE"]
                    for key in sched:
                        time_ = dateutil.parser.parse(key).time()
                        event_time = datetime.datetime.combine(day, time_)
                        action = [s.strip() for s in sched[key].split(",")]
                        day_schedule.append([event_time, event_time.strftime("%-I:%M %p"), action])
                else:
                    print("retrieve_schedule: error: no INI section 'SCHEDULE' found!")
            day_dict["schedule"] = sorted(day_schedule)
            config.scheduleList.append(day_dict)
    queue_next_on_off_event()


def queue_next_on_off_event():
    """Consult schedule_dict and set the next datetime that we should send an on or off command"""

    now = datetime.datetime.now()  # Right now
    next_event_datetime = None
    next_action = None

    for day in config.scheduleList:
        sched = day["schedule"]
        for item in sched:
            if item[0] > now:
                next_event_datetime = item[0]
                next_action = item[2]
                break
        if next_event_datetime is not None:
            break

    if next_event_datetime is not None:
        config.nextEvent["date"] = next_event_datetime
        config.nextEvent["time"] = next_event_datetime.strftime("%-I:%M %p")
        config.nextEvent["action"] = next_action
        print(f"New event queued: {next_action}, {next_event_datetime}")
    else:
        print("No events to queue right now")


# Set up log file
log_path = os.path.join(config.APP_PATH, "control_server.log")
logging.basicConfig(datefmt='%Y-%m-%d %H:%M:%S',
                    filename=log_path,
                    format='%(levelname)s, %(asctime)s, %(message)s',
                    level=logging.DEBUG)
