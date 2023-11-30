# Standard modules
import datetime
import os.path
import uuid

# Non-standard modules
import argon2
from cryptography.fernet import Fernet

# Constellation modules
import config
import constellation_tools as c_tools

password_hasher = argon2.PasswordHasher(time_cost=1,
                                        memory_cost=1024,
                                        parallelism=1,
                                        hash_len=24,
                                        type=argon2.Type.ID)


class User:
    """A Constellation user account."""

    def __init__(self,
                 username: str,
                 display_name: str,
                 password_hash: str,
                 permissions_dict: dict | None = None,
                 uuid_str: str = ""):
        """Create a new User"""

        if permissions_dict is None:
            permissions_dict = {
                "analytics": "none",
                "components": {
                    "edit": [],
                    "view": []
                },
                "exhibits": "none",
                "maintenance": "none",
                "schedule": "view",
                "settings": "none",
                "users": "none"
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

    def authenticate(self, password: str) -> bool:
        try:
            result = password_hasher.verify(self.password_hash, password)
        except argon2.exceptions.VerificationError:
            result = False
        return result

    def check_permission(self, action, needed_level) -> bool:
        """Check if the user has sufficient permission to perform an action"""

        if action != "components":
            allowed_level = self.permissions.get(action, "none")
            if needed_level == "edit":
                if allowed_level == "edit":
                    return True
                return False
            if needed_level == "view":
                if allowed_level == "edit" or allowed_level == "view":
                    return True
                return False
            if needed_level == "none":
                return True
        return False


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


def get_encryption_key() -> bytes:
    """Retrieve the encryption key or create it if it doesn't exist."""

    if config.encryption_key is None:
        key_path = c_tools.get_path(["configuration", "encryption_key.txt"], user_file=True)
        if os.path.exists(key_path):
            # Load key from disk
            with open(key_path, 'r', encoding='UTF-8') as f:
                key_str = f.read()
                config.encryption_key = bytes(key_str, 'UTF-8')
        else:
            # Generate new key
            config.encryption_key = Fernet.generate_key()
            with open(key_path, 'w', encoding='UTF-8') as f:
                f.write(str(config.encryption_key, 'UTF-8'))

    return config.encryption_key


def encrypt_token(username: str) -> str:
    """Encrypt the username as a token and return it."""

    f = Fernet(get_encryption_key())
    token = f.encrypt(bytes(username, 'UTF-8'))
    return str(token, 'UTF-8')


def decrypt_token(token: str) -> str:
    """Decrypt a token and return the username."""

    f = Fernet(get_encryption_key())
    username = f.decrypt(token)
    return str(username, 'UTF-8')


def create_root_admin(password: str):
    """Create the root admin by saving a hashed password to disk. """

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)

    password_hash = password_hasher.hash(bytes(password, 'UTF-8'),
                                         salt=bytes("Constellation", "UTF-8"))
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
        print("manage other accounts.")
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


def get_user(username: str = '', uuid_str: str = '') -> User | None:
    """Return the user matching either the given username or uuid_str."""

    if username == '' and uuid_str == '':
        raise ValueError("Must supply one of 'username' or 'uuid_str'")
    if username != '' and uuid_str != '':
        raise ValueError("Must supply only one of 'username' or 'uuid_str'")

    username = username.lower()

    if username == 'admin':
        filtered = [get_admin()]
    elif username != '':
        filtered = [x for x in config.user_list if x.username == username]
    else:
        filtered = [x for x in config.user_list if x.uuid == uuid_str]

    if len(filtered) > 0:
        return filtered[0]
    return None


def create_user(username: str,
                display_name: str,
                password: str,
                permissions: str | None = None) -> tuple[bool, dict]:
    """Create a new user."""

    if check_username_available(username) is False:
        if config.debug:
            print(f"create_user: error: username {username} exists")
        return False, {}

    password_hash = password_hasher.hash(bytes(password, 'UTF-8'),
                                         salt=bytes("Constellation", "UTF-8"))
    new_user = User(username,
                    display_name,
                    password_hash,
                    permissions_dict=permissions)
    config.user_list.append(new_user)
    save_users()
    return True, new_user.get_dict()


def check_username_available(username: str) -> bool:
    """Check if the given username has already been claimed."""

    username = username.lower()  # Usernames are case-insensitive

    if username == 'admin':
        return False

    filtered = [x for x in config.user_list if x.username.lower() == username]
    if len(filtered) > 0:
        return False
    return True


def authenticate_user(token: str = "", credentials: tuple[str, str] = ("", "")) -> tuple[bool, str]:
    """Authenticate the user using either a username/password or a token.

    If the user is authenticated successfully, return the matching username.
    """

    if token != "" and credentials != ("", ""):
        raise ValueError("Supply only a token or credentials, not both.")

    if token == "" and credentials == ("", ""):
        raise ValueError("You must supply a token or a tuple of credentials.")

    if token != "":
        username = decrypt_token(token)
        user = get_user(username=username)
        if user is None:
            return False, ""
        return True, username

    username, password = credentials
    user = get_user(username=username)

    if user is None:
        return False, ""
    success = user.authenticate(password)
    if success is True:
        return True, username
    return False, ""


def get_admin():
    """Return a dummy user account containing the admin details"""

    path = c_tools.get_path(["configuration", "root_admin.txt"], user_file=True)
    with config.galleryConfigurationLock:
        with open(path, 'r', encoding='UTF-8') as f:
            admin_pass = f.read()

    return User("admin", "Admin", admin_pass, {
        "analytics": "edit",
        "components": {
            "edit": ["__all"],
            "view": ["__all"]
        },
        "exhibits": "edit",
        "maintenance": "edit",
        "schedule": "edit",
        "settings": "edit",
        "users": "edit"
    })
