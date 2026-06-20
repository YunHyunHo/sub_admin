# WinPay 외부 사이트 충전 연동 API 최종 문서

## 1. 목적

외부 사이트에서 Mancoin 충전 거래를 생성한 뒤 해당 신청을 WinPay 마스터 어드민에 등록합니다.

마스터 어드민에 등록된 신청은 연결된 도메인 어드민의 `구매내역`에 자동으로 표시되며, 마스터 어드민에서 기존 충전신청과 동일하게 승인 또는 거절할 수 있습니다.

## 2. 운영 주소

| 구분 | URL |
| --- | --- |
| Mancoin 충전 생성 | `https://asia-northeast3-mancoin-f85f5.cloudfunctions.net/api/makeTransaction` |
| WinPay 충전신청 등록 | `https://laylow.me/api/integration/charge-requests` |
| 도메인 어드민 | `https://www.laylow.org` |

## 3. 전체 처리 순서

```txt
외부 사이트에서 충전신청
-> 외부 사이트가 신청용 externalId(UUID) 생성
-> Mancoin makeTransaction 호출
-> Mancoin 성공(code: 0) 및 입금계좌 수신
-> WinPay 충전신청 등록 API 호출
-> 마스터 어드민에 PENDING 신청 생성
-> 도메인 어드민 구매내역에 자동 표시
-> 마스터 어드민에서 승인 또는 거절
-> 도메인 어드민 상태 및 정산정보 갱신
```

외부 사이트가 WinPay 마스터 어드민 API를 직접 호출합니다. 도메인 어드민은 신청을 다시 전달하지 않고, 마스터 어드민에 생성된 동일한 신청을 조회하여 표시합니다.

## 4. 다중 도메인 연결 기준

각 도메인은 별도의 API 키를 사용합니다.

```txt
도메인 A -> API Key A -> 구매내역 A
도메인 B -> API Key B -> 구매내역 B
도메인 C -> API Key C -> 구매내역 C
```

- API 키가 어떤 도메인의 신청인지 자동으로 결정합니다.
- WinPay 요청 Body에 `domainId` 또는 `domainName`을 보내지 않습니다.
- 하나의 도메인에는 활성 API 키가 1개만 존재합니다.
- 같은 도메인에서 새 키를 발급하면 기존 키는 중지됩니다.
- 하나의 외부 시스템이 여러 도메인을 처리한다면 요청이 발생한 도메인에 맞는 API 키를 선택해야 합니다.

## 5. API 1 - Mancoin 충전 생성

### 요청

```http
POST https://asia-northeast3-mancoin-f85f5.cloudfunctions.net/api/makeTransaction
Content-Type: application/json
```

```json
{
  "id": "user123",
  "domainUrl": "https://example.com",
  "coinCount": 10,
  "bankHolderName": "홍길동"
}
```

### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | ---: | --- |
| `id` | string | 필수 | 외부 사이트에서 충전을 신청한 사용자 ID |
| `domainUrl` | string | 필수 | 충전이 발생한 외부 사이트 URL |
| `coinCount` | number | 필수 | 충전 코인 수량. 코인 1개는 10,000원 |
| `bankHolderName` | string | 필수 | 실제 입금자명 |

```txt
충전금액 = coinCount * 10,000
```

### 성공 응답

HTTP `200`이고 `code`가 `0`이면 성공입니다.

```json
{
  "code": 0,
  "message": "Transaction created successfully",
  "result": {
    "bank_name": "woori",
    "bank_holder": "예금주",
    "bank_account": "1234567890",
    "price": 100000,
    "coin_amount": 10,
    "status": "pending",
    "coin_symbol": "MAN"
  }
}
```

Mancoin 성공 응답을 받은 후에만 WinPay 충전신청 등록 API를 호출합니다.

### 실패 응답

```json
{
  "code": 1,
  "message": "Domain not found"
}
```

```json
{
  "code": 2,
  "message": "Internal server error",
  "error": "Error message here"
}
```

Mancoin 요청이 실패하면 WinPay 충전신청 등록 API는 호출하지 않습니다.

## 6. API 2 - WinPay 충전신청 등록

### 요청

```http
POST https://laylow.me/api/integration/charge-requests
Content-Type: application/json
X-API-Key: 도메인별_API_KEY
```

