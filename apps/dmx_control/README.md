# DMX Control
DMX Control provides a flexible interface for controlling DMX lighting systems. Manage multiple universes seamlessly using groups and create scenes to recall lighting presets.

## Limitations
* Requires an OpenDMX or uDMX hardware adapter.
* Supports static lighting scenes (no loops or animations).
* Works best with a wired network connection.

## Configuration

### Choosing hardware
To interface with a DMX universe, you need a hardware DMX controller. DMX Control supports two devices, [OpenDMX](https://www.enttec.com/product/lighting-communication-protocols/dmx512/open-dmx-usb/) and [uDMX](https://www.anyma.ch/research/udmx/). Development work has happened exclusively with OpenDMX, so that is the suggested device.

### Networking
If you plan to edit the DMX configuration from the device connected to the DMX controller, the network does not matter. However, if you plan to do configuration from a remote device (accessed, for instance, from Control Server), a fast, low-latency connection is important. To enable realtime lighting control, DMX Control sends many commands over the network during configuration. This works much more smoothly with a wired Ethernet connection.

### Operating system
#### Linux
DMX Control has been tested on Ubuntu 20.04 and 22.04. To communicate with the DMX controller, you must enable access to `USBtty` devices using the command line. First, add your user account to the `dialout` group by running:

`sudo usermod -a -G dialout $USER`

Then, create an udev rules file:

`sudo nano /etc/udev/rules.d/99-escpos.rules`

and add the following line inside:

`SUBSYSTEM==“usb”, MODE=“0666”, GROUP=“dialout"`

Reboot your computer and the DMX controller should connect.

#### macOS
macOS is not recommended for DMX Control, as it does not play very nicely with the necessary low-level drivers for FTDI devices. 

#### Windows