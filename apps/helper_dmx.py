# Standard imports
import os.path
from typing import Any, Union
import uuid

# Non-standard imports
from PyDMXControl.controllers import OpenDMXController, uDMXController
from PyDMXControl.profiles.defaults import Fixture


# Constellation modules
import config
import helper_files


class DMXUniverse:
    """A DMX controller and up to 32 fixtures."""

    def __init__(self, name: str, controller: str = "OpenDMX", dynamic_frame=True):

        self.name: str = name
        self.fixtures: dict[str, DMXFixture] = {}
        self.controller_type = controller

        if controller == "OpenDMX":
            self.controller = OpenDMXController(dynamic_frame=dynamic_frame)
        elif controller == "uDMX":
            self.controller = uDMXController(dynamic_frame=dynamic_frame)
        else:
            raise ValueError(
                "'controller' must be one of 'OpenDMX' or 'uDMX'.")

    def create_fixture(self, name: str, start_channel: int, channel_list: list[str], uuid_str: str = "") -> 'DMXFixture':
        """Create a fixture, add it to the universe."""

        if len(self.fixtures) == 32:
            # We have reached the maximum limit for this universe
            raise AttributeError(
                "A DMX universe cannot contain more than 32 fixtures.")

        fixture = DMXFixture(name, start_channel, channel_list, uuid_str)
        fixture.universe = self.name
        self.fixtures[name] = fixture

        self.controller.add_fixture(fixture)
        config.dmx_fixtures.append(fixture)

        return fixture

    def remove_fixture(self, name: str):
        """Remove the given fixture from the universe."""
        fixture = self.get_fixture(name)

        fixture.universe = ""
        del self.fixtures[name]
        self.controller.del_fixture(fixture.id)

    def get_fixture(self, name: str) -> Union['DMXFixture', None]:

        if name in self.fixtures:
            return self.fixtures[name]

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary with the information necessary to rebuild this universe."""

        fixture_list = []
        for name in self.fixtures:
            fixture = self.fixtures[name]
            fixture_list.append(fixture.get_dict())

        the_dict = {
            "name": self.name,
            "controller": self.controller_type,
            "fixtures": fixture_list
        }
        return the_dict


class DMXFixture(Fixture):
    """Constellation object for a DMX fixture"""

    def __init__(self, name: str, start_channel: int, channel_list: list[str], uuid_str: str = ""):
        super().__init__(name=name,
                         start_channel=start_channel)

        for channel in channel_list:
            self._register_channel(channel)

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())  # A unique ID
        else:
            self.uuid = uuid_str
        self.universe: str = ""
        self.groups: set[str] = set()

    def __repr__(self, *args, **kwargs):
        return f"[DMXFixture: '{self.name}' in universe '{self.universe}' with channels {self.channel_usage}]"

    def __str__(self, *args, **kwargs):
        return f"[DMXFixture: '{self.name}' in universe '{self.universe}' with channels {self.channel_usage}]"

    def delete(self):
        """Remove the fixture from all its groups, then its universe."""

        # Remove from groups
        for group_name in self.groups.copy():
            group = get_group(group_name)
            group.remove_fixture(self.name)

        get_universe(self.universe).remove_fixture(self.name)

    def get_all_channel_values(self) -> dict[str, int]:
        """Return a dict with the current value of every channel."""

        result = {}
        for channel_index in self.channels:
            channel = self.channels[channel_index]
            result[channel["name"]] = channel["value"][0]

        return result

    def set_brightness(self, value, duration=0, *args, **kwargs):
        self.dim(value, duration, *args, **kwargs)

    def set_color(self, color, duration=0, *args, **kwargs):
        # print(color, duration)
        self.color(color, duration)

    def get_dict(self) -> dict[str, Any]:
        """Return a dict representing the necessary information to recreate this fixture"""

        channel_list = []
        for key in self.channels:
            channel = self.channels[key]
            channel_list.append(channel["name"])
        the_dict = {
            "name": self.name,
            "start_channel": self.start_channel,
            "channels": channel_list,
            "uuid": self.uuid
        }
        return the_dict


class DMXFixtureGroup:
    """Hold a collection of DMXFixtures."""

    def __init__(self, name):
        self.name: str = name
        self.fixtures: dict[str, DMXFixture] = {}
        self.scenes: dict[str, DMXScene] = {}

    def add_fixtures(self, fixture_list: list[DMXFixture]):
        """Add one or more DMXFixtures to the group."""

        for fixture in fixture_list:
            if fixture.name in self.fixtures:
                # Remove (same name may not be same object)
                self.fixtures[fixture.name].groups.delete(self.name)

            self.fixtures[fixture.name] = fixture
            fixture.groups.add(self.name)

    def remove_fixture(self, name: str):
        """Remove the specified fixture."""

        fixture = self.get_fixture(name)
        fixture.groups.remove(self.name)
        del self.fixtures[name]

    def get_fixture(self, name: str) -> Union[DMXFixture, None]:

        if name in self.fixtures:
            return self.fixtures[name]

    def set_brightness(self, value, duration=0, *args, **kwargs):
        """Set the brightness of all fixtures."""

        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.set_brightness(value, duration, *args, **kwargs)

    def set_color(self, color, duration=0, *args, **kwargs):
        """Set the color of all fixtures."""

        for key in self.fixtures:
            fixture = self.fixtures[key]
            fixture.set_color(color, duration, *args, **kwargs)

    def create_scene(self, name, values):
        """Create a new scene and add it to the list."""

        self.scenes[name] = DMXScene(name, values)

    def get_scene(self, name: str) -> Union['DMXScene', None]:
        if name in self.scenes:
            return self.scenes[name]

    def show_scene(self, name):
        """Find the given scene and set it."""

        if name not in self.scenes:
            raise ValueError("A scene with this name does not exist:", name)

        for key in self.scenes[name].values:
            if key in self.fixtures:
                entry = self.scenes[name].values[key]
                if "duration" in entry:
                    duration = entry["duration"]
                else:
                    duration = 0
                if "brightness" in entry:
                    self.fixtures[key].set_brightness(
                        entry["brightness"], duration)
                if "color" in entry:
                    self.fixtures[key].set_color(entry["color"], duration)

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary that can be used to rebuild this group."""

        scene_list = []
        for name in self.scenes:
            scene = self.scenes[name]
            scene_list.append(scene.get_dict())

        fixture_list = []
        for name in self.fixtures:
            fixture = self.fixtures[name]
            fixture_list.append({
                "name": name,
                "uuid": fixture.uuid,
                "universe": fixture.universe
            })

        the_dict = {
            "name": self.name,
            "fixtures": fixture_list,
            "scenes": scene_list
        }
        return the_dict


