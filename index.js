const dgram = require("dgram");
const fs = require("fs");
const process = require("process");

const NS_PER_SEC = 1e9;
const NS_PER_MS = 1e6;

const config = {
  nameserver: {
    port: 53,
    // host: "192.168.1.254",
    host: "1.1.1.1",
  },
  host: "127.0.0.1",
  port: 53,
  reporting: {
    log: "dns.log",
    host: "localhost",
    port: 8125,
  },
};

const server = dgram.createSocket("udp4");

const stats = dgram.createSocket("udp4");

server.on("message", (req, rinfo) => {
  const next = dgram.createSocket("udp4");
  const time = process.hrtime();
  const domain = qnameToDomain(req.slice(12, req.length - 4));
  next.on("message", (res) => {
    const diff = process.hrtime(time);
    server.send(res, 0, res.length, rinfo.port, rinfo.host);
    const ms = (diff[0] * NS_PER_SEC + diff[1]) / NS_PER_MS;
    fs.appendFileSync(config.reporting.log, `${Date.now()},${domain},${ms}\n`);
    stats.send(
      `latency:${ms}|ms\n`,
      config.reporting.port,
      config.reporting.host
    );
    next.close();
  });
  next.send(req, 0, req.length, config.nameserver.port, config.nameserver.host);
});

server.on("error", (err) => console.error(err));
server.bind(config.port, config.host, () =>
  console.log(`listening on ${config.host}:${config.port}`)
);

// from https://github.com/sh1mmer/dnsserver.js
var qnameToDomain = function (qname) {
  var domain = "";
  for (var i = 0; i < qname.length; i++) {
    if (qname[i] == 0) {
      //last char chop trailing .
      domain = domain.substring(0, domain.length - 1);
      break;
    }

    var tmpBuf = qname.slice(i + 1, i + qname[i] + 1);
    domain += tmpBuf.toString("binary", 0, tmpBuf.length);
    domain += ".";

    i = i + qname[i];
  }

  return domain;
};
