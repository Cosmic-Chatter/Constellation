import datetime
import os
import unittest

import config
import constellation_exhibit as c_exhibit
import constellation_issues as c_issues
import constellation_maintenance as c_maint
import constellation_projector as c_proj
import constellation_schedule as c_sched
import constellation_tools as c_tools
import constellation_tracker as c_track


class TestHelperMethods(unittest.TestCase):

    def setUp(self) -> None:
        # Runs prior to each test

        config.componentList = []

        c_exhibit.create_new_exhibit("unittest", None)
        config.current_exhibit = "unittest"

        test_path = c_tools.get_path(["unittest_file.txt"], user_file=True)
        open(test_path, 'w').close()

    def tearDown(self) -> None:
        # Runs after each test

        test_path = c_tools.get_path(["unittest_file.txt"], user_file=True)
        if os.path.exists(test_path):
            os.remove(test_path)

    # constellation_exhibit tests

    def test_component_creation(self):
        test = c_exhibit.add_exhibit_component("Test ID", "Test group")
        self.assertEqual(test.id, 'Test ID')
        self.assertEqual(test.group, 'Test group')
        self.assertEqual(test.category, 'dynamic')
        self.assertEqual(test.seconds_since_last_contact() > 0, True)

        static = c_exhibit.add_exhibit_component("Static ID", "Static group", category="static")
        self.assertEqual(static.category, 'static')
        self.assertEqual(static.current_status(), 'STATIC')

        self.assertEqual(len(config.componentList), 2)
        static.remove()
        self.assertEqual(len(config.componentList), 1)

    def test_get_exhibit_component(self):
        test = c_exhibit.add_exhibit_component("Test ID", "Test group")
        test2 = c_exhibit.add_exhibit_component("Test ID 2", "Test group 2")
        self.assertEqual(c_exhibit.get_exhibit_component("Test ID"), test)
        self.assertEqual(c_exhibit.get_exhibit_component("Does Not Exist"), None)

    def test_update_synchronization_list(self):
        c_exhibit.update_synchronization_list("ID 1", ["ID 2", "ID 3"])
        self.assertEqual(config.synchronizationList[0]["ids"], ["ID 1", "ID 2", "ID 3"])
        self.assertEqual(config.synchronizationList[0]["checked_in"], [True, False, False])

        c_exhibit.update_synchronization_list("ID 2", ["ID 1", "ID 3"])
        self.assertEqual(config.synchronizationList[0]["ids"], ["ID 1", "ID 2", "ID 3"])
        self.assertEqual(config.synchronizationList[0]["checked_in"], [True, True, False])

        c_exhibit.update_synchronization_list("ID 4", ["ID 5"])
        self.assertEqual(config.synchronizationList[0]["ids"], ["ID 1", "ID 2", "ID 3"])
        self.assertEqual(config.synchronizationList[1]["ids"], ["ID 4", "ID 5"])

    def test_update_exhibit_component_status(self):
        # Update existing component
        test = c_exhibit.add_exhibit_component("Test 1", "Test Group 1")

        update = {
            "id": "Test 1",
            "group": "Test Group 1",
            "helperAddress": "192.168.1.2",
            "autoplay_audio": True,
            "imageDuration": 10,
            "currentInteraction": True,
            "allowed_actions": {
                "shutdown": True,
            },
            "constellation_app_id": "media_player"
        }

        c_exhibit.update_exhibit_component_status(update, "::1")
        self.assertEqual(test.ip_address, "localhost")
        self.assertEqual(test.helperAddress, "192.168.1.2")
        self.assertEqual(test.config["autoplay_audio"], True)
        self.assertEqual(test.config["image_duration"], 10)
        self.assertEqual(test.lastInteractionDateTime == datetime.datetime(2020, 1, 1), False)
        self.assertEqual("shutdown" in test.config["allowed_actions"], True)
        self.assertEqual(test.config["app_name"], "media_player")

        # Create component from update
        c_exhibit.update_exhibit_component_status({"id": "New ID", "group": "New Group"}, "10.8.0.12")
        lookup = c_exhibit.get_exhibit_component("New ID")
        self.assertEqual(lookup is not None, True)

    # constellation_issues

    def test_issues(self):
        details = {
            "id": "12345",
            "priority": "high",
            "issueName": "A test issue",
            "issueDescription": "Some useful info."
        }

        c_issues.create_issue(details)
        query = c_issues.get_issue("12345")

        self.assertEqual(query.details["priority"], "high")
        self.assertEqual(query.details["issueName"], "A test issue")
        self.assertEqual(query.details["issueDescription"], "Some useful info.")
        self.assertEqual(len(config.issueList), 1)

        c_issues.edit_issue({"id": "12345", "issueName": "A new name"})
        self.assertEqual(query.details["issueName"], "A new name")

        c_issues.remove_issue("12345")
        self.assertEqual(len(config.issueList), 0)

    # constellation_tools

    def test_delete_file(self):
        test_path = c_tools.get_path(["unittest_file.txt"], user_file=True)
        response = c_tools.delete_file(test_path)
        self.assertEqual(response["success"], True)
        self.assertEqual(os.path.exists(test_path), False)

        bad_path = c_tools.get_path(["bad_file.txt"], user_file=True)
        response = c_tools.delete_file(bad_path)
        self.assertEqual(response["success"], False)

    # constellation_tracker
    def test_JSON_list_to_CSV(self):
        simple_list = [{"item1": 1, "item2": 2}]
        self.assertEqual(c_track.JSON_list_to_CSV(simple_list), 'item1,item2\r\n1,2\r\n')

        nested_example = [{"item1":1,"item2": 2, "Animal": ['Cat', 'Dog', 'Bird']}]
        self.assertEqual(c_track.JSON_list_to_CSV(nested_example),
                         'Animal - Bird,Animal - Cat,Animal - Dog,item1,item2\r\nTrue,True,True,1,2\r\n')

    def test_get_unique_keys(self):
        test = [{"name": "Morgan", "height": "tall", "age": 32},
                {"name": "Doug", "height": "medium", "city": "Miami"}]
        self.assertEqual(sorted(c_track.get_unique_keys(test)), sorted(['age', 'city', 'height', 'name']))

    def test_get_unique_values(self):
        test = [{"name": "Morgan", "friends": ["Doug", "Katie", "Joanna", "Mike"]},
                {"name": "Doug", "friends": ["Jerry", "Joanna", "Tony", "Steve", "Katie"]}]
        self.assertEqual(sorted(c_track.get_unique_values(test, "friends")),
                         sorted(['Joanna', 'Katie', 'Mike', 'Tony', 'Doug', 'Jerry', 'Steve']))
