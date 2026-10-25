import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "../../../frontend/apps/web/node_modules/react-dom/server";
import { MARKETING_EMAIL_OFF_MESSAGE } from "../../../frontend/apps/web/src/lib/server/marketing-email";

/**
 * MARKETING_EMAIL_ENABLED=false hides the screens that send marketing email
 * (launch plan task 1.6). The API refuses the sends either way; these pages
 * read the same setting so nobody builds a campaign that cannot go out.
 */
vi.mock("../../../frontend/apps/web/src/lib/server/tenant-state-gate", () => ({
  runTenantStateGate: async () => ({ kind: "ok" }),
}));

const app = "../../../frontend/apps/web/src/app/admin/marketing";
const params = Promise.resolve({ id: "77777777-7777-4777-8777-777777777777" });

type Element = ReactElement<{ children?: ReactElement<Record<string, unknown>> }>;
type Page = (props: { params: typeof params }) => Promise<Element>;

async function page(path: string): Promise<Page> {
  return ((await import(/* @vite-ignore */ `${app}/${path}`)) as { default: Page }).default;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("marketing email screens", () => {
  it.each(["messenger/email/page", "messenger/email/create/page", "messenger/email/[id]/page"])(
    "%s explains that email campaigns are off instead of opening",
    async (path) => {
      const render = await page(path);
      vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
      const off = await render({ params });
      expect(off.props.children).toBeUndefined();
      expect(renderToString(off)).toContain(MARKETING_EMAIL_OFF_MESSAGE.split(",")[0]);

      vi.stubEnv("MARKETING_EMAIL_ENABLED", "true");
      expect((await render({ params })).props.children).toBeDefined();
    },
  );

  it.each(["campaign/create/page", "campaign/[id]/page", "workflows/[id]/page", "[slug]/page"])(
    "%s tells its builder whether email can be used",
    async (path) => {
      const render = await page(path);
      const builderProps = async () => {
        const element = await render({
          params: path === "[slug]/page" ? Promise.resolve({ slug: "messenger" }) : params,
        } as never);
        const child = element.props.children;
        // The workflow builder sits inside a Suspense boundary.
        const builder =
          path === "workflows/[id]/page"
            ? (child?.props["children"] as ReactElement<Record<string, unknown>>)
            : child;
        return builder?.props ?? {};
      };
      vi.stubEnv("MARKETING_EMAIL_ENABLED", "false");
      expect((await builderProps())["marketingEmailEnabled"]).toBe(false);
      vi.stubEnv("MARKETING_EMAIL_ENABLED", "true");
      expect((await builderProps())["marketingEmailEnabled"]).toBe(true);
    },
  );
});
