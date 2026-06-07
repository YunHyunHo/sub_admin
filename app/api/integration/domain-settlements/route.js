import { forwardIntegrationQuery } from "../_utils";

const DOMAIN_SETTLEMENT_API_URL =
  process.env.DOMAIN_SETTLEMENT_API_URL ?? "https://laylow.me/api/integration/domain-settlements";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { response, result } = await forwardIntegrationQuery(DOMAIN_SETTLEMENT_API_URL, searchParams);

  if (!response.ok || !result?.ok) {
    return Response.json(
      {
        ok: false,
        message: result?.message ?? "정산내역 조회에 실패했습니다."
      },
      { status: response.status || 500 }
    );
  }

  return Response.json(result);
}
