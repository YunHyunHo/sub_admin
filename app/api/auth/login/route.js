const DEMO_LOGIN_ID = "admin";
const DEMO_PASSWORD = "0000";
const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://laylow.me/partner/auth/login";
const AUTH_API_KEY = process.env.AUTH_API_KEY;
const AUTH_DOMAIN = process.env.AUTH_DOMAIN;

function getRequestDomain(request) {
  return (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
}

function getDomainCandidates(request) {
  if (AUTH_DOMAIN) {
    return [AUTH_DOMAIN.toLowerCase()];
  }

  const domain = getRequestDomain(request);
  const candidates = [domain];

  if (domain.startsWith("www.")) {
    candidates.push(domain.slice(4));
  } else if (domain) {
    candidates.push(`www.${domain}`);
  }

  return [...new Set(candidates.filter(Boolean))];
}

async function requestPartnerLogin({ loginId, password, domain }) {
  const response = await fetch(AUTH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(AUTH_API_KEY ? { Authorization: `Bearer ${AUTH_API_KEY}` } : {})
    },
    body: JSON.stringify({
      loginId,
      password,
      domain
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
    const domains = getDomainCandidates(request);
    let lastResponse = null;
    let lastResult = null;
    let matchedDomain = "";

    for (const domain of domains) {
      const { response, result } = await requestPartnerLogin({ loginId, password, domain });
      lastResponse = response;
      lastResult = result;
      matchedDomain = domain;

      if (response.ok && result?.ok) {
        break;
      }
    }

    if (!lastResponse?.ok || !lastResult?.ok) {
      return Response.json(
        {
          ok: false,
          message: lastResult?.message ?? "아이디 또는 비밀번호가 올바르지 않습니다."
        },
        { status: lastResponse?.status || 401 }
      );
    }

    return Response.json({
      ok: true,
      token: lastResult.token,
      user: {
        loginId: lastResult.user?.loginId ?? loginId,
        name: lastResult.user?.name ?? lastResult.partner?.name ?? loginId,
        role: lastResult.user?.role ?? "partner_admin",
        permissions: lastResult.user?.permissions ?? [],
        menus: lastResult.user?.menus ?? []
      },
      partner: {
        id: lastResult.partner?.id ?? lastResult.user?.partnerId ?? "",
        name: lastResult.partner?.name ?? lastResult.user?.partnerName ?? "",
        domainId: lastResult.partner?.domainId ?? "",
        domain: lastResult.partner?.domain ?? matchedDomain
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
