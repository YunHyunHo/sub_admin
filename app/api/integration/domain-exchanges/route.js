import { forwardIntegrationQuery, forwardIntegrationRequest, getDomainPayload, integrationError } from "../_utils";

const DOMAIN_EXCHANGE_API_URL =
  process.env.DOMAIN_EXCHANGE_API_URL ?? "https://laylow.me/api/integration/domain-exchanges";

export async function POST(request) {
  const body = await request.json();
  const amount = Number(body.amount);
  const domainPayload = getDomainPayload(body.partner);

  if (!domainPayload.domainId && !domainPayload.domainName) {
    return integrationError("도메인 정보가 없습니다.");
  }

  if (!body.userId?.trim()) {
    return integrationError("요청 사용자 ID가 없습니다.");
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return integrationError("환전 금액을 입력해주세요.");
  }

  const payload = {
    externalId: body.externalId,
    ...domainPayload,
    userId: body.userId.trim(),
    amount
  };

  if (body.bankName?.trim()) {
    payload.bankName = body.bankName.trim();
  }

  if (body.accountHolder?.trim()) {
    payload.accountHolder = body.accountHolder.trim();
  }

  if (body.accountNumber?.trim()) {
    payload.accountNumber = body.accountNumber.trim();
  }

  console.info("[integration-exchange] request", {
    externalId: payload.externalId,
    domainId: payload.domainId,
    domainName: payload.domainName,
    userId: payload.userId,
    amount: payload.amount
  });

  const { response, result } = await forwardIntegrationRequest(DOMAIN_EXCHANGE_API_URL, payload);

  if (!response.ok || !result?.ok) {
    const message =
      response.status === 405
        ? "마스터 관리자 환전신청 API가 POST 요청을 허용하지 않습니다. 연동 API 활성화가 필요합니다."
        : result?.message ?? "환전신청 전송에 실패했습니다.";

    console.warn("[integration-exchange] failed", {
      externalId: payload.externalId,
      status: response.status,
      message
    });

    return Response.json(
      {
        ok: false,
        message
      },
      { status: response.status || 500 }
    );
  }

  return Response.json(result);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { response, result } = await forwardIntegrationQuery(DOMAIN_EXCHANGE_API_URL, searchParams);

  if (!response.ok || !result?.ok) {
    return Response.json(
      {
        ok: false,
        message: result?.message ?? "도메인환전 내역 조회에 실패했습니다."
      },
      { status: response.status || 500 }
    );
  }

  return Response.json(result);
}
