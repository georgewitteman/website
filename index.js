import { getActiveResourcesInfo } from 'node:process';
import { createServer } from "node:http";

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`${req.method} ${url.href}`);
  if (url.pathname !== "/") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><html lang="en"><body>Hi!</body></html>');
});

server.listen(8080, () => {
  console.log("listening on %s", server.address());
});

let forceClose = false;

/**
 * @param {string} signal
 */
function shutdown(signal) {
  if (forceClose) {
    console.log("Forcing exit");
    console.log(getActiveResourcesInfo()); // experimental
    process.exit(1);
  }
  forceClose = true;
  console.log("signal %s", signal);

  // https://nodejs.org/docs/latest-v18.x/api/net.html#serverclosecallback
  server.close((err) => {
    if (err) {
      console.error(err)
      return;
    }
    console.log("Successfully shut down server")
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
