# Standard modules
import datetime
import os.path
import uuid

# Non-standard modules
import argon2

# Constellation modules
import config
import constellation_tools as c_tools


class User:
    """A Constellation user account."""

    def __init__(self,
                 username: str,
                 display_name: str,
                 password_hash: str,
                 permissions_dict=None,
                 uuid_str: str = ""):
        """Create a new User"""

        if permissions_dict is None:
            permissions_dict = {
                "analytics": "none",
                "components": {
                    "edit": [],
                    "view": []
                },
                "maintenance": "none",
                "schedule": "view",
                "settings": "none",
            }
        self.username = username
        self.display_name = display_name
        self.password_hash = password_hash
        self.permissions = permissions_dict
        self.last_activity = datetime.datetime.now().isoformat()

        if uuid_str == "":
            self.uuid = str(uuid.uuid4())
        else:
            self.uuid = uuid_str

    def get_dict(self) -> dict:
        """Return a JSON representation of this user."""

        return {
            "username": self.username,
            "display_name": self.display_name,
            "password_hash": self.password_hash,
            "permissions": self.permissions,
            "uuid": self.uuid
        }

    def update_last_activity(self):
        """Set the last activity time ot now."""

        self.last_activity = datetime.datetime.now().isoformat()


def create_root_admin(password: str):
    """Create the root admin by saving a hashed password to disk. """

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)

    password_hash = str(argon2.hash_password(bytes(password, 'UTF-8'), None), encoding='UTF-8')
    with config.galleryConfigurationLock:
        with open(path, 'w', encoding='UTF-8') as f:
            f.write(password_hash)


def check_for_root_admin():
    """Check that the file root_admin.txt exists or prompt to create it."""

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)
    if not os.path.exists(path):
        c_tools.clear_terminal()
        print("##########################################################")
        print("Welcome to Constellation Control Server!")
        print("")
        print("Access to Constellation is controlled by a user account")
        print("system. To begin, you must create a password for the root")
        print("admin account. You will be able to use this password to")
        print("create your first admin account, who can then create other")
        print("accounts.")
        print("")
        pass1 = ""
        pass2 = ""
        match = False
        while match is False:
            while pass1.strip() == "":
                pass1 = input("Enter password: ").strip()
                if pass1 == "":
                    print("Password cannot be blank!")
            while pass2.strip() == "":
                pass2 = input("Re-enter password to confirm: ").strip()
            if pass1 == pass2:
                match = True
            else:
                print("Passwords do not math. Please try again!")
                pass1 = ""
                pass2 = ""
        create_root_admin(pass1)


def load_users():
    """Read users.json and build a User for each."""

    config.user_list = []  # Clear existing users

    path = c_tools.get_path(["configuration", "users.json"], user_file=True)

    users = c_tools.load_json(path)
    if users is None:
        return

    for user in users:
        config.user_list.append(User(user["username"],
                                     user["display_name"],
                                     user["password_hash"],
                                     permissions_dict=user["permissions"],
                                     uuid_str=user["uuid"])
                                )


def save_users():
    """Write users.json to file."""

    dict_list = []
    for user in config.user_list:
        dict_list.append(user.get_dict())

    path = c_tools.get_path(["configuration", "users.json"], user_file=True)
    c_tools.write_json(dict_list, path)
