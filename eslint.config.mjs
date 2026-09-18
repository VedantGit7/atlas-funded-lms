import { existsSync, readFileSync } from "node:fs";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const routeMetadataRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require API route files to export routeMetadata.",
    },
    messages: {
      missingRouteMetadata:
        "API route files must export routeMetadata before handlers are allowed.",
    },
    schema: [],
  },
  create(context) {
    let hasRouteMetadataExport = false;
    let hasCreateTenantRouteMetadata = false;

    function isRouteMetadataVariableDeclaration(node) {
      return (
        node?.type === "VariableDeclaration" &&
        node.declarations.some(
          (declaration) =>
            declaration.id?.type === "Identifier" && declaration.id.name === "routeMetadata",
        )
      );
    }

    function unwrapCallee(node) {
      let current = node;

      while (current?.type === "TSInstantiationExpression" || current?.type === "ChainExpression") {
        current = current.expression;
      }

      return current;
    }

    function isRouteFactoryCallee(node) {
      const callee = unwrapCallee(node);

      return (
        callee?.type === "Identifier" &&
        (callee.name === "createTenantRoute" ||
          callee.name === "createPublicRoute" ||
          callee.name === "createPublicRouteHandler" ||
          callee.name === "createPlatformRoute")
      );
    }

    function isPublicRouteHandlerCallee(node) {
      const callee = unwrapCallee(node);

      return callee?.type === "Identifier" && callee.name === "createPublicRouteHandler";
    }

    function objectHasMetadataProperty(objectExpression) {
      if (!objectExpression || objectExpression.type !== "ObjectExpression") {
        return false;
      }

      return objectExpression.properties.some((property) => {
        if (property.type !== "Property") {
          return false;
        }

        if (property.key?.type === "Identifier") {
          return property.key.name === "metadata";
        }

        if (property.key?.type === "Literal") {
          return property.key.value === "metadata";
        }

        return false;
      });
    }

    return {
      CallExpression(node) {
        if (!isRouteFactoryCallee(node.callee)) {
          return;
        }

        // createPublicRouteHandler(metadata, handler) — metadata is the first argument
        if (isPublicRouteHandlerCallee(node.callee) && node.arguments[0]) {
          hasCreateTenantRouteMetadata = true;
          return;
        }

        if (objectHasMetadataProperty(node.arguments[0])) {
          hasCreateTenantRouteMetadata = true;
        }
      },

      ExportNamedDeclaration(node) {
        if (isRouteMetadataVariableDeclaration(node.declaration)) {
          hasRouteMetadataExport = true;
        }

        if (
          node.specifiers?.some(
            (specifier) =>
              specifier.exported?.type === "Identifier" &&
              specifier.exported.name === "routeMetadata",
          )
        ) {
          hasRouteMetadataExport = true;
        }
      },

      "Program:exit"(node) {
        const fileName = context.filename.replaceAll("\\", "/");

        const isApiRouteFile =
          /(?:apps\/web\/)?src\/app\/api\/.*\/route\.(ts|tsx)$/.test(fileName) ||
          /apps\/web\/app\/api\/.*\/route\.(ts|tsx)$/.test(fileName) ||
          /backend\/apps\/api\/src\/app\/api\/.*\/route\.(ts|tsx)$/.test(fileName);

        if (!isApiRouteFile || hasRouteMetadataExport || hasCreateTenantRouteMetadata) {
          return;
        }

        const metadataFile = context.filename.replace(/route\.(ts|tsx)$/, "route.metadata.$1");

        if (existsSync(metadataFile)) {
          const metadataContent = readFileSync(metadataFile, "utf8");

          if (
            /export\s+const\s+routeMetadata\s*(?::[^=]+)?=/.test(metadataContent) ||
            /export\s+const\s+\w*Metadata\s*(?::[^=]+)?=/.test(metadataContent) ||
            /export\s*\{[^}]*\brouteMetadata\b[^}]*\}/.test(metadataContent)
          ) {
            return;
          }
        }

        context.report({
          node,
          messageId: "missingRouteMetadata",
        });
      },
    };
  },
};

