"""Manage variables for heartbeat.py"""

this_id: str = "UNKNOWN"
this_type: str = "UNKNOWN"
helper_address: str = "http://localhost:8000"
server_address: str = "http://localhost:8082"
allowed_actions: dict[str: bool] = {}
error_dict: dict = {}
AnyDesk_id: str = ""
