#!/bin/zsh
cd "$(dirname "$0")" || exit 1
python3 - <<'PY'
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import webbrowser

directory = Path.cwd() / 'dist'
handler = partial(SimpleHTTPRequestHandler, directory=str(directory))
server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
url = f'http://127.0.0.1:{server.server_port}/'
print(f'Estimateur local : {url}', flush=True)
print('Fermez cette fenêtre pour arrêter la page.', flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
PY
