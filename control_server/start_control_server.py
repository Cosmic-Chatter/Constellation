import signal
import subprocess
import sys

def quit_handler(sig, frame):
    print("Ctrl-c detected! Passing to control_server")
    sys.exit(0)

signal.signal(signal.SIGINT, quit_handler)

while True:
    p = subprocess.Popen(["python3", "control_server.py"], shell=False)
    rc = p.wait()
    if rc == 0:
        break
    else:
        continue

