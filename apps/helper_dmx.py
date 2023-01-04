# Standard imports

# Non-standard imports
from PyDMXControl.controllers import OpenDMXController, uDMXController
from PyDMXControl.profiles.defaults import Fixture


# Constellation modules
import config


class DMXUniverse:
    """A DMX controller and up to 32 fixtures."""

    def __init__(self, name: str, controller: str = "OpenDMX"):

        self.name: str = name
        self.fixtures: dict[str, DMXFixture] = {}

        if controller == "OpenDMX":
            self.controller = OpenDMXController()
        elif controller == "uDMX":
            self.controller = uDMXController()
        else:
            raise ValueError("'controller' must be one of 'OpenDMX' or 'uDMX'.")

    def create_fixture(self, name: str, start_channel: int) -> 'DMXFixture':
        """Create a fixture, add it to the universe, and optionally to a group."""

        if len(self.fixtures) == 32:
            # We have reached the maximum limit for this universe
            raise AttributeError("A DMX universe cannot contain more than 32 fixtures.")

        fixture = DMXFixture(name, start_channel)
        self.fixtures[name] = fixture

        return fixture


class DMXFixture(Fixture):
    """Constellation object for a DMX fixture"""

    def __init__(self, name, start_channel):
        super().__init__(name=name,
                         start_channel=start_channel)


class DMXFixtureGroup:
    """Hold a collection of DMXFixtures."""

    def __init__(self, name):
        self.name: str = name
        self.fixtures: list = []

    def add_fixtures(self, fixture_list: list[DMXFixture]):
        """Add one or more DMXFixtures to the group."""

        for fixture in fixture_list:
            self.fixtures.append(fixture)


class DMXScene:
    """A collection of values for DMX fixtures."""

    def __init__(self, name):
        self.name = name
