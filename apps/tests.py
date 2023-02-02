import os
import unittest

import config
import helper_files
import helper_system
import helper_utilities


class TestHelperMethods(unittest.TestCase):

    def setUp(self) -> None:
        # Runs prior to each test
        config.defaults_dict["helper_port"] = 8000

        test_path = helper_files.get_path(["unittest_file.txt"], user_file=True)
        open(test_path, 'w').close()

    def tearDown(self) -> None:
        # Runs after each test

        test_path = helper_files.get_path(["unittest_file.txt"], user_file=True)
        if os.path.exists(test_path):
            os.remove(test_path)

    # helper_files
    def test_with_extension(self):
        self.assertEqual(helper_files.with_extension('test.mp4', 'jpg'), 'test.jpg')
        self.assertEqual(helper_files.with_extension('test.mp4', 'jpeg'), 'test.jpeg')
        self.assertEqual(helper_files.with_extension('/path/to/test.mp4', 'jpg'), '/path/to/test.jpg')
        self.assertEqual(helper_files.with_extension('/path/with.dots/test.mp4', 'jpg'), '/path/with.dots/test.jpg')

    def test_delete_file(self):
        file_path = helper_files.get_path(["unittest_file.txt"], user_file=True)

        # Given path is not in content, so this should fail
        self.assertRaises(FileNotFoundError, helper_files.delete_file, file_path)

        helper_files.delete_file(file_path, absolute=True)
        self.assertEqual(os.path.exists(file_path), False)

    def test_rename_file(self):
        file_path = helper_files.get_path(["unittest_file.txt"], user_file=True)
        file_path_2 = helper_files.get_path(["unittest_file2.txt"], user_file=True)

        # Cannot overwrite a real filename.
        self.assertEqual(helper_files.rename_file(file_path_2, file_path, absolute=True)["error"], "file_exists")

        # This should rename the file
        helper_files.rename_file(file_path, file_path_2, absolute=True)
        self.assertEqual(os.path.exists(file_path), False)
        self.assertEqual(os.path.exists(file_path_2), True)

        os.remove(file_path_2)

    def test_get_thumbnail_name(self):
        self.assertEqual(helper_files.get_thumbnail_name("test.mp4"), "test.mp4")
        self.assertEqual(helper_files.get_thumbnail_name("test.mov"), "test.mp4")
        self.assertEqual(helper_files.get_thumbnail_name("test.JPEG"), "test.jpg")
        self.assertEqual(helper_files.get_thumbnail_name("test.png"), "test.jpg")
        self.assertEqual(helper_files.get_thumbnail_name("test.ini"), "")

    # helper_utilities
    def test_check_dict_equality(self):
        self.assertEqual(helper_utilities.check_dict_equality(
            {1: 1, 2: 2},
            {1: 1, 2: 2}
        ), True)

        self.assertEqual(helper_utilities.check_dict_equality({}, {}), True)

        self.assertEqual(helper_utilities.check_dict_equality(
            {1: 1, 2: 2, 3: 3},
            {1: 1, 2: 2}
        ), False)

        self.assertEqual(helper_utilities.check_dict_equality(
            {1: 1, 2: 2},
            {1: 1, 2: 2, 3: 3}
        ), False)

        self.assertEqual(helper_utilities.check_dict_equality(
            {1: 1, 2: 2},
            {}
        ), False)

        self.assertEqual(helper_utilities.check_dict_equality(
            {1: 1, 2: 2},
            {"foo": 1, 2: 2}
        ), False)

    def test_get_local_address(self):
        self.assertEqual(helper_utilities.get_local_address().startswith("http://"), True)

    def test_str_to_bool(self):
        self.assertEqual(helper_utilities.str_to_bool("false"), False)
        self.assertEqual(helper_utilities.str_to_bool("False"), False)
        self.assertEqual(helper_utilities.str_to_bool("true"), True)
        self.assertEqual(helper_utilities.str_to_bool("TRUE"), True)
        self.assertEqual(helper_utilities.str_to_bool("xyz"), False)


if __name__ == '__main__':
    unittest.main()
