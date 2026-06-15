export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const requestId = crypto.randomUUID();

  return Response.json(
    {
      ok: true,
      service: "atlas-lms",
      status: "healthy",
      requestId,
    },
    {
      status: 200,
      headers: {
        "x-request-id": requestId,
        "cache-control": "no-store",
      },
    },
  );
}