const noHardcodedTenantStringsRule = {
  meta: {
    type: "problem",
    docs: {
      description: "Prevent hardcoded tenant-specific strings in platform source code.",
    },
    messages: {
      hardcodedTenantString:
        "Do not hardcode tenant-specific strings. FundedBeyond must be tenant configuration only.",
    },
    schema: [],
  },
  create(context) {
    const blockedTerms = ["fundedbeyond", "academy.fundedbeyond.com", "funded beyond"];

    function checkValue(node, value) {
      if (typeof value !== "string") {
        return;
      }

      const normalized = value.toLowerCase();

      if (blockedTerms.some((term) => normalized.includes(term))) {
        context.report({
          node,
          messageId: "hardcodedTenantString",
        });
      }
    }

    return {
      Literal(node) {
        checkValue(node, node.value);
      },

      TemplateElement(node) {
        checkValue(node, node.value?.raw);
      },
    };
  },
};

const atlasPlugin = {
  rules: {
    "require-route-metadata": routeMetadataRule,
    "no-hardcoded-tenant-strings": noHardcodedTenantStringsRule,
  },
};

const genericForbiddenImportPatterns = [
  {
    group: ["@fundedbeyond/*", "fundedbeyond/*", "*fundedbeyond*"],
    message:
      "FundedBeyond must be tenant configuration only. Do not create tenant-specific imports.",
  },
  {
    group: ["**/.env*", ".env", ".env.*"],
    message: "Never import environment files.",
  },
];

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/out/**",
      "**/pnpm-lock.yaml",
      "docs/locked/**",
      // Vendored third-party material, not project source. `eslint .` was linting
      // these starter templates and extracted page assets unintentionally, which
      // added avoidable work to an already memory-bound type-aware lint.
      ".agents/**",
      ".claude/**",
      "frontend/ui_reference/**",
      "frontend/apps/web/next-env.d.ts",
      // Untracked scratch scripts kept at the repo root by convention. They are
      // never committed, so CI never sees them, but they broke `pnpm lint`
      // locally for whoever happened to have one lying around.
      "tmp-*",
      // Matches both the historical root path and backend/prisma.config.ts after
      // the F-1 split. It belongs to no tsconfig project, so type-aware linting
      // cannot parse it.
      "**/prisma.config.ts",
      "backend/packages/db/src/generated/**",
      "backend/packages/**/src/**/*.d.ts",
      "backend/packages/domain/config/src/schemas/**",
      "backend/packages/domain/config/src/services/**",
      "backend/packages/domain/config/src/repositories/feature-flag.repository.ts",
    ],
  },

  js.configs.recommended,

  {
    files: ["**/*.config.{js,mjs,cjs,ts}", "eslint.config.mjs", "vitest.config.ts"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: ["scripts/**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  ...tseslint.configs.strictTypeChecked.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      atlas: atlasPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
        },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      // A switch with a catch-all `default` IS exhaustive. Without this option
      // the rule also demands every union member be listed explicitly, which
      // flagged ten switches that all already had a default — and would force
      // dead `case` arms whose body duplicates the default.
      "@typescript-eslint/switch-exhaustiveness-check": [
        "error",
        { considerDefaultExhaustiveForUnions: true },
      ],
      // Numbers/booleans in template strings are intentional and safe in this codebase.
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
          allowBoolean: true,
          allowNullish: false,
          allowAny: false,
          allowRegExp: false,
        },
      ],
      "atlas/no-hardcoded-tenant-strings": "error",
      "atlas/require-route-metadata": "error",
      // The codebase already signals "deliberately unused" with a leading
      // underscore (`_ctx`, `_proof`), but strictTypeChecked enables
      // no-unused-vars with default options, which does not honour it — so the
      // convention read as a mistake in every file that used it. Handlers must
      // still accept `ctx` to match their signature even when they ignore it.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  {
    // Next types `headers`, `rewrites` and `redirects` as promise-returning, so
    // these are declared `async` to match the framework's interface even though
    // they only return a literal. Same interface-conformance case as the
    // resource loaders below.
    files: ["**/next.config.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },

  {
    // `ResourceLoaderFn` is typed `(args) => Promise<ResourceRef>`, so a loader
    // that resolves its ref from params alone still has to return a promise.
    // Writing it `async` is the honest way to satisfy that contract, and
    // require-await flags all 144 of them. Rewriting each to return
    // `Promise.resolve(...)` would satisfy the linter by making the code worse,
    // so the rule is switched off for this file class instead — narrowly, and
    // only where the async signature is imposed by an interface.
    files: ["**/*.route-metadata.ts", "**/route.metadata.ts"],
    rules: {
      "@typescript-eslint/require-await": "off",
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["backend/packages/db/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Direct Prisma imports are allowed only inside approved DB/repository layers. Use @atlas/db boundaries.",
            },
          ],
          patterns: genericForbiddenImportPatterns,
        },
      ],
    },
  },

  {
    files: ["backend/packages/db/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: genericForbiddenImportPatterns,
        },
      ],
    },
  },

  {
    files: ["frontend/apps/web/src/app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Frontend code must never import Prisma directly. Use approved API/service boundaries.",
            },
            {
              name: "@atlas/db",
              message: "Route handlers must use approved DB helpers such as @atlas/db/global-db.",
            },
          ],
          patterns: [
            ...genericForbiddenImportPatterns,
            {
              group: [
                "@atlas/db/client",
                "@atlas/db/with-platform-scope",
                "@atlas/db/platform-client",
                "**/repositories/**",
                "../repositories/**",
                "../../repositories/**",
                "../../../repositories/**",
              ],
              message: "Frontend code must not import repositories or DB internals.",
            },
            {
              group: [
                "**/platform/**",
                "../platform/**",
                "../../platform/**",
                "../../../platform/**",
                "@atlas/platform/*",
              ],
              message: "Tenant/frontend modules must not import platform-only code.",
            },
          ],
        },
      ],
    },
  },

  {
    // Raw dangerouslySetInnerHTML is banned outside the two files that are
    // allowed to use it. Audit finding H1: eight sites rendered author-supplied
    // HTML with no sanitizer anywhere in the repository, two of them on public
    // unauthenticated pages. Render through <SafeHtml /> instead.
    files: ["frontend/apps/web/src/**/*.tsx"],
    ignores: [
      // The sanitizer itself.
      "frontend/apps/web/src/components/SafeHtml.tsx",
      // Emits a generated theme-init script, not author content.
      "frontend/apps/web/src/components/ThemeInitScript.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message:
            "Do not use dangerouslySetInnerHTML directly. Render author HTML through <SafeHtml /> (components/SafeHtml.tsx), which sanitises at render time.",
        },
      ],
    },
  },

  {
    files: ["frontend/apps/web/**/*.{ts,tsx}"],
    ignores: [
      "frontend/apps/web/src/app/api/**/*.{ts,tsx}",
      "frontend/apps/web/src/modules/diagnostics/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Frontend code must never import Prisma directly. Use approved API/service boundaries.",
            },
            {
              name: "@atlas/db",
              message:
                "Frontend code must not import the DB package directly. Use approved APIs or server orchestration boundaries.",
            },
          ],
          patterns: [
            ...genericForbiddenImportPatterns,
            {
              group: ["backend/**"],
              message:
                "Frontend code must not import backend source paths. Use /api/v1 HTTP contracts only.",
            },
            {
              group: [
                "@atlas/db/*",
                "**/repositories/**",
                "../repositories/**",
                "../../repositories/**",
                "../../../repositories/**",
              ],
              message: "Frontend code must not import repositories or DB internals.",
            },
            {
              group: [
                "**/platform/**",
                "../platform/**",
                "../../platform/**",
                "../../../platform/**",
                "@atlas/platform/*",
              ],
              message: "Tenant/frontend modules must not import platform-only code.",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["frontend/apps/web/src/lib/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Server orchestration must not import Prisma directly. Use approved DB helpers.",
            },
          ],
          patterns: genericForbiddenImportPatterns,
        },
      ],
    },
  },

  {
    files: ["frontend/apps/web/src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Server orchestration must not import Prisma directly. Use approved DB helpers.",
            },
          ],
          patterns: genericForbiddenImportPatterns,
        },
      ],
    },
  },

  {
    files: ["frontend/apps/web/src/modules/diagnostics/**/*.{ts,tsx}"],
    ignores: [
      "frontend/apps/web/src/modules/diagnostics/diagnostic.api-client.ts",
      "frontend/apps/web/src/modules/diagnostics/diagnostic.server-api.ts",
      "frontend/apps/web/src/modules/diagnostics/diagnostic.types.ts",
      "frontend/apps/web/src/modules/diagnostics/diagnostic.schemas.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message:
                "Diagnostic server modules must not import Prisma directly. Use approved DB helpers.",
            },
          ],
          patterns: genericForbiddenImportPatterns,
        },
      ],
    },
  },

  {
    files: ["frontend/packages/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@prisma/client",
              message: "Frontend packages must never import Prisma directly.",
            },
            {
              name: "@atlas/db",
              message: "Frontend packages must not import the DB package directly.",
            },
          ],
          patterns: [
            ...genericForbiddenImportPatterns,
            {
              group: ["backend/**"],
              message:
                "Frontend packages must not import backend source paths. Use @atlas/contracts only.",
            },
            {
              group: ["@atlas/db/*"],
              message: "Frontend packages must not import DB internals.",
            },
          ],
        },
      ],
    },
  },

  {
    files: [
      "frontend/apps/web/src/app/platform/**/*.{ts,tsx}",
      "frontend/apps/web/src/components/shells/PlatformConsoleShell*.{ts,tsx}",
      "frontend/apps/web/src/lib/server/platform-*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": "off",
    },
  },

  {
    // Seeds legitimately reference the "fundedbeyond" seed-group selector, which
    // must match the configs/tenants/fundedbeyond manifest directory. Path moved
    // under backend/ in the F-1 split, which silently disabled this exemption.
    files: ["backend/prisma/seeds/**/*.ts"],
    rules: {
      "atlas/no-hardcoded-tenant-strings": "off",
    },
  },

  {
    files: [
      "configs/tenants/**",
      "scripts/tenants/**",
      "backend/packages/tenant-config/**",
      "backend/packages/release-readiness/**",
      "tests/unit/tenant-config/**",
      "tests/unit/release-readiness/**",
      "tests/integration/tenant-config/**",
      "tests/tenant-isolation/tenant-config.isolation.test.ts",
      "tests/e2e/tenant-config.e2e.ts",
      "tests/e2e/fundedbeyond-journey.e2e.ts",
      // Renamed and relocated by 3.6: structure checks moved out of tests/e2e,
      // where their name implied behaviour coverage they never provided.
      "tests/lint-rules/fundedbeyond-journey.structure.test.ts",
      "tests/security/release-security-suite.test.ts",
    ],
    rules: {
      "atlas/no-hardcoded-tenant-strings": "off",
    },
  },

  {
    files: ["backend/packages/release-readiness/**/*.ts"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
      globals: {
        ...globals.node,
      },
    },
  },

  {
    files: [
      "scripts/**/*.ts",
      "tests/**/*.{ts,tsx}",
      "vitest.config.ts",
      // Tooling config, in no tsconfig project. Without this ESLint reported a
      // parsing error ("not found by the project service") instead of linting it.
      "playwright.config.ts",
      // The web app keeps a second test tree outside the root `tests/` glob and
      // outside any tsconfig project, so those files were reported as parsing
      // errors rather than linted at all.
      "frontend/apps/web/tests/**/*.{ts,tsx}",
      // Shared Node-side config consumed by both Next apps' next.config.ts.
      // Plain ESM, in no tsconfig project, so type-aware rules are disabled.
      "configs/**/*.{mjs,cjs,js}",
    ],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
      globals: {
        ...globals.node,
      },
    },
  },
);
