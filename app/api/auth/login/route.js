const DEMO_LOGIN_ID = "admin";
const DEMO_PASSWORD = "0000";
const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://laylow.me/partner/auth/login";
const AUTH_API_KEY = process.env.AUTH_API_KEY;

async function requestPartnerLogin({ loginId, password }) {
  const response = await fetch(AUTH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_API_KEY ? { Authorization: `Bearer ${AUTH_API_KEY}` } : {})
    },
    body: JSON.stringify({
      loginId,
      password
    })
  });
  const result = await response.json().catch(() => null);

  return {
    response,
    result
  };
}

export async function POST(request) {
  const { loginId, password } = await request.json();

  if (AUTH_API_URL) {
    const { response, result } = await requestPartnerLogin({ loginId, password });

    console.info("[partner-auth] login attempt", {
      loginId,
      status: response.status,
      ok: Boolean(result?.ok)
    });

    if (!response.ok || !result?.ok) {
      console.warn("[partner-auth] login failed", {
        loginId,
        status: response.status,
        message: result?.message ?? "No response message"
      });

      return Response.json(
        {
          ok: false,
          message: result?.message ?? "아이디 또는 비밀번호가 올바르지 않습니다.",
          debug: {
            status: response.status
          }
        },
        { status: response.status || 401 }
      );
    }

    console.info("[partner-auth] login success", {
      loginId,
      partnerId: result.partner?.id,
      partnerDomain: result.partner?.domain
    });

    return Response.json({
      ok: true,
      token: result.token,
      user: {
        loginId: result.user?.loginId ?? loginId,
        name: result.user?.name ?? result.partner?.name ?? loginId,
        role: result.user?.role ?? "partner_admin",
        permissions: result.user?.permissions ?? [],
        menus: result.user?.menus ?? []
      },
      partner: {
        id: result.partner?.id ?? result.user?.partnerId ?? "",
        name: result.partner?.name ?? result.user?.partnerName ?? "",
        domainId: result.partner?.domainId ?? "",
        domain: result.partner?.domain ?? ""
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
