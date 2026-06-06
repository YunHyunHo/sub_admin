const INTEGRATION_API_KEY = process.env.INTEGRATION_API_KEY;

export function getDomainPayload(partner) {
  if (partner?.domainId) {
    return { domainId: partner.domainId };
  }

  return {
    domainName: partner?.name || partner?.domain || ""
  };
}

export async function forwardIntegrationRequest(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(INTEGRATION_API_KEY ? { "X-API-Key": INTEGRATION_API_KEY } : {})
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);

  return {
    response,
    result
  };
}

export function integrationError(message, status = 400) {
  return Response.json(
    {
      ok: false,
      message
    },
    { status }
  );
}
