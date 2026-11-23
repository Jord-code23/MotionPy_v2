"""Inicializador do MotionPy.

O reconhecimento de Libras é executado no navegador usando o modelo
Teachable Machine e a webcam do usuário. Não é necessário TensorFlow/OpenCV
no Python para iniciar a aplicação.
"""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
import webbrowser

ROOT = Path(__file__).resolve().parent
FRONTEND = ROOT / "frontend"
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))


class MotionPyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    if not (FRONTEND / "index.html").exists():
        raise FileNotFoundError("Não encontrei frontend/index.html")
    server = ThreadingHTTPServer((HOST, PORT), MotionPyHandler)
    url = f"http://{HOST}:{PORT}"
    print(f"MotionPy disponível em {url}")
    print("A câmera funciona em localhost. Pressione Ctrl+C para encerrar.")
    try:
        webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        print("\\nEncerrando MotionPy...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
