# 마스터 어드민 도메인 관리자 조회 API 요청서

## 목적

도메인 관리자 사이트 `https://laylow.org`, `https://www.laylow.org`에서 아래 화면을 실제 마스터 관리자 데이터로 표시하기 위한 조회 API가 필요합니다.

- 구매내역
- 출금내역
- 정산내역

현재 도메인 관리자 사이트에서는 신청 API는 이미 연동되어 있습니다.

```http
POST https://laylow.me/api/integration/charge-requests
POST https://laylow.me/api/integration/domain-exchanges
```

이제 신청 이후 사용자가 본인 도메인의 내역을 볼 수 있도록 조회 API 3개가 필요합니다.

## 핵심 기준

모든 조회 API는 반드시 마스터 관리자에 생성된 도메인 기준으로 필터링되어야 합니다.

우선순위:

1. `domainId`
2. `domainName`

요청이 조회해야 하는 데이터는 아래 값에 연결된 데이터입니다.

| 값 | 설명 |
| --- | --- |
| `company_id` | 도메인/업체가 속한 회사 ID |
| `domain_id` | 마스터 관리자에 등록된 도메인 ID |
| `distributor_id` | 도메인에 연결된 총판 또는 상위총판 ID |

다른 도메인 또는 다른 업체 데이터가 섞이면 안 됩니다.

## 1. 충전신청 / 구매내역 조회 API

도메인 관리자 화면의 `구매내역`은 마스터 관리자 기준 `거래내역 > 충전신청` 데이터입니다.

### Endpoint 제안

```http
GET https://laylow.me/api/integration/charge-requests
```

### Query

```txt
domainId=마스터에서 생성된 domain uuid
domainName=도메인 또는 업체명
page=1
pageSize=10
from=2026-06-01
to=2026-06-07
status=APPROVED
```

`domainId`가 있으면 `domainId`를 우선 사용하고, 없을 때만 `domainName`을 fallback으로 사용하면 됩니다.

### 응답 예시

