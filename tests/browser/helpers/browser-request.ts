import type { Page, APIResponse } from "@playwright/test";

/** Use the signed-in browser's origin and cookies for adversarial object requests. */
export async function browserRequest(
  page: Page,
  path: string,
  options: { method?: string; data?: unknown; headers?: Record<string, string> } = {},
): Promise<Pick<APIResponse, "status" | "headers" | "text">> {
  const result = await page.evaluate(
    async ({ path, options }) => {
      const response = await fetch(path, {
        method: options.method ?? "GET",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...options.headers },
        ...(options.data === undefined ? {} : { body: JSON.stringify(options.data) }),
      });
      return {
        status: response.status,
        headers: Object.fromEntries(response.headers),
        text: await response.text(),
      };
    },
    { path, options },
  );
  return {
    status: () => result.status,
    headers: () => result.headers,
    text: () => Promise.resolve(result.text),
  };
}
