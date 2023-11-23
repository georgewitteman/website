import packageJson from "../../package.json";
import { randomUUID } from "crypto";
import { Router } from "express";
import Bowser from "bowser";

export const router = Router();

router.all("/echo", (req, res) => {
  const browser = Bowser.getParser(req.get("user-agent") ?? "");

  const url = new URL(req.originalUrl, `${req.protocol}://${req.hostname}`);
  const value = {
    original_url: req.originalUrl,
    query: req.query,
    ip: req.ip,
    ips: req.ips,
    url: {
      hash: url.hash,
      host: url.host,
      hostname: url.hostname,
      href: url.href,
      origin: url.origin,
      password: url.password,
      pathname: url.pathname,
      port: url.port,
      protocol: url.protocol,
      search: url.search,
      username: url.username,
    },
    method: req.method,
    headers: req.headers,
    body: req.body,
    user_agent: browser.getResult(),
  };

  if (browser.getBrowserName()) {
    res.render("echo", { value });
    return;
  }

  res
    .status(200)
    .type("json")
    .status(200)
    .send(JSON.stringify(value, undefined, 2));
});

router.get("/uuid", (req, res) => {
  const browser = Bowser.getParser(req.get("user-agent") ?? "");

  if (browser.getBrowserName()) {
    res.render("uuid", { value: randomUUID() });
    return;
  }

  res.status(200).type("text").send(`${randomUUID()}\n`);
});

router.get("/version", (_, res) => {
  res.status(200).type("text").send(packageJson.version);
});
