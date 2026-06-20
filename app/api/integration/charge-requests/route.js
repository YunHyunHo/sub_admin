import { forwardIntegrationQuery, forwardIntegrationRequest, getDomainPayload, integrationError } from "../_utils";

const CHARGE_API_URL =
  process.env.CHARGE_API_URL ?? "https://laylow.me/api/integration/charge-requests";

export async function POST(request) {
  const body = await request.json();
  const amount = Number(body.amount);
  const domainPayload = getDomainPayload(body.partner);

  if (!domainPayload.domainId && !domainPayload.domainName) {
    return integrationError("도메인 정보가 없습니다.");
  }

  if (!body.depositorName?.trim()) {
    return integrationError("입금자명을 입력해주세요.");
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return integrationError("충전 금액을 입력해주세요.");
  }

  const payload = {
    externalId: body.externalId,
    ...domainPayload,
    depositorName: body.depositorName.trim(),
    amount
  };

  if (body.bankName?.trim()) {
    payload.bankName = body.bankName.trim();
  }

  if (body.accountNumber?.trim()) {
    payload.accountNumber = body.accountNumber.trim();
  }

  console.info("[integration-charge] request", {
    externalId: payload.externalId,
    domainId: payload.domainId,
    domainName: payload.domainName,
    amount: payload.amount
  });

  const authorization = request.headers.get("authorization");
  const { response, result } = await forwardIntegrationRequest(CHARGE_API_URL, payload, authorization);

  if (!response.ok || !result?.ok) {
    console.warn("[integration-charge] failed", {
      externalId: payload.externalId,
      status: response.status,
      message: result?.message
    });

    return Response.json(
      {
        ok: false,
        message: result?.message ?? "충전신청 전송에 실패했습니다."
      },
      { status: response.status || 500 }
    );
  }

  return Response.json(result);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authorization = request.headers.get("authorization");
  const { response, result } = await forwardIntegrationQuery(CHARGE_API_URL, searchParams, authorization);

  if (!response.ok || !result?.ok) {
    return Response.json(
      {
        ok: false,
        message: result?.message ?? "충전신청 내역 조회에 실패했습니다."
      },
      { status: response.status || 500 }
    );
  }

  return Response.json(result);
}
