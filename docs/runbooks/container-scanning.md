# Container image scanning

The required `container-scan` CI job builds the managed-node `api` and `worker` images from `deploy/managed-node/Dockerfile`. It then scans both with Trivy 0.75.0 for known vulnerabilities in Debian packages and Node packages. `build` depends on it, so a failing scan blocks the merge.

## Gate policy

The job **fails on any HIGH or CRITICAL vulnerability that has a published fix** in either image. Before gating, it lists every HIGH/CRITICAL finding, including those with no fix yet. Those do not fail the build because there is nothing to upgrade to, but they stay visible in the log. Revisit them when a fix ships, because the next scan then fails.

The API image is compiled with an empty dotenv build secret. The scan covers the image's packages, not deployment configuration.

## How the images stay clean

- **Debian security updates.** Shipped images start from the `runtime-base` stage, which applies published Debian security updates on top of the pinned Node image. The upstream Node image can lag Debian's fixes by weeks. CI builds start without a cache, so they always take current updates. A local builder may reuse a cached `apt-get upgrade` layer; rebuild with `--no-cache` before relying on a local scan.
- **No package managers at runtime.** npm, npx, corepack, pnpm and Yarn, plus root's build caches, are removed from both runtime images. Both images start `node` directly, so they need none of these. These tools bundle their own dependencies and were most of the Node findings.
- **pnpm metadata stays out of layers.** pnpm's metadata cache lives on a BuildKit cache mount, like its store.

## When the scan fails

1. Find each fixable finding's package and path in the log.
2. Fix by layer:
   - **Debian package** (`Class: os-pkgs`): a rebuild usually picks it up through `runtime-base`. If not, Debian has not published it for this release yet; check the fixed version in the log against `apt-cache policy <package>` in the image.
   - **Our dependency** (path under `/app/node_modules`): upgrade it in `package.json` / `pnpm-lock.yaml`. `pnpm audit` in the `dependency-scan` job usually reports it first.
   - **Base image tooling** (path under `/usr/local/lib/node_modules` or `/opt`): runtime tooling has crept back in. Remove it in the runtime stage rather than ignoring it.
   - **Node itself**: bump `.node-version` and every `FROM node:` line together. `tests/ci/ci-gate.test.ts` enforces the match.
3. If a fix is genuinely unreachable from our code and cannot be taken yet, add the CVE to a `.trivyignore` file at the repository root. Each entry needs a comment with the reason and a review date. No such file exists today; keep it that way where possible.

## Known unfixed findings (8 October 2026)

Both images use Debian 13 (trixie). The move from Debian 12 lowered the HIGH/CRITICAL counts from 49 to 43 (API) and from 80 to 63 (worker).

- **API: 43 HIGH, no CRITICAL.** These are base-system packages Debian has not patched yet: util-linux, systemd's libraries, ncurses, acl and perl-base.
- **Worker: 62 HIGH and 1 CRITICAL.** The worker has the same base-system findings, plus Chromium's libraries for PDF rendering: libxml2 (the CRITICAL), X11, expat and CUPS.
- `node-forge` CVE-2026-85393 concerns RSA signature _verification_. The wallet-pass code only _creates_ PKCS#7 signatures, so it is not reachable.

## Changing the Debian release

Chromium's system libraries and fonts come from `playwright-core install --with-deps chromium`, so a Debian upgrade changes what certificates render with. Certificate PDF failures are soft: the worker falls back to HTML. A broken renderer therefore passes the build's import check, so verify rendering directly:

- Render a certificate with Latin, Devanagari, Arabic, CJK and emoji text through `renderCertificatePdfBuffer` in both the old and new worker images.
- Compare the PDFs and the fonts they embed. The Debian 13 move changed the Arabic fallback from FreeMono to FreeSerif, which fixed previously broken Arabic letter joining; nothing else changed.
- Confirm Playwright's installed version has a dependency table for the new release.

## Scanning locally

Build the images, then run the CI command through the Trivy image, which needs the Docker socket to read local images:

```sh
docker build -f deploy/managed-node/Dockerfile --target api --secret id=api_build_env,src=/path/to/empty.env -t atlas-api:scan .
docker build -f deploy/managed-node/Dockerfile --target worker -t atlas-worker:scan .
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v atlas-trivy-cache:/root/.cache/trivy aquasec/trivy:0.75.0@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa image --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 atlas-worker:scan
```

The worker image is about 3.7 GB, and the build cache adds several more. On Docker Desktop, keep the disk image on a drive with room to spare (Settings → Resources → Advanced). Afterwards, run `docker image prune` and `docker builder prune` to reclaim the space.

## Tool pinning

CI installs the Trivy release binary pinned by SHA-256, not `aquasecurity/trivy-action` or `setup-trivy`. On 19 March 2026 an attacker force-pushed those actions' tags and published a malicious Trivy 0.69.4 (GHSA-69fq-xp46-6x23). Pin the local Trivy image by digest too: the Docker Hub images for 0.69.5 and 0.69.6 were also replaced during the incident. Trivy GitHub releases have been immutable since 3 March 2026. When upgrading:

- change the version and checksum together;
- confirm the checksum against both the release's `checksums.txt` and the downloaded file;
- never use a `latest` tag.
