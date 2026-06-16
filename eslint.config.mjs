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

    function isRouteMetadataVariableDeclaration(node) {
      return (
        node?.type === "VariableDeclaration" &&
        node.declarations.some(
          (declaration) =>
            declaration.id?.type === "Identifier" && declaration.id.name === "routeMetadata",
        )
      );
    }

    return {
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
          /apps\/web\/src\/app\/api\/.*\/route\.(ts|tsx)$/.test(fileName) ||
          /apps\/web\/app\/api\/.*\/route\.(ts|tsx)$/.test(fileName);

        if (!isApiRouteFile || hasRouteMetadataExport) {
          return;
        }

        const metadataFile = context.filename.replace(/route\.(ts|tsx)$/, "route.metadata.$1");

        if (existsSync(metadataFile)) {
          const metadataContent = readFileSync(metadataFile, "utf8");

          if (
            /export\s+const\s+routeMetadata\s*=/.test(metadataContent) ||
            /export\s*\{\s*routeMetadata\s*\}/.test(metadataContent)
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
      "apps/web/next-env.d.ts",
      "prisma.config.ts",
      "packages/db/src/generated/**",
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
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "atlas/no-hardcoded-tenant-strings": "error",
      "atlas/require-route-metadata": "error",
    },
  },

  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["packages/db/src/**/*.{ts,tsx}"],
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
    files: ["packages/db/src/**/*.{ts,tsx}"],
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
    files: ["apps/web/src/app/api/**/*.{ts,tsx}"],
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
    files: ["apps/web/**/*.{ts,tsx}"],
    ignores: ["apps/web/src/app/api/**/*.{ts,tsx}"],
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
    files: ["prisma/seeds/**/*.ts"],
    rules: {
      "atlas/no-hardcoded-tenant-strings": "off",
    },
  },

  {
    files: ["scripts/**/*.ts", "tests/**/*.{ts,tsx}", "vitest.config.ts"],
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
