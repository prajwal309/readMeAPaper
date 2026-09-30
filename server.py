"""Small local server for Sonora.

It serves the static app and proxies arXiv's metadata endpoint. Keeping the
proxy here means the browser never makes a cross-origin request directly.
Run with: python3 server.py
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
import re


ARXIV_API = "https://export.arxiv.org/api/query?id_list={}"
ARXIV_ID = re.compile(r"^[0-9]{4}\.[0-9]{4,5}$")


class SonoraHandler(SimpleHTTPRequestHandler):
    """Serve app files and expose one narrow, validated arXiv proxy route."""

    def do_GET(self):  # noqa: N802 - required by BaseHTTPRequestHandler
        request = urlparse(self.path)

        if request.path == "/api/arxiv":
            self.proxy_arxiv(parse_qs(request.query).get("id", [""])[0])
            return

        super().do_GET()

    def proxy_arxiv(self, paper_id):
        """Fetch Atom metadata server-side and return it to the same origin."""
        if not ARXIV_ID.fullmatch(paper_id):
            self.send_error(400, "Invalid arXiv ID")
            return

        try:
            request = Request(
                ARXIV_API.format(paper_id),
                headers={"User-Agent": "Sonora paper reader/1.0"},
            )
            with urlopen(request, timeout=20) as upstream:
                payload = upstream.read()
        except Exception as error:  # pragma: no cover - network dependent
            self.send_error(502, f"Could not reach arXiv: {error}")
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 4173), SonoraHandler)
    print("Sonora running at http://127.0.0.1:4173")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping Sonora")
        server.server_close()
