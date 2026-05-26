export async function GET() {
  return Response.json({
    partner: {
      id: "essenc2",
      name: "에센씨2",
      version: "01.30"
    },
    balance: 0,
    totals: {
      deposit: 50000000,
      fee: 300000,
      exchange: 49700000,
      remaining: 0
    }
  });
}

export async function POST(request) {
  const body = await request.json();

  return Response.json({
    ok: true,
    received: body,
    message: "신청이 접수되었습니다."
  });
}
