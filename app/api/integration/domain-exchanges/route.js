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

  if (!body.bankName?.trim() || !body.accountHolder?.trim() || !body.accountNumber?.trim()) {
    return integrationError("출금은행, 예금주, 계좌번호를 모두 입력해주세요.");
  }

  const payload = {
    externalId: body.externalId,
    ...domainPayload,
    userId: body.userId.trim(),
    amount,
    bankName: body.bankName.trim(),
    accountHolder: body.accountHolder.trim(),
    accountNumber: body.accountNumber.trim()
  };

  console.info("[integration-exchange] request", {
    externalId: payload.externalId,
    domainId: payload.domainId,
    domainName: payload.domainName,
    userId: payload.userId,
    amount: payload.amount
  });

  const { response, result } = await forwardIntegrationRequest(DOMAIN_EXCHANGE_API_URL, payload);

  if (!response.ok || !result?.ok) {
    console.warn("[integration-exchange] failed", {
      externalId: payload.externalId,
      status: response.status,
      message: result?.message
    });

    return Response.json(
      {
        ok: false,
        message: result?.message ?? "환전신청 전송에 실패했습니다."
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
