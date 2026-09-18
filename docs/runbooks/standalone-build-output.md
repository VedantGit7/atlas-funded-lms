# Standalone Build Output

## Purpose

Both apps build with `output: "standalone"`. This records what that produces, because the
layout is not the one the Next.js documentation's single-app examples show, and the
difference is the kind that fails at container start rather than at build time.

## What the apps emit

`pnpm build` writes a self-contained server tree per app. The entrypoint keeps the
workspace path:

| App | Entrypoint                                                       |
| --- | ---------------------------------------------------------------- |
| Web | `frontend/apps/web/.next/standalone/frontend/apps/web/server.js` |
| API | `backend/apps/api/.next/standalone/backend/apps/api/server.js`   |

Not `.next/standalone/server.js`. A Dockerfile that copies the standalone directory and
runs `node server.js` at its root will not find one. Copy the tree and run the nested path,
or set the container `WORKDIR` to the nested directory.

## Why the tracing root is set

Both configs pair `output: "standalone"` with `outputFileTracingRoot` pointed at the
repository root. The Next.js `output` documentation is explicit that in a monorepo the
project directory is used for tracing by default and "any files outside of that folder will
not be included" — which here means every `@atlas/*` workspace package. Without the tracing
root the build still succeeds and the server dies on a missing module at startup. The
nested entrypoint path above is a direct consequence of tracing from the repository root.

## Static assets are not copied

Standalone deliberately excludes `.next/static` and `public`. A deployment has to place
them alongside the entrypoint:

```bash
cp -r <app>/.next/static <app>/.next/standalone/<app>/.next/
cp -r <app>/public       <app>/.next/standalone/<app>/
```

Without this the server boots and answers API routes, but every asset 404s.

## Verifying a build

Boot the bundle rather than trusting the build's exit code — a tracing gap is invisible
until startup:

```bash
PORT=3011 pnpm exec dotenv -e .env.local -- node backend/apps/api/.next/standalone/backend/apps/api/server.js
```

Then `curl http://127.0.0.1:3011/api/v1/health` should return 200.

## Known bloat

`backend/packages/storage/src/providers/local-filesystem-storage-provider.ts` resolves its
root with `path.resolve(process.cwd(), env.STORAGE_LOCAL_ROOT)`. Turbopack warns that a
`process.cwd()` argument "causes tracing of the whole project", so the traced output is
larger than it needs to be. This predates the standalone switch and is a size concern only,
not a correctness one.
