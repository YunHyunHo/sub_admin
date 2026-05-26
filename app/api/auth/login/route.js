const DEMO_LOGIN_ID = "admin";
const DEMO_PASSWORD = "0000";
const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://laylow.me/partner/auth/login";
const AUTH_API_KEY = process.env.AUTH_API_KEY;

export async function POST(request) {
  const { loginId, password } = await request.json();

  if (AUTH_API_URL) {
    const response = await fetch(AUTH_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AUTH_API_KEY ? { Authorization: `Bearer ${AUTH_API_KEY}` } : {})
      },
      body: JSON.stringify({
        loginId,
        password,
        domain: request.headers.get("host")
      })
    });
    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.ok) {
      return Response.json(
        {
          ok: false,
          message: result?.message ?? "아이디 또는 비밀번호가 올바르지 않습니다."
        },
        { status: response.status || 401 }
      );
    }

    return Response.json({
      ok: true,
      token: result.token,
      user: {
        loginId: result.user?.loginId ?? loginId,
        name: result.user?.name ?? result.partner?.name ?? loginId,
        role: result.user?.role ?? "partner_admin"
      },
      partner: {
        id: result.partner?.id ?? result.user?.partnerId ?? "",
        name: result.partner?.name ?? result.user?.partnerName ?? ""
      }
    });
  }

  if (loginId === DEMO_LOGIN_ID && password === DEMO_PASSWORD) {
    return Response.json({
      ok: true,
      user: {
        loginId,
        name: "에센씨2",
        role: "partner_admin"
      },
      partner: {
        id: "essenc2",
        name: "에센씨2"
      }
    });
  }

  return Response.json(
    {
      ok: false,
      message: "아이디 또는 비밀번호가 올바르지 않습니다."
    },
    { status: 401 }
  );
}
