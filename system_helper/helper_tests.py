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

        self.assertEqual(helper.strToBool("false"), False)
        self.assertEqual(helper.strToBool("False"), False)
        self.assertEqual(helper.strToBool("true"), True)
        self.assertEqual(helper.strToBool("TRUE"), True)
        self.assertEqual(helper.strToBool("xyz"), False)

if __name__ == '__main__':
    unittest.main()
