# Media Player

Media Player provides a simple yet flexible digital signage platform for displaying collections of images and videos.

## Configuration

### Selecting media
To select media for display, simply select it as `content` in the **_Constellation_** web console. The files will play in alphabetical order. Video files will play for their entire duration, while the duration of images can be set from the component status page on the web console.

### Synchronizing with other Media Player instances

_Synchronization is experimental_

Media Player can perform a limited synchronization with other Media Player instances. **This synchronization only occurs when playback begins.** 

Steps to synchronize:

1. Use the keyword `synchronize_with` in `defaults.ini` to list the `id` of each other Media Player with which you want to synchronize. Add this keyword into the `defaults.ini` for every Media Player, listing in each the other `id`s.
2. Launch each instance of Media Player.
3. As each player launches, it will contact Control Server and indicate that it is ready for synchronization. As the player waits, it will display a black screen.
4. Once every player has checked in, the server will send the synchronization information. Synchronization will begin shortly.

Synchronization can occur between players running on the same physical machine, or between players on separate machines.

Synchronization always begins with the first `content` item. **Players do not resynchronize when switching between files. Since file loading is not a constant time process, players will likely become desynchronized if multiple `content` items are used**