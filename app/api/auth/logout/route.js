import { buildAuthEndpoint, getAuthHeaders } from "../_utils";

const LOGOUT_API_URL = buildAuthEndpoint("/partner/auth/logout");

export async function POST(request) {
  const authorization = request.headers.get("authorization");
  const { refreshToken } = await request.json().catch(() => ({}));

  const response = await fetch(LOGOUT_API_URL, {
    method: "POST",
    headers: getAuthHeaders({
      ...(authorization ? { Authorization: authorization } : {})
    }),
    body: JSON.stringify({ refreshToken })
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || result?.ok === false) {
    return Response.json(
      {
        ok: false,
        message: result?.message ?? "마스터 로그아웃 요청에 실패했습니다."
      },
      { status: response.status || 500 }
    );
  }

  return Response.json({
    ok: true
  });
}