class DMXScene:
    """A collection of values for DMX fixtures.

        Each entry in the outer dict is the name of a fixture.
        Each entry in the inner dict is a parameter to set for that fixture.
        Options: brightness, color
    """

    def __init__(self, name: str, values: dict[str, dict[str, Any]]):
        self.name: str = name
        self.values: dict[str, dict[str, Any]] = values

    def set_values(self, values: dict[str, dict[str, Any]]):
        """Change the value of self.values."""

        self.values = values

    def get_dict(self) -> dict[str, Any]:
        """Return a dictionary that can be used to rebuild this scene."""

        the_dict = {
            "name": self.name,
            "values": self.values
        }
        return the_dict


def create_group(name: str) -> DMXFixtureGroup:
    """Create a new DMXFixtureGroup and add it to config.dmx_groups."""

    new_group = DMXFixtureGroup(name)
    config.dmx_groups[name] = new_group

    return new_group


def create_universe(name: str, controller: str = "OpenDMX", dynamic_frame=True) -> DMXUniverse:
    """Create a new DMXUniverse and add it to config.dmx_universes."""

    new_universe = DMXUniverse(name, controller, dynamic_frame=dynamic_frame)
    config.dmx_universes[name] = new_universe

    return new_universe


def get_fixture(name: str = "",
                group: str = "",
                universe: str = "",
                uuid: Union[uuid.UUID, str] = "") -> Union[DMXFixture, None]:
    """Return the matched fixture from the appropriate location, if it exists."""

    if group == "" and universe == "" and uuid == "":
        raise ValueError("You must specify one of group=, universe=, uuid=")
    if (group != "" or universe != "") and name == "":
        raise ValueError(
            "You must specify name= if you use group= or universe=")

    if uuid != "":
        search = [x for x in config.dmx_fixtures if x.uuid == uuid]
        if len(search) > 0:
            return search[0]
        return None
    if group != "":
        return get_group(group).get_fixture(name)
    elif universe != "":
        return get_universe(universe).get_fixture(name)


def get_group(name: str) -> Union[DMXFixtureGroup, None]:
    """Return the matching DMXFixtureGroupo."""

    if name in config.dmx_groups:
        return config.dmx_groups[name]


def get_universe(name: str) -> Union[DMXUniverse, None]:
    """Return the matching DMXUniverse."""

    if name in config.dmx_universes:
        return config.dmx_universes[name]


def write_dmx_configuration() -> None:
    """Use config.dmx_universes and config.dmx_groups to write dmx.json."""

    config_dict = {}
    universe_list = []
    group_list = []

    for name in config.dmx_universes:
        universe = config.dmx_universes[name]
        universe_list.append(universe.get_dict())

    for name in config.dmx_groups:
        group = config.dmx_groups[name]
        group_list.append(group.get_dict())

    config_dict = {
        "universes": universe_list,
        "groups": group_list
    }

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    helper_files.write_json(config_dict, config_path)


def read_dmx_configuration() -> bool:
    """Read dmx.json and turn it into a set of universes, fixtures, and groups."""

    config_path = helper_files.get_path(
        ["configuration", "dmx.json"], user_file=True)
    if not os.path.exists(config_path):
        return False

    config_dict = helper_files.load_json(config_path)

    # First, create any universes
    config.dmx_universes = {}
    universe_config = config_dict["universes"]

    for entry in universe_config:
        uni = create_universe(entry["name"], entry["controller"])
        for fix in entry["fixtures"]:
            uni.create_fixture(
                fix["name"], fix["start_channel"], fix["channels"], uuid_str=fix["uuid"])

    # Then, create any groups
    config.dmx_groups = {}
    group_config = config_dict["groups"]

    for entry in group_config:
        group = create_group(entry["name"])
        for subentry in entry["fixtures"]:
            fixture = get_fixture(uuid=subentry["uuid"])
            group.add_fixtures([fixture])
        for scene in entry["scenes"]:
            group.create_scene(scene["name"], scene["values"])

    return True


def activate_dmx() -> bool:
    """Perform setup actions to get ready to use DMX in Constellation.

    Returns True is DMX has been successfully activated (already or just now) and False otherwise.
    """

    if not config.dmx_active:
        config.dmx_active = read_dmx_configuration()

    return config.dmx_active
