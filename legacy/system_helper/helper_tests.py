import unittest

import helper
import config

class TestHelperMethods(unittest.TestCase):

    def setUp(self):

        config.defaults_dict["helper_port"] = 8000

    def test_get_local_address(self):

        self.assertEqual(helper.get_local_address().startswith("http://"), True)

    def test_parse_byte_range(self):

        self.assertEqual(helper.parse_byte_range(""), (None, None))
        self.assertEqual(helper.parse_byte_range("bytes=123-456"), (123, 456))
        self.assertEqual(helper.parse_byte_range("bytes=123-"), (123, None))

    def test_strToBool(self):

        self.assertEqual(helper.str_to_bool("false"), False)
        self.assertEqual(helper.str_to_bool("False"), False)
        self.assertEqual(helper.str_to_bool("true"), True)
        self.assertEqual(helper.str_to_bool("TRUE"), True)
        self.assertEqual(helper.str_to_bool("xyz"), False)

if __name__ == '__main__':
    unittest.main()
