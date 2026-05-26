const DEMO_LOGIN_ID = "admin";
const DEMO_PASSWORD = "0000";

export async function POST(request) {
  const { loginId, password } = await request.json();

  if (loginId === DEMO_LOGIN_ID && password === DEMO_PASSWORD) {
    return Response.json({
      ok: true,
      user: {
        loginId,
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
