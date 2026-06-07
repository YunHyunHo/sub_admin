"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Contact,
  CreditCard,
  LogOut,
  Moon,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sun,
  WalletCards
} from "lucide-react";

const moneyButtons = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000];

const navItems = [
  { key: "charge", label: "충전", icon: ArrowDownToLine },
  { key: "withdraw", label: "출금", icon: ArrowUpFromLine },
  { key: "orders", label: "구매내역", icon: CreditCard },
  { key: "settlement", label: "정산내역", icon: CalendarDays }
];

const SESSION_STORAGE_KEY = "winpay_partner_session";

function formatWon(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatWonText(value) {
  return `${formatWon(Number(value) || 0)} 원`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatStatus(status) {
  const statusMap = {
    PENDING: "대기",
    APPROVED: "승인",
    REJECTED: "거절"
  };

  return statusMap[status] ?? status ?? "-";
}

function getDefaultDateRange() {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const from = new Date(to);
  from.setDate(to.getDate() - 7);

  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to)
  };
}

function appendDomainParams(params, partner) {
  if (partner?.domainId) {
    params.set("domainId", partner.domainId);
  } else if (partner?.name || partner?.domain) {
    params.set("domainName", partner.domain || partner.name);
  }
}

async function getJson(url) {
  const response = await fetch(url);
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message ?? "데이터 조회에 실패했습니다.");
  }

  return result;
}