```json
{
  "externalId": "2ca5ea3d-f95e-4e89-bdb3-3d0f67984f60",
  "depositorName": "홍길동",
  "amount": 100000,
  "bankName": "woori",
  "accountHolder": "예금주",
  "accountNumber": "1234567890"
}
```

### 요청 필드

| 필드 | 타입 | 필수 | 설명 |
| --- | --- | ---: | --- |
| `externalId` | UUID string | 필수 | 외부 사이트가 신청마다 한 번 생성하는 고유 ID |
| `depositorName` | string | 필수 | Mancoin 요청의 `bankHolderName` |
| `amount` | integer | 필수 | Mancoin 응답의 `result.price`, 최소 10,000원 |
| `bankName` | string | 조건부 | Mancoin 응답의 `result.bank_name` |
| `accountHolder` | string | 조건부 | Mancoin 응답의 `result.bank_holder` |
| `accountNumber` | string | 조건부 | Mancoin 응답의 `result.bank_account` |

### 계좌정보 전달 규칙

`bankName`, `accountHolder`, `accountNumber`는 다음 두 방식 중 하나로 전달합니다.

1. Mancoin 응답의 세 값을 모두 전달
2. 세 값을 모두 생략하여 마스터 어드민에 설정된 업체 계좌 사용

세 필드 중 일부만 전달하면 HTTP `400`으로 거절됩니다.

### Mancoin 응답 매핑

| Mancoin | WinPay |
| --- | --- |
| 요청 `bankHolderName` | `depositorName` |
| 응답 `result.price` | `amount` |
| 응답 `result.bank_name` | `bankName` |
| 응답 `result.bank_holder` | `accountHolder` |
| 응답 `result.bank_account` | `accountNumber` |

### 신규 접수 성공

HTTP `201`:

```json
{
  "ok": true,
  "requestId": "9a49e742-d94f-4bf9-a975-48aa9be0cbb1",
  "externalId": "2ca5ea3d-f95e-4e89-bdb3-3d0f67984f60",
  "status": "PENDING",
  "duplicate": false,
  "message": "충전신청이 관리자에 전송되었습니다."
}
```

### 동일 신청 재전송

동일한 도메인 API 키와 동일한 `externalId`로 다시 요청하면 신규 신청을 생성하지 않고 기존 신청을 반환합니다.

HTTP `200`:

```json
{
  "ok": true,
  "requestId": "9a49e742-d94f-4bf9-a975-48aa9be0cbb1",
  "externalId": "2ca5ea3d-f95e-4e89-bdb3-3d0f67984f60",
  "status": "PENDING",
  "duplicate": true,
  "message": "이미 접수된 충전신청입니다. 기존 신청 정보를 반환합니다."
}
```

HTTP `200`과 `201`을 모두 성공으로 처리해야 합니다.

### 실패 응답

| HTTP | 상황 |
| ---: | --- |
| `400` | JSON 또는 UUID 형식 오류, 입금자명 누락, 10,000원 미만, 계좌정보 일부 누락 |
| `401` | API 키가 없거나 유효하지 않거나 중지됨 |
| `403` | API 연동 도메인에 API 키 없이 요청 |

계좌정보 일부 누락 예시:

```json
{
  "ok": false,
  "message": "은행, 예금주, 계좌번호는 모두 함께 보내주세요."
}
```

## 7. 재시도 규칙

| 상황 | 처리 |
| --- | --- |
| Mancoin 실패 | 오류 표시, WinPay API 호출 안 함 |
| Mancoin 성공, WinPay 실패 | Mancoin을 다시 생성하지 않고 같은 `externalId`로 WinPay 요청만 재시도 |
| WinPay 응답 없음 | 같은 `externalId`로 WinPay 요청 재시도 |
| WinPay `duplicate: true` | 기존 신청이 정상 접수된 것으로 처리 |

`externalId`는 Mancoin 호출 전에 생성하고 WinPay 등록이 완료될 때까지 보관해야 합니다.

## 8. Node.js 구현 예시

