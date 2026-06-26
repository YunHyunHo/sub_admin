import { buildAuthEndpoint, getAuthHeaders } from "../_utils";

const REFRESH_API_URL = buildAuthEndpoint("/partner/auth/refresh");

export async function POST(request) {
  const { refreshToken } = await request.json();

  if (!refreshToken) {
    return Response.json(
      {
        ok: false,
        message: "refreshToken이 없습니다."
      },
      { status: 401 }
    );
  }

  const response = await fetch(REFRESH_API_URL, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ refreshToken })
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    return Response.json(
      {
        ok: false,
        message: result?.message ?? "로그인 토큰 갱신에 실패했습니다."
      },
      { status: response.status || 401 }
    );
  }

  return Response.json({
    ok: true,
    token: result.token,
    refreshToken: result.refreshToken ?? refreshToken,
    user: result.user,
    partner: result.partner
  });
}
