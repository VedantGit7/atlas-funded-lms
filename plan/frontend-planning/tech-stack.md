---
name: Frontend Tech Stack
status: draft
updated: 2026-06-24
pin_policy: "Use ^range in package.json; verify with npm view before each major phase"
---

# Frontend tech stack (pinned versions)

Verified against npm registry on **2026-06-23**. Use `npm view <pkg> version` before installs to pick up newer patches.

## Runtime requirements

| Requirement    | Version                                                      |
| -------------- | ------------------------------------------------------------ |
| **Node.js**    | `>=22.0.0` (Next.js 16 requires 20.9+; repo standard is 22+) |
| **pnpm**       | `11.28.2` (packageManager in root `package.json`)            |
| **TypeScript** | `^6.0.3`                                                     |

## Core framework

| Package      | Version   | Purpose                                               |
| ------------ | --------- | ----------------------------------------------------- |
| `next`       | `^16.2.9` | App Router, RSC, SSR, middleware, Turbopack (default) |
| `react`      | `^19.2.7` | UI runtime                                            |
| `react-dom`  | `^19.2.7` | DOM renderer                                          |
| `typescript` | `^6.0.3`  | Static typing                                         |

## Styling & UI

| Package                    | Version                               | Purpose                                        |
| -------------------------- | ------------------------------------- | ---------------------------------------------- |
| `tailwindcss`              | `^4.3.1`                              | Utility CSS                                    |
| `@tailwindcss/postcss`     | `^4.3.1`                              | PostCSS integration (Tailwind v4)              |
| **shadcn/ui**              | Latest CLI (`npx shadcn@latest init`) | Accessible components on Radix                 |
| `class-variance-authority` | `^0.7.1`                              | Component variants                             |
| `clsx`                     | `^2.1.1`                              | Class merging                                  |
| `tailwind-merge`           | `^3.6.0`                              | Tailwind class deduplication                   |
| `lucide-react`             | `^1.21.0`                             | Icons                                          |
| `@atlas/design-system`     | workspace                             | Shared primitives re-exporting shadcn wrappers |

Radix primitives (`@radix-ui/react-*`) are installed per component via shadcn CLI — do not pin manually; let `shadcn add` resolve compatible versions.

## Data, forms & validation

| Package                          | Version    | Purpose                                    |
| -------------------------------- | ---------- | ------------------------------------------ |
| `@tanstack/react-query`          | `^5.101.1` | Client server-state, cache, mutations      |
| `@tanstack/react-query-devtools` | `^5.101.1` | Dev-only query inspector                   |
| `react-hook-form`                | `^7.80.0`  | Form state                                 |
| `@hookform/resolvers`            | `^5.4.0`   | Zod ↔ RHF bridge                           |
| `zod`                            | `^4.4.3`   | Schema validation via `@atlas/contracts`   |
| `@atlas/contracts`               | workspace  | Shared API Zod schemas + types (no Prisma) |

## Auth

| Package                 | Version    | Purpose                                                    |
| ----------------------- | ---------- | ---------------------------------------------------------- |
| `@supabase/supabase-js` | `^2.108.2` | Browser auth client (login, session, password reset)       |
| `@atlas/auth`           | workspace  | Cookie names, session helpers (frontend-safe exports only) |

## Observability

| Package          | Version    | Purpose                                       |
| ---------------- | ---------- | --------------------------------------------- |
| `@sentry/nextjs` | `^10.60.0` | Error tracking, performance                   |
| `posthog-js`     | `^1.393.0` | Product analytics, feature flags (if enabled) |

## Testing & quality

| Package                | Version   | Purpose                |
| ---------------------- | --------- | ---------------------- |
| `vitest`               | `^4.1.9`  | Unit + component tests |
| `@playwright/test`     | `^1.61.0` | E2E browser tests      |
| `@axe-core/playwright` | `^4.12.1` | Accessibility CI scans |
| `eslint`               | `^10.5.0` | Linting                |
| `prettier`             | `^3.8.4`  | Formatting             |

## Type definitions (dev)

| Package            | Version                     |
| ------------------ | --------------------------- |
| `@types/react`     | `^19.2.17`                  |
| `@types/react-dom` | `^19.2.7` (match react-dom) |
| `@types/node`      | `^26.0.0`                   |

## Hosting & infra (frontend app)

| Service         | Choice                                      |
| --------------- | ------------------------------------------- |
| Deploy          | **Vercel**                                  |
| CDN / DNS / WAF | **Cloudflare**                              |
| Images          | `next/image`                                |
| Video embeds    | YouTube / Vimeo / Bunny (URL from API only) |

## Example `frontend/apps/web/package.json` dependencies block

```json
{
  "dependencies": {
    "next": "^16.2.9",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "@tanstack/react-query": "^5.101.1",
    "@tanstack/react-query-devtools": "^5.101.1",
    "react-hook-form": "^7.80.0",
    "@hookform/resolvers": "^5.4.0",
    "zod": "^4.4.3",
    "@supabase/supabase-js": "^2.108.2",
    "@sentry/nextjs": "^10.60.0",
    "posthog-js": "^1.393.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0",
    "lucide-react": "^1.21.0",
    "@atlas/design-system": "workspace:*",
    "@atlas/contracts": "workspace:*",
    "@atlas/auth": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^6.0.3",
    "tailwindcss": "^4.3.1",
    "@tailwindcss/postcss": "^4.3.1",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.7",
    "@types/node": "^26.0.0",
    "vitest": "^4.1.9",
    "@playwright/test": "^1.61.0",
    "@axe-core/playwright": "^4.12.1",
    "eslint": "^10.5.0",
    "prettier": "^3.8.4"
  }
}
```

## Zod versioning

| When                   | Version    | Notes                                                        |
| ---------------------- | ---------- | ------------------------------------------------------------ |
| **F0–F8** (historical) | `^3.25.76` | Used during frontend rebuild                                 |
| **Post-F8** (current)  | `^4.4.3`   | Monorepo-wide — see [zod-4-migration.md](zod-4-migration.md) |

New validation schemas belong in `@atlas/contracts` (Zod 4). Backend and contracts share a single Zod major.

## What frontend must NOT depend on

- `@atlas/db`, Prisma, `pg`
- Any `backend/packages/*` except published contract types
- Direct `DATABASE_URL` or service-role Supabase keys
