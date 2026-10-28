# Coolify deployment

`deploy/coolify/compose.yaml` runs the web, API and worker services as one Coolify **Docker Compose** resource, one per environment (staging, production). The decision behind it is `docs/engineering/hosting-decision-2026-10-23.md`, and the work order is `docs/engineering/launch-plan-2026-10-23.md`. `tests/unit/api/coolify-compose.test.ts` checks the file against the deployment contract.

## How the file works

- **Images, not builds.** Every service pulls an image published by the "Publish images" workflow (`managed-node-runtime.md`, "Publishing"):
  - `APP_ENV` picks the per-environment API and web images;
  - `RELEASE_SHA` picks the commit;
  - the same `RELEASE_SHA` reaches each container, so the health response reports the deployed commit.
- **Settings are listed per service.**
  - **Only listed settings get through:** Coolify passes a setting to a container only when that service lists it as `${NAME}`, and each listed setting appears as an editable variable in Coolify.
  - **Least privilege:** each service lists what its startup validation requires plus what it uses. The worker gets no `API_PROXY_SECRET`, only the API gets `SCORM_CONTENT_SIGNING_KEYS`, and no migration or owner login reaches any container.
  - **No empty values:** every reference is either required (`${NAME:?}`, so Coolify refuses to deploy without it) or has a default (`${NAME:-value}`). Coolify passes an unset `${NAME}` as an empty string, and some settings' parsers reject an empty string.
  - **Fixed values are literal:** `STORAGE_PROVIDER=r2`, `NOTIFICATION_EMAIL_PROVIDER=smtp`, `CSP_ENFORCE=1`, the Cloudflare client-IP header, and `API_INTERNAL_URL`.
- **Private API address.** The web reaches the API at `http://api.atlas.internal:3001`, through a compose link alias on Coolify's own network.
  - **Why a `.internal` name:** the deployment contract allows plain HTTP only to a `.internal` name, which can never resolve publicly. A single-label name like `api` that fails to resolve inside Docker could be retried against public DNS, and the web would send `API_PROXY_SECRET` there.
  - **Why no extra network:** the file declares no networks and publishes no ports. Coolify's documentation warns that a second network makes Traefik route unreliably (requests hang or return 504).
  - **Baked into the web build:** the web image is built with the same `API_INTERNAL_URL`.
- **Hardening** matches `deploy/managed-node/compose.yaml`:
  - a read-only root filesystem with a 256 MiB `/tmp`;
  - `init`;
  - a 45 s graceful stop;
  - 2 CPUs and 2 GiB of memory per service;
  - `restart: unless-stopped`.

## Health checks

| Service | Probe                                                 | Why this path                                                                                                                                        |
| ------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| web     | `GET http://127.0.0.1:3000/brand/avatar-gradient.svg` | A public file that still passes through the web middleware. No API call. `/fonts/...` skips the middleware and returns 200 even when startup failed. |
| api     | `GET http://127.0.0.1:3001/api/v1/health`             | No database call. Reports the release and environment.                                                                                               |
| worker  | `GET http://127.0.0.1:8081/healthz`                   | Reports a recent outbox sweep (`managed-node-runtime.md`).                                                                                           |

**A misconfigured web or API container does not exit.** Next.js logs the failed startup hook (for example "REDIS_URL ... is required in production and staging"), keeps running, and answers every request with 500. Only the health check catches it.

**Unhealthy containers are restarted by the probe itself.** Docker never restarts a container that only fails its health check, and Coolify doesn't either.

- **What the probe does:** each probe runs `/app/healthcheck.mjs`, which counts consecutive failures in `/tmp`. After 3 in a row, once the container has run for `--grace` seconds, it sends SIGTERM to PID 1 and `restart: unless-stopped` starts the container again.
- **`--grace`** equals the service's `start_period`.
- **What a misconfigured container looks like:** a restart roughly every 90 s, with "unhealthy 3 times in a row: restarting" in the health log. Fix the setting and redeploy; restarts alone can't repair it.

## Proxy timeouts

Each hop's idle timeout must be longer than the one in front of it, so the side that sends requests always closes an idle connection first. Otherwise, a request sent on a connection the other side just closed fails: as a 502 from Traefik, or a 520 from Cloudflare.

