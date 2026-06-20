# 외부 사이트 Mancoin 충전 및 구매내역 연동 가이드

## 목적

외부 사이트에서 Mancoin 충전신청을 생성하고, 동일한 신청을 마스터 어드민에 등록하여 도메인 어드민의 `구매내역`에 표시합니다.

## 전체 흐름

```txt
외부 사이트 충전신청
-> Mancoin makeTransaction 호출
-> Mancoin 거래 생성 성공(code: 0)
-> 마스터 어드민 충전신청 API 호출
-> 마스터 어드민에 PENDING 내역 생성
-> 도메인 어드민 구매내역에 자동 표시
```

Mancoin API는 실제 충전 거래와 입금계좌를 생성하고, 마스터 어드민 API는 해당 거래를 구매내역에 등록하는 역할입니다.

## 1. 외부 사이트 구현

외부 사이트의 충전신청 처리 코드에서 아래 순서로 두 API를 호출합니다.

### 1-1. 신청 식별값 생성

충전신청마다 UUID 형식의 `externalId`를 한 번 생성합니다. 마스터 어드민 등록을 재시도할 때는 새로운 값을 만들지 않고 같은 `externalId`를 사용합니다.

### 1-2. Mancoin 충전 거래 생성

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

| Mancoin 필드 | 외부 사이트 값 |
| --- | --- |
| `id` | 충전을 신청한 사용자 ID |
| `domainUrl` | 충전이 발생한 외부 사이트 도메인 |
| `coinCount` | 충전금액 / 10,000 |
| `bankHolderName` | 사용자가 입력한 입금자명 |

Mancoin 문서 기준으로 코인 1개는 10,000원이므로 충전금액은 아래와 같이 계산합니다.

```txt
충전금액 = coinCount * 10,000
```

### 1-3. Mancoin 성공 확인

HTTP `200`이고 응답의 `code`가 `0`일 때만 다음 단계로 진행합니다.

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

외부 사이트에서는 `bank_name`, `bank_holder`, `bank_account`, `price`를 충전 신청자에게 표시합니다.

### 1-4. 마스터 어드민 구매내역 등록

Mancoin 성공 직후 동일한 신청을 마스터 어드민으로 전송합니다.

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

| 마스터 어드민 필드 | 사용할 값 |
| --- | --- |
| `externalId` | 1-1에서 생성한 UUID |
| `depositorName` | Mancoin 요청의 `bankHolderName` |
| `amount` | Mancoin 응답의 `result.price` |
| `bankName` | Mancoin 응답의 `result.bank_name` |
| `accountHolder` | Mancoin 응답의 `result.bank_holder` |
| `accountNumber` | Mancoin 응답의 `result.bank_account` |

Mancoin 계좌정보는 세 필드를 모두 보내야 합니다. 모두 생략하면 마스터 어드민에 설정된 업체 계좌를 사용하며, 일부 값만 보내면 HTTP `400`으로 처리됩니다.

성공 응답의 `status`는 최초 `PENDING`입니다.

```json
{
  "ok": true,
  "requestId": "9a49e742-d94f-4bf9-a975-48aa9be0cbb1",
  "externalId": "2ca5ea3d-f95e-4e89-bdb3-3d0f67984f60",
  "status": "PENDING",
  "duplicate": false
}
```

## 2. 도메인 어드민 구현

도메인 어드민은 Mancoin API를 다시 호출하지 않습니다. 마스터 어드민에 등록된 충전신청을 조회하여 `구매내역`에 표시합니다.

```http
GET https://laylow.me/api/integration/charge-requests?domainId={domainId}&page=1&pageSize=10&from=2026-06-01&to=2026-06-30
```

조회 기준은 `domainId` 우선이며, `domainId`가 없을 때만 `domainName`을 사용합니다.

| 구매내역 화면 | 마스터 응답 필드 |
| --- | --- |
| ID | `id` |
| 은행 | `bankName` |
| 예금주 | `depositorName` |
| 계좌번호 | `accountNumber` |
| 요청금액 | `amount` |
| 구매자 | `buyer` |
| 요청일 | `requestedAt` |
| 상태변경일 | `changedAt` |
| 상태 | `status` |

상태 표시는 아래와 같이 변환합니다.

| API 상태 | 화면 표시 |
| --- | --- |
| `PENDING` | 대기 |
| `APPROVED` | 승인 |
| `REJECTED` | 거절 |

현재 도메인 어드민은 로그인 후 구매내역을 5초마다 갱신하므로 마스터 등록이 완료되면 새로고침 없이 표시됩니다.

## 3. 실패 처리 순서

| 상황 | 처리 |
| --- | --- |
| Mancoin 호출 실패 | 오류를 표시하고 마스터 어드민은 호출하지 않음 |
| Mancoin 성공, 마스터 등록 실패 | 같은 `externalId`로 마스터 등록만 재시도 |
| Mancoin 계좌정보 일부 누락 | 세 계좌값을 모두 채워 마스터 등록 재요청 |
| 마스터 등록 성공 | 구매내역에 `PENDING`으로 표시 |
| 같은 `externalId` 재전송 | 새 내역을 만들지 않고 기존 신청 결과 사용 |

## 4. 외부 사이트 개발자에게 전달할 항목

1. Mancoin API 설명서
2. 이 연동 가이드
3. 마스터 충전신청 URL: `https://laylow.me/api/integration/charge-requests`
4. 해당 외부 사이트에 연결된 도메인별 `X-API-Key`
5. 실제 운영 `domainUrl`
6. `Mancoin 성공 -> 마스터 등록` 호출 순서
7. 동일 신청 재시도 시 같은 `externalId`를 사용한다는 기준

환경변수 예시:

```env
MANCOIN_API_URL=https://asia-northeast3-mancoin-f85f5.cloudfunctions.net/api/makeTransaction
WINPAY_CHARGE_API_URL=https://laylow.me/api/integration/charge-requests
WINPAY_API_KEY=도메인별_API_KEY
SITE_DOMAIN_URL=https://example.com
```

## 5. 도메인 어드민 개발자에게 전달할 항목

1. 구매내역은 Mancoin이 아니라 마스터 어드민 조회 API를 사용한다는 기준
2. 로그인 응답의 `domainId`를 조회 요청에 전달한다는 기준
3. 구매내역 상태 매핑: `PENDING / APPROVED / REJECTED`
4. 신규 신청이 자동 반영되도록 주기적으로 구매내역을 갱신한다는 기준
5. Mancoin 거래를 도메인 어드민에서 중복 생성하지 않는다는 기준

## 완료 기준

1. 외부 사이트에서 충전신청을 하면 Mancoin 입금계좌가 표시됩니다.
2. Mancoin 성공 후 마스터 어드민에 충전신청이 `PENDING`으로 생성됩니다.
3. 동일 신청이 도메인 어드민 `구매내역`에 표시됩니다.
4. 마스터 어드민에서 승인 또는 거절하면 도메인 어드민 상태가 갱신됩니다.
5. 재시도하더라도 같은 신청이 중복 생성되지 않습니다.
