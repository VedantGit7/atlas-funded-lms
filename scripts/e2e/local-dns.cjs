// Node does not implement Chromium's *.localhost rule. Map only our disposable
// fixture hosts in this process; do not edit the machine's hosts file.
const dns = require("node:dns");
const process = require("node:process");
const original = dns.lookup;
const originalPromise = dns.promises.lookup;
const hosts = new Set([
  "fundedbeyond.localhost",
  "second-smoke-academy.localhost",
  "platform.localhost",
]);
dns.promises.lookup = async function (hostname, options) {
  if (!hosts.has(hostname)) return originalPromise.call(dns.promises, hostname, options);
  return options?.all ? [{ address: "127.0.0.1", family: 4 }] : { address: "127.0.0.1", family: 4 };
};
dns.lookup = function (hostname, options, callback) {
  if (!hosts.has(hostname)) return original.call(dns, hostname, options, callback);
  const cb = typeof options === "function" ? options : callback;
  process.nextTick(() =>
    options?.all ? cb(null, [{ address: "127.0.0.1", family: 4 }]) : cb(null, "127.0.0.1", 4),
  );
};