```js
import { randomUUID } from "node:crypto";

export async function createCharge({ userId, depositorName, coinCount }) {
  const externalId = randomUUID();

  const mancoinResponse = await fetch(process.env.MANCOIN_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: userId,
      domainUrl: process.env.SITE_DOMAIN_URL,
      coinCount,
      bankHolderName: depositorName
    })
  });
  const mancoin = await mancoinResponse.json();

  if (!mancoinResponse.ok || mancoin.code !== 0) {
    throw new Error(mancoin.message ?? "Mancoin 충전 생성에 실패했습니다.");
  }

  const winpayResponse = await fetch(process.env.WINPAY_CHARGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.WINPAY_API_KEY
    },
    body: JSON.stringify({
      externalId,
      depositorName,
      amount: mancoin.result.price,
      bankName: mancoin.result.bank_name,
      accountHolder: mancoin.result.bank_holder,
      accountNumber: mancoin.result.bank_account
    })
  });
  const winpay = await winpayResponse.json();

  if (!winpayResponse.ok || !winpay.ok) {
    throw new Error(winpay.message ?? "WinPay 충전신청 등록에 실패했습니다.");
  }

  return {
    externalId,
    requestId: winpay.requestId,
    duplicate: winpay.duplicate,
    status: winpay.status,
    bankName: mancoin.result.bank_name,
    accountHolder: mancoin.result.bank_holder,
    accountNumber: mancoin.result.bank_account,
    amount: mancoin.result.price
  };
}
```

## 9. 환경변수

```env
MANCOIN_API_URL=https://asia-northeast3-mancoin-f85f5.cloudfunctions.net/api/makeTransaction
WINPAY_CHARGE_API_URL=https://laylow.me/api/integration/charge-requests
WINPAY_API_KEY=도메인별_API_KEY
SITE_DOMAIN_URL=https://example.com
```

API 키와 `SITE_DOMAIN_URL`은 도메인마다 맞는 값을 사용합니다.

## 10. 도메인 어드민 반영 결과

WinPay 등록이 성공하면 연결된 도메인 어드민에서 다음 값이 표시됩니다.

| 구매내역 컬럼 | 표시값 |
| --- | --- |
| 은행 | `bankName` |
| 예금주 | `accountHolder` |
| 계좌번호 | `accountNumber` |
| 요청금액 | `amount` |
| 구매자 | `depositorName` |
| 상태 | 최초 `PENDING` -> 화면 `대기` |

도메인 어드민은 구매내역을 5초마다 갱신하므로 별도 새로고침 없이 신규 신청이 표시됩니다.

## 11. 상태값

| API 상태 | 도메인 어드민 표시 |
| --- | --- |
| `PENDING` | 대기 |
| `APPROVED` | 승인 |
| `REJECTED` | 거절 |

승인 또는 거절은 마스터 어드민에서 기존 충전신청과 동일하게 처리합니다.

## 12. 전달 항목

외부 사이트 개발자에게 아래 항목을 함께 전달합니다.

1. 이 최종 API 문서
2. Mancoin 원본 API 설명서
3. 연결할 사이트의 실제 `domainUrl`
4. 해당 도메인에 발급된 `X-API-Key`
5. 테스트용 사용자 ID와 입금자명

## 13. 운영 검증 결과

2026-06-20 `test04` 도메인으로 실제 요청을 두 차례 검증했습니다.

- 신규 신청 HTTP `201`, `PENDING` 생성 확인
- Mancoin 형식 은행, 예금주, 계좌번호, 금액 저장 확인
- 도메인 및 총판 연결 확인
- 동일 `externalId` 재전송 HTTP `200`, `duplicate: true` 확인
- 중복 충전신청이 생성되지 않는 것 확인
- 계좌정보 일부 전달 HTTP `400` 확인
- 도메인 어드민 구매내역 5초 자동 반영 확인
- 테스트 종료 후 임시 API 키 중지 확인

## 14. 구현 완료 기준

1. 외부 사이트 충전신청 시 Mancoin 입금계좌가 표시됩니다.
2. Mancoin 성공 후 WinPay 마스터 어드민에 `PENDING` 신청이 1건 생성됩니다.
3. 같은 신청이 연결된 도메인 어드민 구매내역에 자동 표시됩니다.
4. 은행, 예금주, 계좌번호, 금액이 Mancoin 응답과 일치합니다.
5. 동일 신청 재시도 시 중복 내역이 생성되지 않습니다.
6. 마스터 승인 또는 거절 후 도메인 어드민 상태가 갱신됩니다.
