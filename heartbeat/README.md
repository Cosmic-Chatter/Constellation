# Heartbeat

## Introduction

Heartbeat enables you to add system monitoring without the use of a full-fledged **_Constellation_** application. It is a lightweight Python app that mediates the interface with the system helper in a way that mirrors other **_Constellation_** packages.

## Setting up Heartbeat

### Installation

This application requires Python 3.6 or later. You must also run an instance of System Helper on the machine you wish to monitor.

#### Required packages

The following packages are required to use the system helper. For `pip`, they are listed in `requirements.txt`.

* [`requests`](https://github.com/psf/requests)

#### Configuring heartbeat

By default, Heartbeat attempts to connect to an instance of System Helper at the address `http://localhost:8000`. This is the default System Helper address, but if you have changed that address, you must make the corresponding change in `config.py`.

To set the IP address of System Helper, replace it on the following line:

```
helper_address = "http://localhost:8000"

```
