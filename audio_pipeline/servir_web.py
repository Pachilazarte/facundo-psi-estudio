"""
Servidor de la web de PsiEstudio (reemplaza a "python -m http.server")
======================================================================
- Sirve solo los archivos de la web, nunca la carpeta entera (no expone .git ni grabaciones).
- Escucha solo en 127.0.0.1: nadie de la red WiFi lo ve.
- Entrega el token del .env a la web en /api-config.json, así no hay que pegarlo a mano.
  El token solo sale si el pedido llega con Host localhost (evita ataques de DNS rebinding).
"""

import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))

from seguridad import load_env_file, get_api_token  # noqa: E402

ARCHIVOS_WEB = {
    "/index.html",
    "/app.jsx",
    "/index.css",
    "/colors.css",
    "/manifest.json",
    "/sw.js",
    "/version.json",
    "/logo.png",
    "/favicon.png",
    "/icon-192.png",
    "/icon-512.png",
}
HOSTS_PERMITIDOS = {"localhost", "127.0.0.1"}
PORT = int(os.environ.get("PSI_WEB_PORT", "3000"))


class HandlerWeb(BaseHTTPRequestHandler):
    server_version = "PsiWeb/1.0"

    def _enviar(self, status, body, content_type, extra=None):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        host = (self.headers.get("Host") or "").split(":")[0].lower()
        if host not in HOSTS_PERMITIDOS:
            return self._enviar(403, b"Host no permitido", "text/plain; charset=utf-8")

        ruta = self.path.split("?", 1)[0]
        if ruta == "/":
            ruta = "/index.html"

        if ruta == "/api-config.json":
            try:
                token = get_api_token()
            except RuntimeError:
                token = ""
            body = json.dumps({"token": token}).encode("utf-8")
            return self._enviar(200, body, "application/json; charset=utf-8")

        if ruta not in ARCHIVOS_WEB:
            return self._enviar(404, b"No encontrado", "text/plain; charset=utf-8")

        archivo = ROOT / ruta.lstrip("/")
        if not archivo.is_file():
            return self._enviar(404, b"No encontrado", "text/plain; charset=utf-8")

        tipo = mimetypes.guess_type(str(archivo))[0] or "application/octet-stream"
        if archivo.suffix == ".jsx":
            tipo = "text/plain; charset=utf-8"
        return self._enviar(200, archivo.read_bytes(), tipo)

    def log_message(self, fmt, *args):
        sys.stdout.write("[web] " + (fmt % args) + "\n")


def main():
    load_env_file()
    get_api_token()  # si falta el token, la web no arranca
    servidor = ThreadingHTTPServer(("127.0.0.1", PORT), HandlerWeb)
    print(f"Web de PsiEstudio en http://localhost:{PORT}")
    servidor.serve_forever()


if __name__ == "__main__":
    main()