```json
{
  "ok": true,
  "items": [
    {
      "id": "38ce11d0",
      "bankName": "-",
      "depositorName": "-",
      "accountNumber": "-",
      "amount": 151700000,
      "buyer": "06.05",
      "requestedAt": "26-06-05 23:29:14",
      "changedAt": "26-06-05 23:29:18",
      "status": "APPROVED"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 화면 매핑

| 화면 컬럼 | 응답 필드 |
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

## 2. 도메인환전 / 출금내역 조회 API

도메인 관리자 화면의 `출금` 하단 목록은 마스터 관리자 기준 `도메인 > 도메인환전` 데이터입니다.

### Endpoint 제안

```http
GET https://laylow.me/api/integration/domain-exchanges
```

### Query

```txt
domainId=마스터에서 생성된 domain uuid
domainName=도메인 또는 업체명
page=1
pageSize=10
from=2026-06-01
to=2026-06-07
status=APPROVED
```

### 응답 예시

```json
{
  "ok": true,
  "items": [
    {
      "id": "fd50d0c8-a3",
      "bankName": "국민은행",
      "accountHolder": "s",
      "accountNumber": "11",
      "amount": 150865650,
      "requestedAt": "26-06-05 23:41:33",
      "completedAt": "26-06-05 23:41:40",
      "status": "APPROVED"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 1
  }
}
```

### 화면 매핑

| 화면 컬럼 | 응답 필드 |
| --- | --- |
| ID | `id` |
| 출금은행 | `bankName` |
| 예금주 | `accountHolder` |
| 계좌번호 | `accountNumber` |
| 요청금액 | `amount` |
| 요청일 | `requestedAt` |
| 완료일 | `completedAt` |
| 상태 | `status` |

## 3. 도메인 정산내역 조회 API

도메인 관리자 화면의 `정산내역`은 승인된 충전신청과 승인된 도메인환전을 일자별로 집계한 데이터입니다.

### Endpoint 제안

```http
GET https://laylow.me/api/integration/domain-settlements
```

### Query

```txt
domainId=마스터에서 생성된 domain uuid
domainName=도메인 또는 업체명
from=2026-05-30
to=2026-06-06
```

### 계산 기준

| 정산 컬럼 | 계산 기준 |
| --- | --- |
| 충전 | 해당 날짜 승인된 충전신청 총액 |
| 수수료 | 승인된 충전신청에서 발생한 수수료 합계 |
| 충전(수수료제외) | `충전 - 수수료` |
| 환전 | 해당 날짜 승인된 도메인환전 총액 |
| 보유금액 | 이전 보유금액 + 충전(수수료제외) - 환전 |

### 응답 예시

```json
{
  "ok": true,
  "items": [
    {
      "date": "26-06-05",
      "chargeAmount": 151700000,
      "feeAmount": 834350,
      "netChargeAmount": 150865650,
      "exchangeAmount": 150865650,
      "balanceAmount": 0
    }
  ],
  "total": {
    "chargeAmount": 1031640000,
    "feeAmount": 5828390,
    "netChargeAmount": 1025811610,
    "exchangeAmount": 1025811610,
    "balanceAmount": 0
  }
}
```

### 화면 매핑

| 화면 컬럼 | 응답 필드 |
| --- | --- |
| 날짜 | `date` |
| 충전 | `chargeAmount` |
| 수수료 | `feeAmount` |
| 충전(수수료제외) | `netChargeAmount` |
| 환전 | `exchangeAmount` |
| 보유금액 | `balanceAmount` |

## 상태값

상태값은 아래 enum으로 내려주시면 프론트에서 한국어로 변환할 수 있습니다.

| API 값 | 화면 표시 |
| --- | --- |
| `PENDING` | 대기 |
| `APPROVED` | 승인 |
| `REJECTED` | 거절 |

이미 한국어 상태값을 내려주는 경우에도 프론트에서 그대로 표시할 수 있습니다.

## 인증 / 보안

운영 안정성을 위해 아래 중 하나를 권장합니다.

1. 도메인별 `X-API-Key` 발급
2. Bearer token 검증
3. `domainId`와 API key 또는 token의 소유 관계 검증

권장 헤더:

```http
Content-Type: application/json
X-API-Key: 도메인별 발급 키
```

또는:

```http
Authorization: Bearer {token}
```

## 프론트 연동 상태

도메인 관리자 사이트 프론트는 현재 아래 구조로 준비되어 있습니다.

- 충전신청 전송: `/api/integration/charge-requests`
- 출금신청 전송: `/api/integration/domain-exchanges`
- 구매내역 화면: 충전신청 조회 API 응답으로 교체 예정
- 출금내역 화면: 도메인환전 조회 API 응답으로 교체 예정
- 정산내역 화면: 도메인 정산 조회 API 응답으로 교체 예정

조회 API가 준비되면 프론트에서는 현재 mock 데이터 배열만 API 응답으로 교체하면 됩니다.

## 최종 요청 문장

```txt
도메인 관리자 사이트 조회 연동 API 3개를 만들어주세요.

1. 충전신청 조회
GET /api/integration/charge-requests

2. 도메인환전 조회
GET /api/integration/domain-exchanges

3. 도메인 정산 조회
GET /api/integration/domain-settlements

공통 조건:
- domainId 또는 domainName으로 필터링 가능해야 합니다.
- domainId 우선, domainName은 fallback으로 사용합니다.
- 응답은 해당 도메인에 연결된 company_id, domain_id, distributor_id 기준 데이터만 내려와야 합니다.
- 다른 도메인/업체 데이터가 섞이면 안 됩니다.

충전신청은 거래내역 > 충전신청 데이터를 사용하면 됩니다.
출금신청은 도메인 > 도메인환전 데이터를 사용하면 됩니다.
정산내역은 승인된 충전신청과 승인된 도메인환전을 일자별로 집계해서 내려주세요.
```
