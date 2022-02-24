# SOS Kiosk

## Introduction

SOS Kiosk provides a user-facing interface to enable visitor interaction with [NOAA Science on a Sphere](https://sos.noaa.gov). It also serves as the basis for SOS Screen Player, which can display additional information matching the currently-playing SOS dataset.

## Terminology

* `dataset`: The name for a single Science on a Sphere visualization.
* `playlist`: A looping series of `datasets` defined through the Science on a Sphere system.

## Setting up SOS Kiosk

### Installation

SOS Kiosk must be installed on your Science on a Sphere control computer. It requires Python 3.6 or newer. Installation steps:

1. Download the files from GitHub and place them somewhere permanent.
3. From System Helper, download `helper.py`, `config.py`, and `requirements.txt`. Place them in the same directory as the SOS Kiosk files.
4. From a terminal within the directory, run `python3 -m pip install --upgrade -r requirements.txt`.

### Running SOS Kiosk

To start SOS Kiosk, follow the following steps:

1. Ensure you have properly configured `defaults.ini` as described below.
2. In a terminal, navigate to the installation directory.
3. Launch the server with the command `python3 kiosk_server.py`
4. In a supported browser on the kiosk device, navigate to the following webpage: `http://<Your SOS IP address>:<Your port>/SOS_kiosk.py`.
