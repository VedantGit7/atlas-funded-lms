// The production server's Hostinger firewall (launch plan task 2.2;
// docs/runbooks/coolify-deployment.md, "Server firewall").
//
// Hostinger filters traffic before it reaches the server, so this also covers
// the ports Docker publishes, which UFW on the server does not. Incoming
// traffic is dropped unless a rule accepts it, and the rules accept only:
//   - SSH (22) from Coolify Cloud and the admin addresses;
//   - HTTP and HTTPS (80, 443) from Cloudflare, which proxies every site;
//   - ICMP and ICMPv6, which IPv6 neighbour discovery and path MTU need.
// Coolify's and Cloudflare's address lists are fetched on every run, so
// rerunning `apply` picks up their changes and a new admin address.
//
//   node scripts/deploy/hostinger-firewall.mjs plan --server <ipv4>
//   node scripts/deploy/hostinger-firewall.mjs apply --server <ipv4>
//   node scripts/deploy/hostinger-firewall.mjs activate --server <ipv4>
//   node scripts/deploy/hostinger-firewall.mjs deactivate --server <ipv4>
//   node scripts/deploy/hostinger-firewall.mjs status --server <ipv4>
//
// --admin-ip a,b  addresses allowed to SSH besides Coolify (default: this
//                 machine's public IPv4).
// Every command except `plan` reads HOSTINGER_API_TOKEN from the environment;
// the runbook sets it from a hidden prompt. Never pass it as an argument.
import process from "node:process";

const API = "https://developers.hostinger.com";
const FIREWALL_NAME = "atlas-production";
const LISTS = {
  coolifyV4: "https://coolify.io/ipv4.txt",
  coolifyV6: "https://coolify.io/ipv6.txt",
  cloudflareV4: "https://www.cloudflare.com/ips-v4",
  cloudflareV6: "https://www.cloudflare.com/ips-v6",
};
const ADDRESS = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-f:]+:[0-9a-f:]*)(?:\/\d{1,3})?$/i;

const [command, ...rest] = process.argv.slice(2);
const option = (name) => {
  const index = rest.indexOf(`--${name}`);
  return index >= 0 ? rest[index + 1] : undefined;
};
const server = option("server");
if (!["plan", "apply", "activate", "deactivate", "status"].includes(command ?? "") || !server)
  throw new Error(
    "Usage: hostinger-firewall.mjs plan|apply|activate|deactivate|status --server <ipv4> [--admin-ip a,b]",
  );

async function text(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return (await response.text()).trim();
}

/** A published list of addresses, refusing anything empty or malformed. */
async function addresses(url) {
  const entries = (await text(url)).split(/\s+/).filter(Boolean);
  if (entries.length === 0 || entries.some((entry) => !ADDRESS.test(entry)))
    throw new Error(`${url} did not return a list of addresses`);
  return entries;
}

async function buildRules() {
  const [coolifyV4, coolifyV6, cloudflareV4, cloudflareV6] = await Promise.all(
    Object.values(LISTS).map(addresses),
  );
  const admins = (option("admin-ip") ?? (await text("https://api.ipify.org")))
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (admins.length === 0 || admins.some((entry) => !ADDRESS.test(entry)))
    throw new Error("--admin-ip must be IP addresses or CIDR ranges");
  const tcp = (port, source) => ({
    protocol: "TCP",
    port,
    source: "custom",
    source_detail: source,
  });
  const cloudflare = [...cloudflareV4, ...cloudflareV6];
  const groups = {
    "SSH from Coolify Cloud": [...coolifyV4, ...coolifyV6].map((source) => tcp("22", source)),
    "SSH from admins": admins.map((source) => tcp("22", source)),
    "HTTP from Cloudflare": cloudflare.map((source) => tcp("80", source)),
    "HTTPS from Cloudflare": cloudflare.map((source) => tcp("443", source)),
    "ICMP and ICMPv6": ["ICMP", "ICMPv6"].map((protocol) => ({
      protocol,
      port: "any",
      source: "any",
      source_detail: "any",
    })),
  };
  return { groups, rules: Object.values(groups).flat() };
}

const token = process.env["HOSTINGER_API_TOKEN"];
async function api(method, path, body) {
  if (!token) throw new Error("Set HOSTINGER_API_TOKEN first (see the runbook)");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.text();
  if (!response.ok)
    throw new Error(`${method} ${path}: HTTP ${response.status} ${payload.slice(0, 400)}`);
  return payload ? JSON.parse(payload) : null;
}
const items = (value) => (Array.isArray(value) ? value : (value?.data ?? []));

async function virtualMachine() {
  const machine = items(await api("GET", "/api/vps/v1/virtual-machines")).find((vm) =>
    JSON.stringify(vm.ipv4 ?? "").includes(`"${server}"`),
  );
  if (!machine) throw new Error(`No virtual machine on this account has the IPv4 ${server}`);
  return machine;
}

async function firewall({ create }) {
  const existing = items(await api("GET", "/api/vps/v1/firewall")).find(
    (group) => group.name === FIREWALL_NAME,
  );
  if (existing || !create) return existing;
  return api("POST", "/api/vps/v1/firewall", { name: FIREWALL_NAME });
}

function describe(rules) {
  const count = (port) => rules.filter((rule) => rule.port === port).length;
  return `${rules.length} rules: ${count("22")} SSH, ${count("80")} HTTP, ${count("443")} HTTPS, ${count("any")} ICMP`;
}

async function status() {
  const machine = await virtualMachine();
  const group = await firewall({ create: false });
  const details = group ? await api("GET", `/api/vps/v1/firewall/${group.id}`) : null;
  const rules = items(details?.rules);
  process.stdout.write(
    `${JSON.stringify(
      {
        server,
        hostname: machine.hostname,
        firewall: group ? `${FIREWALL_NAME} (#${group.id})` : "not created",
        active: Boolean(group && machine.firewall_group_id === group.id),
        activeGroupId: machine.firewall_group_id,
        synced: details?.is_synced ?? null,
        rules: describe(rules),
      },
      null,
      2,
    )}\n`,
  );
}

if (command === "plan") {
  const { groups, rules } = await buildRules();
  for (const [purpose, entries] of Object.entries(groups))
    process.stdout.write(
      `${purpose} (${entries.length}):\n${entries.map((rule) => `  ${rule.protocol} ${rule.port} from ${rule.source_detail}`).join("\n")}\n`,
    );
  process.stdout.write(`${describe(rules)}\n`);
} else if (command === "apply") {
  const { rules } = await buildRules();
  const group = await firewall({ create: true });
  await api("PUT", `/api/vps/v1/firewall/${group.id}/rules`, { rules, sync: true });
  process.stdout.write(`Wrote ${describe(rules)} to ${FIREWALL_NAME} (#${group.id}).\n`);
  await status();
} else if (command === "activate" || command === "deactivate") {
  const machine = await virtualMachine();
  const group = await firewall({ create: false });
  if (!group) throw new Error(`Run apply first: there is no ${FIREWALL_NAME} firewall`);
  await api("POST", `/api/vps/v1/firewall/${group.id}/${command}/${machine.id}`);
  process.stdout.write(`${command} requested; Hostinger applies it within two minutes.\n`);
  await status();
} else {
  await status();
}
