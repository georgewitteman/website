import { createServer } from "node:http";

const server = createServer((req, res) => {
  console.log(`${req.method} ${req.url}`)
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<!doctype html><html lang="en"><body>Hi!</body></html>');
});

server.listen(8080, () => {
  console.log("listening on %s", server.address());
});

function shutdown(signal) {
  console.log("signal %s", signal);
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
