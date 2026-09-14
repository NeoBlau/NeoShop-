#!/usr/bin/env python3
"""
Local launcher for FiberModeler.

    python3 serve.py            # http://localhost:8765 opens in the browser
    python3 serve.py --port 9000 --no-open

A plain static server: the application is pure front-end code, nothing is sent
anywhere, and the whole project works offline.
"""
import argparse
import http.server
import os
import socketserver
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass

    def guess_type(self, path):
        if path.endswith(".js"):
            return "text/javascript"
        if path.endswith(".css"):
            return "text/css"
        if path.endswith(".svg"):
            return "image/svg+xml"
        return super().guess_type(path)


def main():
    parser = argparse.ArgumentParser(description="Run FiberModeler locally")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((args.host, args.port), Handler) as server:
        url = f"http://{args.host}:{args.port}/index.html"
        print(f"FiberModeler → {url}")
        print("Ctrl+C to stop")
        if not args.no_open:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nbye")


if __name__ == "__main__":
    main()
