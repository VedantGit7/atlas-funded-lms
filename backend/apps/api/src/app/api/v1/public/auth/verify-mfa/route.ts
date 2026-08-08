import { NextResponse } from "next/server";
import { z } from "zod";
import { createPublicRouteHandler } from "@atlas/api";
import { orchestratePublicMfaVerify } from "../../../../../../lib/public-auth-orchestrator";
import { routeMetadata } from "./route.metadata";

const bodySchema = z.object({ code: z.string().min(1) });

export const POST = createPublicRouteHandler(routeMetadata, async ({ req }) => {
  const input = bodySchema.parse(await req.json());
  const body = await orchestratePublicMfaVerify({ code: input.code });
  return NextResponse.json(body);
});
