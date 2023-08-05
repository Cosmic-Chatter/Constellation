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


def show_webview_settings():
    """Create a settings window, or bring it to the front if it already exists."""

    # First, see if we have a settings window already
    for window in webview.windows:
        if window.title == 'Constellation Apps - Configuration':
            window.show()
            return

    # If not, create one

    webview.create_window('Constellation Apps - Configuration',
                                                   height=600,
                                                   width=800,
                                                   url='http://localhost:' + str(config.defaults["system"]["port"]))
