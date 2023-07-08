# Third-party modules
import webview

# Constellation modules
import config


def on_closed():
    print('pywebview window is closed')


def on_closing():
    print('pywebview window is closing')


def on_shown():
    print('pywebview window shown')


def on_minimized():
    print('pywebview window minimized')


def on_restored():
    print('pywebview window restored')


def on_maximized():
    print('pywebview window maximized')


def on_loaded():
    print('DOM is ready')

    # unsubscribe event listener
    webview.windows[0].events.loaded -= on_loaded


def on_resized(width, height):
    print('pywebview window is resized. new dimensions are {width} x {height}'.format(width=width, height=height))


def on_moved(x, y):
    print('pywebview window is moved. new coordinates are x: {x}, y: {y}'.format(x=x, y=y))


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
