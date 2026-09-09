const REALTIME_TOKEN_API_URL =
  process.env.REALTIME_TOKEN_API_URL ??
  "https://laylow.me/api/integration/realtime-token";
const MASTER_PREVIEW_BYPASS_SECRET =
  process.env.MASTER_PREVIEW_BYPASS_SECRET?.trim() ?? "";

export async function GET(request) {
  const authorization = request.headers.get("authorization");
  const clientInstanceId = new URL(request.url).searchParams.get("clientInstanceId") ?? "";
  const headers = {};
  if (authorization) headers.authorization = authorization;
  if (MASTER_PREVIEW_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = MASTER_PREVIEW_BYPASS_SECRET;
  }

  const response = await fetch(
    `${REALTIME_TOKEN_API_URL}?clientInstanceId=${encodeURIComponent(clientInstanceId)}`,
    {
      headers,
      cache: "no-store"
    }
  );
  const result = await response.json().catch(() => null);
  return Response.json(result ?? { mode: "legacy" }, {
    status: response.status,
    headers: { "Cache-Control": "no-store, private" }
  });
}
