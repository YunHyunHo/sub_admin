const REALTIME_TOKEN_API_URL =
  process.env.REALTIME_TOKEN_API_URL ??
  "https://laylow.me/api/integration/realtime-token";

export async function GET(request) {
  const authorization = request.headers.get("authorization");
  const clientInstanceId = new URL(request.url).searchParams.get("clientInstanceId") ?? "";
  const response = await fetch(
    `${REALTIME_TOKEN_API_URL}?clientInstanceId=${encodeURIComponent(clientInstanceId)}`,
    {
      headers: authorization ? { authorization } : {},
      cache: "no-store"
    }
  );
  const result = await response.json().catch(() => null);
  return Response.json(result ?? { mode: "legacy" }, {
    status: response.status,
    headers: { "Cache-Control": "no-store, private" }
  });
}
