#!/usr/bin/env python3
"""Local dev server with HTTP Range request support (required for video seeking)."""
import http.server
import os
import re
import socketserver

PORT = 4827


class RangeAwareHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        path = self.translate_path(self.path)

        if os.path.isdir(path) or "Range" not in self.headers:
            return super().send_head()

        try:
            file_size = os.path.getsize(path)
            m = re.match(r"bytes=(\d*)-(\d*)", self.headers["Range"])
            if not m:
                return super().send_head()

            start = int(m.group(1)) if m.group(1) else 0
            end = int(m.group(2)) if m.group(2) else file_size - 1
            end = min(end, file_size - 1)
            length = end - start + 1

            f = open(path, "rb")
            f.seek(start)

            self.send_response(206)
            self.send_header("Content-Type", self.guess_type(path))
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
            self.send_header("Content-Length", str(length))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(os.path.getmtime(path)))
            self.end_headers()
            return f
        except Exception:
            return super().send_head()

    def log_message(self, format, *args):
        # Only log range requests so you can see seeks happening
        if self.headers and self.headers.get("Range"):
            print(f"  SEEK  {self.path}  {self.headers['Range']}")


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


with ReusableTCPServer(("", PORT), RangeAwareHandler) as httpd:
    print(f"Serving at http://127.0.0.1:{PORT}/")
    print("Range requests enabled - video seeking will work.")
    httpd.serve_forever()