| Hop                  | Front side keeps idle connections             | Back side keeps them            | Set by                                             |
| -------------------- | --------------------------------------------- | ------------------------------- | -------------------------------------------------- |
| Traefik → web or API | 90 s (Traefik's `serversTransport` default)   | 100 s (`KEEP_ALIVE_TIMEOUT`)    | The images; nothing to configure                   |
| Cloudflare → Traefik | 900 s (Cloudflare's fixed Proxy Idle Timeout) | **180 s by default: too short** | Coolify's proxy configuration, set once per server |

**Set Traefik's entrypoint idle timeout above 900 s.** In Coolify: **Servers → your server → Proxy → Configuration**. Add these to the Traefik `command:` list, using the entrypoint names the configuration already defines (normally `http` and `https`), then restart the proxy:

```yaml
- "--entrypoints.http.transport.respondingTimeouts.idleTimeout=960s"
- "--entrypoints.https.transport.respondingTimeouts.idleTimeout=960s"
```

## Server access and firewall

The production server is a Hostinger VPS that Coolify Cloud manages over SSH (launch plan tasks 2.1 and 2.2).

- **SSH is key only.** `/etc/ssh/sshd_config.d/00-atlas-hardening.conf` turns off passwords and allows `root` by key only. It is named to sort before Hostinger's `50-cloud-init.conf`, which turns passwords on, because sshd keeps the first value it reads. `/root/.ssh/authorized_keys` holds exactly two keys: the administrator's and Coolify's (`coolify-hostinger-mumbai`). Coolify logs in as `root` because its non-root mode is experimental and still needs passwordless sudo.
- **The firewall is Hostinger's, not UFW.** It filters before traffic reaches the server, so it also covers the ports Docker publishes, which UFW does not ([Coolify's firewall guide](https://coolify.io/docs/knowledge-base/server/firewall)). Everything is dropped except:
  - SSH from Coolify Cloud's addresses and the administrators';
  - ports 80 and 443 from Cloudflare's ranges only, so nobody can reach the server's sites except through Cloudflare;
  - ICMP and ICMPv6.

  It covers IPv4 and IPv6. The server has a public IPv6 address, and Docker publishes ports on it too.

- **`scripts/deploy/hostinger-firewall.mjs` manages it** (firewall group `atlas-production`). It fetches Coolify's and Cloudflare's address lists and this machine's public IPv4 on every run.
- **Updates:** Ubuntu's security updates install nightly at about 02:30 India time (`unattended-upgrades`; the timer is moved by `/etc/systemd/system/apt-daily-upgrade.timer.d/override.conf`). Docker comes from Docker's own repository and is updated by hand, because an upgrade restarts every container.
- **Reboots:** `atlas-weekly-reboot.timer` runs on Mondays at 03:30 India time (Sunday 22:00 UTC). It reboots only if an update has left `/run/reboot-required`; otherwise it skips. The sites are down for 1 to 2 minutes when it does. Check with `systemctl list-timers atlas-weekly-reboot.timer`.

**Changing the firewall** (when your address changes, or monthly to pick up changes to Coolify's or Cloudflare's lists):

1. In hPanel → **API**, create a token with the shortest expiry.
2. In PowerShell, from the repository root, read it through a hidden prompt. Paste the token at the prompt, never into the command:

   ```powershell
   $env:HOSTINGER_API_TOKEN = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'Hostinger API token')).Password
   ```

3. Run `node scripts/deploy/hostinger-firewall.mjs plan --server 201.18.202.220` to see the rules. Then run `apply` (with `--admin-ip a,b` to allow other addresses), then `status`. The rules take effect within two minutes, and open connections survive.
4. Revoke the token.

**Locked out of SSH?** Use hPanel's **Web console**. It is the server's own console, not SSH, so neither the firewall nor the SSH settings affect it, and it signs in with the root password (keep that password in a password manager). Or turn the firewall off with `deactivate` (or in hPanel → **Security → Firewall**), fix the problem and `activate` again.

## Setting up an environment

1. **Create the resource.** In Coolify, create a **Docker Compose** resource from this Git repository, with the compose file `deploy/coolify/compose.yaml`. No build happens: every service has an `image`.
2. **Registry access.** If the GHCR packages are private, add a `ghcr.io` credential that Coolify's server can pull with: a classic personal access token with only `read:packages`. Public packages need nothing.
3. **Fill in the variables Coolify lists.** Values that differ by environment:
   - `APP_ENV`: `staging` or `production`;
   - `APP_URL`;
   - `PLATFORM_HOST`;
   - `RELEASE_SHA`;
   - the database URLs;
   - the R2 bucket and its keys;
   - the SMTP agent;
   - every secret, generated independently per environment (`deployment-configuration.md`).

   `CERTIFICATE_OPEN_BADGE`, `MARKETING_EMAIL_ENABLED`, `SENTRY_TRACES_SAMPLE_RATE` and `SMTP_PORT` have defaults (`false`, `false`, `0.05`, `587`).

4. **Database TLS is mandatory, and the certificate is verified.** The contract requires `sslmode=require` (or stricter) in `DATABASE_URL` and `PLATFORM_DATABASE_URL`. Write `sslmode=verify-full`: `pg` 8 already treats `require` as `verify-full`, and logs a security warning that pg 9 will change `require` to encrypt without verifying. Each URL uses its own restricted runtime login, never an owner role.
   - **Turn on SSL for Coolify's PostgreSQL.** Coolify then writes its CA to `/data/coolify/ssl/coolify-ca.crt` on the server. Every service mounts that file read-only and trusts it through `NODE_EXTRA_CA_CERTS`. A service won't start until the file exists.
   - **The host in the URL must be in the server certificate.** `verify-full` checks both the CA and the hostname. Use a hostname that Coolify's PostgreSQL certificate lists as a subject alternative name. Check it once from the server:

     ```bash
     openssl s_client -starttls postgres -connect <database host>:5432 </dev/null 2>/dev/null | openssl x509 -noout -ext subjectAltName
     ```

     If the host isn't listed, the services fail at their first query with "Hostname/IP does not match certificate's altnames".

5. **Domains go on `web` only, container port 3000.** For example, staging gets `https://staging-academy.fundedbeyond.com:3000` and `https://staging-platform.fundedbeyond.com:3000`; the `:3000` tells Coolify's proxy the container port.
6. **Deploy, then check all three health checks** report healthy, and run `pnpm release:health` against the environment with the expected SHA (`release-health.md`).

## Rehearsing locally

`pnpm deploy:rehearse` runs this file's web, API and worker services on your machine, the way a Coolify server would. It needs Docker. With `-- --skip-build`, which reuses the `atlas-*:rehearsal` images, it takes about 2 minutes. Building the three images first adds 20 minutes or more on a cold Docker cache, and needs most of Docker's memory: run nothing else heavy alongside it.

- **What it runs:** the real services from `deploy/coolify/compose.yaml`, in staging mode, on images built from your working tree. `deploy/rehearsal/compose.yaml` adds only what the server would provide:
  - PostgreSQL and the GoTrue gateway, both behind TLS, signed by a throwaway CA mounted where Coolify's CA goes;
  - Redis;
  - a loopback port, `127.0.0.1:3200`, to reach web.
- **What it provisions:** the database, with the browser-test scripts (`scripts/e2e/setup-local.mjs`, then `local-run.mjs seed`).
- **What it checks:**
  - all three services report healthy;
  - a seeded learner logs in through web;
  - their course page renders;
  - the worker completes a sweep;
  - the runtime logins reach PostgreSQL over TLS (`pg_stat_ssl`).
- **Afterwards:** it tears everything down, unless you pass `-- --keep`. Results and logs are in `.test-results/rehearsal/`.

Run it after changing the compose file, the Dockerfile or anything the services read at startup.

## Deploying, rolling back and changing settings

- **Deploy a commit:** wait for "Publish images" to finish for it. Then set `RELEASE_SHA` to that commit's full 40-character SHA and redeploy. The API and web images exist only for environments whose build secrets are set.
- **Roll back:** set `RELEASE_SHA` back to the previous commit and redeploy. Database migrations are not undone (`rollback.md`).
- **Settings baked into the build** (every `NEXT_PUBLIC_*` value, and `API_INTERNAL_URL` for the web) live in the GitHub environment's build secrets. Changing one there needs a new publish; changing it in Coolify alone has no effect.
- **Add a new runtime setting:**
  1. add `NAME: ${NAME:?}`, or `${NAME:-default}`, to each service that reads it;
  2. run `pnpm exec vitest run tests/unit/api/coolify-compose.test.ts`;
  3. fill in the value in Coolify.
- **Marketing email** is off by default (`MARKETING_EMAIL_ENABLED=false`), because the SMTP agent is ZeptoMail, which allows only transactional mail. Email campaigns, campaigns with an email touchpoint and marketing workflow email are refused, and their screens are hidden; login, notification, certificate and report email still send. The services refuse to start with it on while `SMTP_HOST` is ZeptoMail. Newsletters go out from Brevo directly; to send them from the LMS, marketing email first needs its own SMTP setting (launch plan, "Later: email campaigns from inside the LMS").
- **Open Badges** are off by default (`CERTIFICATE_OPEN_BADGE=false`). Turning them on also needs `CERTIFICATE_ISSUER_PRIVATE_KEY` (Ed25519), `CERTIFICATE_ISSUER_DID` and `CERTIFICATE_PUBLIC_BASE_URL` added to the API and worker.
