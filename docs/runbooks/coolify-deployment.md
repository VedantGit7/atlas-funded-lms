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

Set on the production server on 29 October 2026. Check after any proxy change or Coolify upgrade with `docker inspect coolify-proxy --format '{{range .Args}}{{println .}}{{end}}' | grep idleTimeout`.

## TLS and DNS

Visitors reach the server only through Cloudflare (the firewall allows ports 80 and 443 from Cloudflare's ranges only). The decision behind this is in the hosting decision doc, section 4.

- **Edge:** Cloudflare's Universal SSL covers every name one level under `fundedbeyond.com`.
- **Origin:** a **Cloudflare Origin CA certificate** in Traefik covers the four LMS addresses: `academy`, `platform`, `staging-academy` and `staging-platform`.
  - Only Cloudflare trusts it, so **every LMS DNS record must stay proxied** (orange cloud).
  - There is no Let's Encrypt. Traefik keeps Coolify's `letsencrypt` resolver, but it never requests a certificate for a name the Origin certificate already covers, so `/data/coolify/proxy/acme.json` stays empty.
  - **It expires on 25 October 2041.** Cloudflare sends no reminder.

**The files on the server:**

| File (host path; Traefik sees `/data/coolify/proxy` as `/traefik`) | What it is                                                                                                    |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `/data/coolify/proxy/certs/fundedbeyond-origin.key`                | The private key. ECDSA P-256, generated on the server, mode 600. It has never left the server.                |
| `/data/coolify/proxy/certs/fundedbeyond-origin.csr`                | The signing request Cloudflare signed.                                                                        |
| `/data/coolify/proxy/certs/fundedbeyond-origin.crt`                | The certificate.                                                                                              |
| `/data/coolify/proxy/dynamic/origin-certificate.yaml`              | Loads the pair into Traefik (`tls.certificates`). Listed in Coolify under **Proxy → Dynamic Configurations**. |

**Issuing or replacing the certificate** (for a new LMS address, a lost key or expiry):

1. On the server, create a key and a signing request listing every address. Keep an existing key unless it may have leaked:

   ```bash
   cd /data/coolify/proxy/certs
   (umask 077; openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out fundedbeyond-origin.key)
   openssl req -new -key fundedbeyond-origin.key -out fundedbeyond-origin.csr -subj "/CN=academy.fundedbeyond.com" \
     -addext "subjectAltName=DNS:academy.fundedbeyond.com,DNS:platform.fundedbeyond.com,DNS:staging-academy.fundedbeyond.com,DNS:staging-platform.fundedbeyond.com"
   ```

2. In Cloudflare → **SSL/TLS → Origin Server → Create Certificate**, choose **Use my private key and CSR**, paste the signing request, list the same hostnames (remove the defaults), and pick 15 years.
3. Check the certificate carries the server's key before installing it. The two hashes must match:

   ```bash
   openssl x509 -in new.crt -noout -pubkey | openssl sha256
   openssl pkey -in fundedbeyond-origin.key -pubout | openssl sha256
   ```

4. Replace `fundedbeyond-origin.crt` (mode 644). Traefik watches the dynamic directory and picks it up without a restart. Confirm from the server, for each address:

   ```bash
   openssl s_client -connect 127.0.0.1:443 -servername staging-academy.fundedbeyond.com </dev/null 2>/dev/null | openssl x509 -noout -subject -enddate
   ```

5. Revoke the old certificate in Cloudflare and update the expiry date above.

**Cloudflare settings for the LMS addresses.** The zone also serves the company site and email, so these settings are scoped to the LMS addresses. The zone-wide SSL mode (Full) and Always Use HTTPS (off) stay as they are.

| Setting        | Where                                                     | Value                                                                                                                                             |
| -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS            | DNS → Records                                             | A record per address → `201.18.202.220`, **proxied**. The `*` wildcard (Porkbun's forwarding) stays; an explicit record takes precedence over it. |
| SSL mode       | Rules → Configuration Rules, `LMS staging: Full (strict)` | `(http.host in {"staging-academy.fundedbeyond.com" "staging-platform.fundedbeyond.com"})` → SSL **Full (strict)**                                 |
| HTTPS redirect | Rules → Redirect Rules, `LMS staging: HTTP to HTTPS`      | `(http.host in {...the same names...} and not ssl)` → dynamic `concat("https://", http.host, http.request.uri.path)`, 301, preserve query string  |

**At launch,** add `academy.fundedbeyond.com` and `platform.fundedbeyond.com` to both rules, in the same change as their DNS records. Until then they must stay out: `academy` currently reaches Porkbun's redirect through the wildcard, and Full (strict) would break it.

**Checking it end to end:**

```bash
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" https://staging-academy.fundedbeyond.com/
curl -sS -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://staging-academy.fundedbeyond.com/a?b=1"
```

- **HTTPS:** expect the app's response, or Traefik's "Site not available" page (503) when nothing is deployed for that address.
- **HTTP:** expect a 301 to the same path and query on `https://`.
- **Cloudflare errors:** a 526 means Cloudflare rejected the origin certificate (it doesn't cover the name, or it expired). A 525 means the TLS handshake with Traefik failed.

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
2. **Publish the environment's images.** In GitHub, give the environment the `API_BUILD_ENV` and `WEB_BUILD_ENV` secrets, then run "Publish images" for the commit (`managed-node-runtime.md`, "Publishing"). Environment names ignore case, so the workflow's `production` is the `Production` environment Vercel created. Both secrets hold the same dotenv text:

   | Setting                         | Staging                                                                                     |
   | ------------------------------- | ------------------------------------------------------------------------------------------- |
   | `APP_ENV`                       | `staging`                                                                                   |
   | `PLATFORM_HOST`                 | `staging-platform.fundedbeyond.com`                                                         |
   | `APP_URL`                       | `https://staging-academy.fundedbeyond.com`                                                  |
   | `API_INTERNAL_URL`              | `http://api.atlas.internal:3001`                                                            |
   | `NEXT_PUBLIC_SUPABASE_URL`      | The staging Supabase project's URL (project `acfkhlnrlnlignkqpxhc`)                         |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | That project's legacy anon key, the key type the rehearsal tests (Supabase → API Keys)      |
   | `NEXT_PUBLIC_SENTRY_DSN`        | The `atlas-lms` Sentry project's DSN (EU region). The CSP's `connect-src` takes its origin. |

   **Registry access:** none. The packages are public, like the repository (`managed-node-runtime.md`, "Pulling").

3. **Fill in the variables Coolify lists.** Values that differ by environment:
   - `APP_ENV`: `staging` or `production`;
   - `APP_URL`;
   - `PLATFORM_HOST`;
   - `RELEASE_SHA`;
   - `SENTRY_DSN`, the same DSN as the build's;
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

## Databases and migrations

Each environment has its own PostgreSQL 16 and Redis, created in Coolify on that environment's own Docker network (`atlas-staging`, then `atlas-production`), with no public port. Environments can't share one PostgreSQL: its logins are server-wide, and each environment needs its own `atlas_app_login`.

- **Logins:**
  - `postgres`, Coolify's superuser: only for the one-time setup below.
  - `atlas` owns the database and runs migrations. It is **not** a superuser and can't bypass row-level security; it can create roles, which the SQL needs.
  - `atlas_app_login` and `atlas_platform_login` are the services' logins (`DATABASE_URL`, `PLATFORM_DATABASE_URL`), restricted like `atlas`.
- **The migration job** is the `atlas-migrate` image, published for every `main` commit next to the worker. It runs `scripts/db/migration-job.mjs` on the environment's network, verifying the database's certificate (`sslmode=verify-full`):
  - `migrate` provisions an empty database or brings it up to the release: setup, roles, Prisma migrations, then functions, RLS, triggers, indexes, grants and partitions. Every step is idempotent, so a release reruns all of them.
  - `login-roles` sets the runtime logins' passwords.
  - `verify` prints the owner, migrations, RLS tables and policies, the logins' attributes and TLS, and fails if anything is unsafe.
- **CI guards the non-superuser owner.** `migration-validation` provisions as one and then reruns the release sequence, so a migration that only a superuser could apply fails CI, not a deploy.
- **The database's certificate** comes from Coolify, signed by Coolify's CA (valid ten years). It names the PostgreSQL container (for example `z5xw99119qtqv6bc4yvzayxe`) and the server's public IP, so the URLs use the **container name** as host, as Coolify's internal URL does. It is valid for **one year**: Coolify shows the expiry on the database's **General** page. Before then, use **Regenerate SSL Certificates** and restart the database. Staging's first certificate expires on 28 October 2027.
- **Server-side TLS isn't enforced.** Coolify's `pg_hba.conf` also accepts unencrypted logins (`host all all all scram-sha-256`). The database has no public port, and every client here insists on `verify-full`, so nothing connects unencrypted.

**One-time setup per environment**, as root on the server, once its PostgreSQL is running with SSL on. It creates the owner and the database, and keeps the passwords in `/root/atlas/<environment>/` (mode 700, files 600). Neither file leaves the server: Coolify gets the runtime URLs from `runtime.env`.

```bash
ENV=staging
PG=$(docker ps --filter network=atlas-$ENV --filter ancestor=postgres:16-alpine --format '{{.Names}}')
install -d -m 700 /root/atlas/$ENV && umask 077
OWNER=$(openssl rand -hex 24) APP=$(openssl rand -hex 24) PLATFORM=$(openssl rand -hex 24)
docker exec -i "$PG" psql -v ON_ERROR_STOP=1 -U postgres -v owner="$OWNER" <<'SQL'
CREATE ROLE atlas LOGIN NOSUPERUSER CREATEROLE NOBYPASSRLS NOCREATEDB PASSWORD :'owner';
CREATE DATABASE atlas_lms OWNER atlas;
REVOKE ALL ON DATABASE atlas_lms FROM PUBLIC;
SQL
URL="@$PG:5432/atlas_lms?sslmode=verify-full"
printf 'DATABASE_URL=postgresql://atlas:%s%s\nATLAS_APP_LOGIN_PASSWORD=%s\nATLAS_PLATFORM_LOGIN_PASSWORD=%s\n' "$OWNER" "$URL" "$APP" "$PLATFORM" > /root/atlas/$ENV/migrate.env
printf 'DATABASE_URL=postgresql://atlas_app_login:%s%s\nPLATFORM_DATABASE_URL=postgresql://atlas_platform_login:%s%s\n' "$APP" "$URL" "$PLATFORM" "$URL" > /root/atlas/$ENV/runtime.env
```

Then run the job with `login-roles` once after the first `migrate`.

**Every deploy runs the job before the services change:**

```bash
ENV=staging SHA=<the release's 40-character SHA>
docker run --rm --network atlas-$ENV --read-only --tmpfs /tmp \
  -v /data/coolify/ssl/coolify-ca.crt:/etc/ssl/certs/coolify-ca.crt:ro \
  -e NODE_EXTRA_CA_CERTS=/etc/ssl/certs/coolify-ca.crt \
  --env-file /root/atlas/$ENV/migrate.env \
  ghcr.io/vedantgit7/atlas-migrate:$SHA migrate
```

Then run the same command with `verify`. Migrations aren't undone on rollback (`rollback.md`), so a release's migrations must keep the previous release working.

## Backups and restore drills

Coolify backs up each environment's PostgreSQL to that environment's own R2 bucket (`atlas-staging-backups`, `atlas-prod-backups`). A backup only counts once a restore of it has passed the drill below.

- **Schedule:** on the database's **Backups** page, every 6 hours (`0 */6 * * *`, UTC), with **All databases**. That is a gzipped `pg_dumpall`, which also carries the logins and their password hashes, so a restore needs no new passwords.
- **Retention:** S3 copies are kept 14 days, and local copies (under `/data/coolify/backups`) 2 days, for faster restores.
- **Not backed up:** Redis holds only rate-limit counters.
- **Two R2 keys per bucket, each limited to that bucket:**
  - **Object Read & Write**, entered only in Coolify's S3 storage. It uploads backups and deletes expired ones.
  - **Object Read only**, kept in the password manager. It is for drills and real restores.

  Neither is stored on the server.

**The restore drill** proves the newest backup in R2 restores. From your PC, it drives Docker on the server over SSH:

1. downloads the backup with the read-only key;
2. restores it into a throwaway PostgreSQL with **no network**;
3. compares the result with the live database: every table's rows and content, sequences, the schema with ownership and grants, RLS coverage, the databases, and the logins with their password hashes;
4. removes the container and the downloaded file.

Nothing may write to the database between the backup and the drill, or the comparison fails. That holds on staging before the app runs; once it does, run the drill right after a backup.

```powershell
$env:R2_ACCESS_KEY_ID = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'R2 read-only Access Key ID')).Password
$env:R2_SECRET_ACCESS_KEY = [Net.NetworkCredential]::new('', (Read-Host -AsSecureString 'R2 read-only Secret Access Key')).Password
$env:R2_ACCOUNT_ID = 'ae645de64b709479a18bbd90942fdb28'; $env:R2_BUCKET = 'atlas-staging-backups'
$env:BACKUP_DRILL_ENV = 'staging'; $env:BACKUP_DRILL_DOCKER_HOST = 'ssh://root@201.18.202.220'
$env:BACKUP_DRILL_MIGRATE_IMAGE = 'ghcr.io/vedantgit7/atlas-migrate:<a published SHA>'
$env:BACKUP_DRILL_QUIESCED = '1'
pnpm release:backup:drill
```

It prints and saves a JSON report (`backup-restore-drill.json`) with the backup's key, size, age and SHA-256, each check, and the time the database took to come back. Keep it with the release evidence. To restore for real, use the same download (`scripts/db/fetch-backup.mjs`) and then Coolify's **Import Backup** on a fresh PostgreSQL.

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
