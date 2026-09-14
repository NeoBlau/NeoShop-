#!/bin/bash
# Double-click launcher for macOS. Opens FiberModeler in the default browser.
cd "$(dirname "$0")" || exit 1
exec python3 serve.py
