# System Helper

## Introduction

 System Helper provides an interface between the browser-based user interfaces and the underlying hardware. It is required for many Constellation components.

## Set up

### Installation

This application requires Python 3.6 or later.

#### First-time setup

The first time you use System Helper, you will need to install a series of Python packages. After downloading System Helper from GitHub, run this terminal command from within the directory:

```
python3 -m pip install --upgrade -r requirements.txt
```

#### Required packages

The following packages are required to use the system helper. For `pip`, they are listed in `requirements.txt`.

* [`sockio`](https://github.com/tiagocoutinho/sockio)
* [`pyserial`](https://github.com/pyserial/pyserial)
* [`psutil`](https://github.com/giampaolo/psutil)
* [`dateutil`](https://github.com/dateutil/dateutil)
* [`requests`](https://github.com/psf/requests)

For certain system operations on Windows, System Helper uses [NirCmd 2.86](https://www.nirsoft.net/utils/nircmd.html), a freeware utility distributed with this repository. Please note that NirCmd is not open source.

### Configuration
Every Constellation component on a system needs its own System Helper. Place the files in the same directory as the files for that component. For example, for a Media Player installation:

```
<your home directory>/
    media_player/
        <Media player files: media_player.html, etc.>
        helper.py
        config.py
        defaults.ini
```

#### defaults.ini

The `defaults.ini` file configures both a given instance of  System Helper and its related component software (media_player, word_cloud, etc.).

Required parameters:

* `id`: The unique name of a given component. No two components connected to the same control server can have the same `id`.
* `type`: A user-defined grouping of components. For example, if you have multiple screens each displaying similar information, you might assign them all the `type` of "INFO_SCREEN".
* `helper_port`: The port the helper's server should open for communication to the component.
* `server_ip_address`: The IP address of the control server this component should communicate with.
* `server_port`: The port on which the control server is listening.
* `current_exhibit`: The name of the current exhibit selected by the control server. After the first-time setup, this will be managed automatically.

Optional parameters:

* `allow_sleep` (default: true): Whether the control server is allowed to tell the computer to turn off the display. The exact effect of sleep is platform dependent.
* `allow_restart` (default: true): Whether the control server is allowed to tell the computer to restart. **If one PC is displaying multiple components on separate screens, this should generally be set to false.**
* `allow_shutdown` (default: false): Whether the control server is allowed to tell the computer to shutdown. **Unless the PC is configured for Wake on LAN, the control server will be unable to power on the machine once it is shut down,**
* `anydesk_id`: Supply an AnyDesk id corresponding to this device and a button will appear in the web console under Maintenance allowing an easy connection. You must have AnyDesk installed and configured for unattended access.
