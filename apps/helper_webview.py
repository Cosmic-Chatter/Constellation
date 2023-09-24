# Third-party modules
import webview

# Constellation modules
import config


def on_closed():
    pass


def on_closing():
    pass


def on_shown():
    pass


def on_minimized():
    pass


def on_restored():
    pass


def on_maximized():
    pass


def on_loaded():
    # unsubscribe event listener
    webview.windows[0].events.loaded -= on_loaded


def on_resized(width, height):
    pass


def on_moved(x, y):
    pass


def show_webview_window(app, reload=False):
    """Create a window for the given app, or bring it to the front if it already exists.
    If reload=True, reload the window if it already exists.
    """

    endpoints = {
        "app": "/app.html",
        "dmx_control": "/dmx_control.html",
        "infostation_setup": "/InfoStation/setup.html",
        "media_browser_setup": "/media_browser/setup.html",
        "media_player_setup": "/media_player/setup.html",
        "other_setup": "/other/setup.html",
        "timelapse_viewer_setup": "/timelapse_viewer/setup.html",
        "timeline_explorer_setup": "/timeline_explorer/setup.html",
        "voting_kiosk_setup": "/voting_kiosk/setup.html",
        "word_cloud_input_setup": "/word_cloud/setup_input.html",
        "word_cloud_viewer_setup": "/word_cloud/setup_viewer.html",
        "settings": ""
    }

    names = {
        "app": "",
        "dmx_control": "DMX Control",
        "infostation_setup": "InfoStation",
        "media_browser_setup": "Media Browser",
        "media_player_setup": "Media Player",
        "other_setup": "Other App",
        "timelapse_viewer_setup": "Timelapse Viewer",
        "timeline_explorer_setup": "Timeline Explorer",
        "voting_kiosk_setup": "Voting Kiosk",
        "word_cloud_input_setup": "Word Cloud Input",
        "word_cloud_viewer_setup": "Word Cloud Viewer",
        "settings": "Configuration"
    }

    if app not in endpoints or app not in names:
        print('helper_webview.show_webview_window: Error: app ' + app + ' not recognized.')
        return

    # First, see if this window exists already
    for window in webview.windows:
        if window.title == 'Constellation Apps - ' + names[app] or \
                (app == 'app' and window.title == 'Constellation Apps'):
            if reload:
                reload_window(window)
            window.show()
            return

    # If not, create one
    webview.create_window('Constellation Apps - ' + names[app],
                          height=600,
                          width=800,
                          url='http://localhost:' + str(config.defaults["system"]["port"]) + endpoints[app])


def save_file(data, default_filename: str):
    """Create a file save dialog to get a file path and then save the given file."""

    result = webview.windows[0].create_file_dialog(dialog_type=webview.SAVE_DIALOG,
                                                   save_filename=default_filename)

    with open(result, 'w', encoding='UTF-8') as f:
        f.write(data)


def reload_window(window: webview.Window):
    """Get the current URL and load it again."""

    window.load_url(window.get_current_url())
