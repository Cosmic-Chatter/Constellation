# Standard imports
from typing import Any, Union

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
            raise ValueError("'controller' must be one of 'OpenDMX' or 'uDMX'.")

    def create_fixture(self, name: str, start_channel: int, channel_list: list[str]) -> 'DMXFixture':
        """Create a fixture, add it to the universe."""

        if len(self.fixtures) == 32:
            # We have reached the maximum limit for this universe
            raise AttributeError("A DMX universe cannot contain more than 32 fixtures.")

        fixture = DMXFixture(name, start_channel, channel_list)
        fixture.universe = self.name
        self.fixtures[name] = fixture

        self.controller.add_fixture(fixture)

        return fixture

    def get_fixture(self, name: str) -> Union['DMXFixture', None]:

        if "name" in self.fixtures:
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

    def __init__(self, name, start_channel, channel_list):
        super().__init__(name=name,
                         start_channel=start_channel)

        for channel in channel_list:
            self._register_channel(channel)

        self.universe = ""

    def __repr__(self, *args, **kwargs):
        return f"[DMXFixture: {self.name}]"

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
            "channels": channel_list
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
            self.fixtures[fixture.name] = fixture

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

    def create_scene(self, name, values) -> 'DMXScene':

        self.scenes[name] = DMXScene(name, values)

    def show_scene(self, name):
        """Find the given scene and set it."""

        if name not in self.scenes:
            raise ValueError("A scene with this name does not exist:", name)

        for key in self.scenes[name].values:
            entry = self.scenes[name].values[key]
            if "duration" in entry:
                duration = entry["duration"]
            else:
                duration = 0
            if "brightness" in entry:
                self.fixtures[key].set_brightness(entry["brightness"], duration)
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

    def __init__(self, name:str, values: dict[str, dict[str, Any]]):
        self.name: str  = name
        self.values: dict[str, dict[str, Any]] = values

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


def get_fixture(name: str, group="", universe="") -> Union[DMXFixture, None]:
    """Return the matched fixture from the appropriate location, if it exists."""

    if group == "" and universe == "":
        raise ValueError("You must specify one of group= or universe=")
    elif group != "" and universe != "":
        raise ValueError("You must specify either group= or universe=, not both.")

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

    config_path = helper_files.get_path(["configuration", "dmx.json"], user_file=True)
    helper_files.write_json(config_dict, config_path)

def read_dmx_configuration() -> None:
    """Read dmx.json and turn it into a set of universes, fixtures, and groups."""

    config_path = helper_files.get_path(["configuration", "dmx.json"], user_file=True)
    config_dict = helper_files.load_json(config_path)

    # First, create any universes
    config.dmx_universes = {}
    universe_config = config_dict["universes"]
    
    for entry in universe_config:
        uni = create_universe(entry["name"], entry["controller"])
        for fix in entry["fixtures"]:
            uni.create_fixture(fix["name"], fix["start_channel"], fix["channels"])
    
    print(config.dmx_universes["Main"].fixtures)

    # Then, create any groups
    config.dmx_groups = {}
    group_config = config_dict["groups"]

    for entry in group_config:
        group = create_group(entry["name"])
        for subentry in entry["fixtures"]:
            print(subentry)
            fixture = get_fixture(subentry["name"], universe=subentry["universe"])
            group.add_fixtures([fixture])
        for scene in entry["scene"]:
            group.create_scene(scene["name"], scene["values"])