function createExternalId(type, userId) {
  const safeUserId = (userId || "partner").replace(/[^a-zA-Z0-9_-]/g, "");
  return `domain-${safeUserId}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new Error(result?.message ?? "요청 처리에 실패했습니다.");
  }

  return result;
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [session, setSession] = useState(null);
  const [active, setActive] = useState("charge");
  const [dark, setDark] = useState(true);
  const [koreaTime, setKoreaTime] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeUserId, setChargeUserId] = useState("");
  const [chargeDepositor, setChargeDepositor] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [withdrawAccountHolder, setWithdrawAccountHolder] = useState("");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState("");
  const [chargeStatus, setChargeStatus] = useState(null);
  const [withdrawStatus, setWithdrawStatus] = useState(null);
  const [chargeSubmitting, setChargeSubmitting] = useState(false);
  const [chargeRequests, setChargeRequests] = useState([]);
  const [domainExchangeRequests, setDomainExchangeRequests] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);
  const [settlementTotal, setSettlementTotal] = useState(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [historyError, setHistoryError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const partner = session?.partner ?? dashboard?.partner;
  const sessionUserId = session?.user?.loginId ?? "";

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, []);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!savedSession) {
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession);
      setSession(parsedSession);
      setLoggedIn(true);
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    function updateKoreaTime() {
      setKoreaTime(
        new Intl.DateTimeFormat("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Seoul"
        }).format(new Date())
      );
    }

    updateKoreaTime();
    const timer = window.setInterval(updateKoreaTime, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const totals = useMemo(
    () => {
      const data = dashboard?.totals;
      return [
        ["입금", formatWon(data?.deposit ?? 0)],
        ["수수료", formatWon(data?.fee ?? 0)],
        ["환전", formatWon(data?.exchange ?? 0)],
        ["잔고", formatWon(data?.remaining ?? 0)],
        ["환전액", formatWon(data?.exchange ?? 0)]
      ];
    },
    [dashboard]
  );

  useEffect(() => {
    if (!loggedIn || !partner) {
      return;
    }

    async function loadHistoryData() {
      const range = getDefaultDateRange();
      const baseParams = new URLSearchParams({
        page: "1",
        pageSize: "10",
        from: range.from,
        to: range.to
      });
      appendDomainParams(baseParams, partner);

      if (!baseParams.has("domainId") && !baseParams.has("domainName")) {
        setHistoryError("도메인 정보가 없어 내역을 조회할 수 없습니다.");
        return;
      }

      try {
        setHistoryError("");
        const settlementParams = new URLSearchParams(baseParams);
        settlementParams.delete("page");
        settlementParams.delete("pageSize");

        const [charges, exchanges, settlements] = await Promise.all([
          getJson(`/api/integration/charge-requests?${baseParams.toString()}`),
          getJson(`/api/integration/domain-exchanges?${baseParams.toString()}`),
          getJson(`/api/integration/domain-settlements?${settlementParams.toString()}`)
        ]);

        setChargeRequests(charges.items ?? []);
        setDomainExchangeRequests(exchanges.items ?? []);
        setSettlementRows(settlements.items ?? []);
        setSettlementTotal(settlements.total ?? null);
      } catch (error) {
        setHistoryError(error.message);
      }
    }

    loadHistoryData();
  }, [loggedIn, partner, historyRefreshKey]);

  if (!loggedIn) {
    return <LoginScreen onLogin={(result) => {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(result));
      setSession(result);
      setLoggedIn(true);
    }} />;
  }

  async function handleChargeSubmit() {
    if (chargeSubmitting) {
      return;
    }

    setChargeStatus(null);
    setChargeSubmitting(true);

    try {
      const result = await postJson("/api/integration/charge-requests", {
        externalId: createExternalId("charge", chargeUserId || sessionUserId),
        partner,
        userId: chargeUserId || sessionUserId,
        depositorName: chargeDepositor,
        amount: Number(chargeAmount)
      });
      setChargeStatus({
        type: "success",
        message: result.message ?? "충전신청이 관리자에 전송되었습니다."
      });
      setChargeAmount("");
      setHistoryRefreshKey((current) => current + 1);
    } catch (error) {
      setChargeStatus({
        type: "error",
        message: error.message
      });
    } finally {
      setChargeSubmitting(false);
    }
  }

  async function handleWithdrawSubmit() {
    setWithdrawStatus(null);

    try {
      const result = await postJson("/api/integration/domain-exchanges", {
        externalId: createExternalId("exchange", sessionUserId),
        partner,
        userId: sessionUserId,
        amount: Number(withdrawAmount),
        bankName: withdrawBank,
        accountHolder: withdrawAccountHolder,
        accountNumber: withdrawAccountNumber
      });
      setWithdrawStatus({
        type: "success",
        message: result.message ?? "환전신청이 관리자에 전송되었습니다."
      });
      setDomainExchangeRequests((current) => [
        {
          id: result.requestId ?? "대기",
          bankName: withdrawBank,
          accountHolder: withdrawAccountHolder,
          accountNumber: withdrawAccountNumber,
          amount: Number(withdrawAmount),
          requestedAt: "방금",
          completedAt: "-",
          status: "PENDING"
        },
        ...current
      ]);
      setWithdrawAmount("");
    } catch (error) {
      setWithdrawStatus({
        type: "error",
        message: error.message
      });
    }
  }

  return (
    <main className={dark ? "shell dark" : "shell light"}>
      <aside className="sidebar">
        <div className="brandMini">
          <ShieldCheck size={18} />
          <span>{partner?.name ?? "파트너"}</span>
          <small>(연락처)</small>
        </div>

        <nav className="navList" aria-label="관리 메뉴">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={active === item.key ? "navItem active" : "navItem"}
                key={item.key}
                onClick={() => setActive(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <section className="sideCard">
          <h3>개인 거래 현황</h3>
          {totals.map(([label, value]) => (
            <p key={label}>
              <span>{label} :</span>
              <strong>{value}</strong>
            </p>
          ))}
        </section>

        <section className="sideCard waiting">
          <h3>대기 현황</h3>
          <div>
            <span>충전 0</span>
            <span>출금 0</span>
          </div>
        </section>

        <div className="sideFooter">
          <Toggle label="다크 / 라이트" checked={dark} onChange={setDark} icons={[Moon, Sun]} />
          <span className="timeLabel">한국시간</span>
          <time>{koreaTime}</time>
          <span>Version {dashboard?.partner?.version ?? "01.30"}</span>
          <div className="footerLinks">
            <button type="button">
              <Contact size={15} />
              Contact Us
            </button>
            <button
              onClick={() => {
                window.localStorage.removeItem(SESSION_STORAGE_KEY);
                setSession(null);
                setLoggedIn(false);
              }}
              type="button"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        {active === "charge" && (
          <ChargePage
            amount={chargeAmount}
            chargeUserId={chargeUserId}
            depositor={chargeDepositor}
            submitting={chargeSubmitting}
            status={chargeStatus}
            setAmount={setChargeAmount}
            setChargeUserId={setChargeUserId}
            setDepositor={setChargeDepositor}
            onSubmit={handleChargeSubmit}
          />
        )}
        {active === "withdraw" && (
          <WithdrawPage
            accountHolder={withdrawAccountHolder}
            accountNumber={withdrawAccountNumber}
            amount={withdrawAmount}
            bankName={withdrawBank}
            rows={domainExchangeRequests}
            status={withdrawStatus}
            setAccountHolder={setWithdrawAccountHolder}
            setAccountNumber={setWithdrawAccountNumber}
            setAmount={setWithdrawAmount}
            setBankName={setWithdrawBank}
            onSubmit={handleWithdrawSubmit}
          />
        )}
        {active === "orders" && <OrdersPage error={historyError} rows={chargeRequests} />}
        {active === "settlement" && (
          <SettlementPage error={historyError} rows={settlementRows} total={settlementTotal} />
        )}
      </section>
    </main>
  );
}

function LoginScreen({ onLogin }) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ loginId, password })
      });
      const result = await response.json();

      if (!response.ok || !result.ok) {
        console.warn("[partner-auth] login failed", {
          status: response.status,
          message: result.message,
          debug: result.debug
        });
        setError(result.message ?? "로그인 정보를 확인해주세요.");
        return;
      }

      onLogin(result);
    } catch {
      setError("잠시 후 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="loginScreen">
      <section className="loginPanel">
        <p className="eyebrow">Partner Admin</p>
        <h1>WINPAY</h1>
        <form onSubmit={handleSubmit}>
          <label>
            <span>아이디</span>
            <input
              autoComplete="username"
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="아이디를 입력하세요"
              value={loginId}
            />
          </label>
          <label>
            <span>비밀번호</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="비밀번호를 입력하세요"
              type="password"
              value={password}
            />
          </label>
          {error && <p className="loginError">{error}</p>}
          <button disabled={submitting} type="submit">
            {submitting ? "확인 중" : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Toggle({ label, checked, onChange, icons }) {
  const [OffIcon, OnIcon] = icons;
  const Icon = checked ? OnIcon : OffIcon;
  return (
    <label className="toggleRow">
      <span>{label}</span>
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <i>
        <Icon size={15} />
      </i>
    </label>
  );
}

function AmountButtons({ onPick, includeAll }) {
  return (
    <div className="amountButtons">
      {moneyButtons.map((value) => (
        <button key={value} onClick={() => onPick(value)} type="button">
          {value >= 10000 ? `${value / 10000}만원` : `${value / 1000}천원`}
        </button>
      ))}
      {includeAll && (
        <button onClick={() => onPick(49700000)} type="button">
          전액
        </button>
      )}
      <button className="soft" onClick={() => onPick(0)} type="button">
        리셋
      </button>
    </div>
  );
}

function ChargePage({
  amount,
  chargeUserId,
  depositor,
  submitting,
  status,
  setAmount,
  setChargeUserId,
  setDepositor,
  onSubmit
}) {
  return (
    <PageFrame title="충전">
      <section className="formTable">
        <div className="labelCell">아이디</div>
        <div className="valueCell">
          <input
            className="valueInput"
            onChange={(event) => setChargeUserId(event.target.value)}
            placeholder="아이디 입력"
            value={chargeUserId}
          />
        </div>
        <div className="labelCell">입금자명</div>
        <div className="valueCell">
          <input
            className="valueInput"
            onChange={(event) => setDepositor(event.target.value)}
            placeholder="입금자명 입력"
            value={depositor}
          />
        </div>
        <div className="labelCell">충전금액</div>
        <div className="valueCell moneyInput">
          <span>₩</span>
          <input
            inputMode="numeric"
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="충전 금액 입력"
            value={amount ? formatWon(Number(amount)) : ""}
          />
          <AmountButtons onPick={(value) => setAmount(value ? String(value) : "")} />
        </div>
      </section>
      <button className="primaryAction" disabled={submitting} onClick={onSubmit} type="button">
        {submitting ? "신청 중" : "충전 신청"}
      </button>
      <FormNotice status={status} />
    </PageFrame>
  );
}

function WithdrawPage({
  accountHolder,
  accountNumber,
  amount,
  bankName,
  rows,
  status,
  setAccountHolder,
  setAccountNumber,
  setAmount,
  setBankName,
  onSubmit
}) {
  return (
    <PageFrame title="출금">
      <section className="formTable">
        <div className="labelCell">보유금액</div>
        <div className="valueCell strong">₩ 0</div>
        <div className="labelCell">환전금액</div>
        <div className="valueCell moneyInput">
          <span>₩</span>
          <input
            inputMode="numeric"
            onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="환전 금액 입력"
            value={amount ? formatWon(Number(amount)) : ""}
          />
          <AmountButtons includeAll onPick={(value) => setAmount(value ? String(value) : "")} />
        </div>
        <div className="labelCell">출금은행</div>
        <div className="valueCell">
          <input
            className="valueInput"
            onChange={(event) => setBankName(event.target.value)}
            placeholder="출금은행 입력"
            value={bankName}
          />
        </div>
        <div className="labelCell">예금주</div>
        <div className="valueCell">
          <input
            className="valueInput"
            onChange={(event) => setAccountHolder(event.target.value)}
            placeholder="예금주 입력"
            value={accountHolder}
          />
        </div>
        <div className="labelCell">계좌번호</div>
        <div className="valueCell">
          <input
            className="valueInput"
            onChange={(event) => setAccountNumber(event.target.value)}
            placeholder="계좌번호 입력"
            value={accountNumber}
          />
        </div>
      </section>
      <button className="primaryAction" onClick={onSubmit} type="button">환전신청하기</button>
      <FormNotice status={status} />
      <DataTable
        columns={["ID", "출금은행", "예금주", "계좌번호", "요청금액", "요청일", "완료일", "상태"]}
        rows={rows.map((row) => [
          row.id ?? "-",
          row.bankName ?? "-",
          row.accountHolder ?? "-",
          row.accountNumber ?? "-",
          formatWonText(row.amount),
          row.requestedAt ?? "-",
          row.completedAt ?? "-",
          formatStatus(row.status)
        ])}
      />
      <Pagination />
    </PageFrame>
  );
}

function FormNotice({ status }) {
  if (!status) {
    return null;
  }

  return <p className={`formNotice ${status.type}`}>{status.message}</p>;
}

function OrdersPage({ error, rows }) {
  return (
    <PageFrame title="구매내역">
      <div className="toolbar">
        <strong>조건선택</strong>
        <SelectButton label="충전" />
        <SelectButton label="전체" />
        <div className="toolbarSpacer" />
        <label className="searchBox">
          <Search size={17} />
          <input placeholder="구매자 입력" />
        </label>
        <DateInput value="26-05-24" />
        <span className="dash">-</span>
        <DateInput value="26-05-26" />
        <button className="toolbarBtn" type="button">검색</button>
        <button className="toolbarBtn muted" type="button">
          <RefreshCcw size={16} />
          초기화
        </button>
      </div>
      <FormNotice status={error ? { type: "error", message: error } : null} />
      <DataTable
        columns={["ID", "은행", "예금주", "계좌번호", "요청금액", "구매자", "요청일", "상태변경일", "상태"]}
        rows={rows.map((row) => [
          row.id ?? "-",
          row.bankName ?? "-",
          row.depositorName ?? "-",
          row.accountNumber ?? "-",
          formatWonText(row.amount),
          row.buyer ?? "-",
          row.requestedAt ?? "-",
          row.changedAt ?? "-",
          formatStatus(row.status)
        ])}
      />
      <Pagination />
    </PageFrame>
  );
}

function SettlementPage({ error, rows, total }) {
  const tableRows = rows.map((row) => [
    row.date ?? "-",
    formatWonText(row.chargeAmount),
    formatWonText(row.feeAmount),
    formatWonText(row.netChargeAmount),
    formatWonText(row.exchangeAmount),
    formatWonText(row.balanceAmount)
  ]);

  if (total) {
    tableRows.push([
      "합계",
      formatWonText(total.chargeAmount),
      formatWonText(total.feeAmount),
      formatWonText(total.netChargeAmount),
      formatWonText(total.exchangeAmount),
      total.balanceAmount == null ? "" : formatWonText(total.balanceAmount)
    ]);
  }

  return (
    <PageFrame title="일정산">
      <div className="toolbar settlementTools">
        <div className="toolbarSpacer" />
        <strong>날짜 조회</strong>
        <DateInput value="26-05-19" />
        <span className="dash">-</span>
        <DateInput value="26-05-26" />
        <button className="toolbarBtn" type="button">조회</button>
      </div>
      <FormNotice status={error ? { type: "error", message: error } : null} />
      <DataTable
        columns={["날짜", "충전", "수수료", "충전(수수료제외)", "환전", "보유금액"]}
        rows={tableRows}
      />
    </PageFrame>
  );
}

function PageFrame({ title, children }) {
  return (
    <div className="pageFrame">
      <header className="pageHeader">
        <h2>{title}</h2>
      </header>
      {children}
    </div>
  );
}

function SelectButton({ label }) {
  return (
    <button className="selectBtn" type="button">
      {label}
      <ChevronDown size={16} />
    </button>
  );
}

function DateInput({ value }) {
  return (
    <label className="dateInput">
      <CalendarDays size={16} />
      <input defaultValue={value} />
    </label>
  );
}

function DataTable({ columns, rows }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td className={cell === "승인" ? "statusCell" : ""} key={`${cell}-${cellIndex}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination() {
  return (
    <div className="pagination">
      <button type="button"><ChevronsLeft size={16} /></button>
      <button type="button">‹</button>
      <button className="active" type="button">1</button>
      <button type="button">›</button>
      <button type="button"><ChevronsRight size={16} /></button>
    </div>
  );
}
