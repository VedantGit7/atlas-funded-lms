import type { z } from "zod";
import type { structuredBodySchema } from "../../../server/community/community.dto";

type StructuredBody = z.infer<typeof structuredBodySchema>;

export function renderStructuredBody(body: StructuredBody): string {
  return body.blocks
    .map((block) =>
      block.children
        .map((child) => {
          if (child.type === "text") return child.text;
          if (child.type === "mention") return `@member`;
          return child.credentialId;
        })
        .join(""),
    )
    .join("\n");
}

export function collectVerifyLinks(body: StructuredBody): string[] {
  const links: string[] = [];

  for (const block of body.blocks) {
    for (const child of block.children) {
      if (child.type === "verify_link") {
        links.push(`/verify/${child.credentialId}`);
      }
    }
  }

  return links;
}
