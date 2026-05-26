"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Clock3,
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

const mockOrders = [
  {
    id: "3a040cca",
    bank: "-",
    holder: "-",
    account: "-",
    amount: "50,000,000 원",
    buyer: "05.25",
    requestedAt: "26-05-25 23:11:09",
    changedAt: "26-05-25 23:11:09",
    status: "승인"
  }
];

const mockWithdraws = [
  {
    id: "a68244e5-14",
    bank: "국민은행",
    holder: "s",
    account: "11",
    amount: "49,700,000 원",
    requestedAt: "26-05-25 23:40:59",
    completedAt: "26-05-25 23:41:08",
    status: "승인"
  }
];

const settlementRows = [
  ["26-05-19", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-20", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-21", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-22", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-23", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-24", "0 원", "0 원", "0 원", "0 원", "No Data"],
  ["26-05-25", "50,000,000 원", "300,000 원", "49,700,000 원", "49,700,000 원", "0 원"],
  ["26-05-26", "0 원", "0 원", "0 원", "0 원", "0 원"]
];

function formatWon(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

export default function Home() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [session, setSession] = useState(null);
  const [active, setActive] = useState("charge");
  const [dark, setDark] = useState(true);
  const [koreaTime, setKoreaTime] = useState(true);
  const [chargeAmount, setChargeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setDashboard)
      .catch(() => setDashboard(null));
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

  if (!loggedIn) {
    return <LoginScreen onLogin={(result) => {
      setSession(result);
      setLoggedIn(true);
    }} />;
  }

  const partner = session?.partner ?? dashboard?.partner;

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
          <Toggle label="현지시간 / 한국시간" checked={koreaTime} onChange={setKoreaTime} icons={[Clock3, Clock3]} />
          <time>{koreaTime ? "21:59:10" : "12:59:10"}</time>
          <span>Version {dashboard?.partner?.version ?? "01.30"}</span>
          <div className="footerLinks">
            <button type="button">
              <Contact size={15} />
              Contact Us
            </button>
            <button onClick={() => setLoggedIn(false)} type="button">
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        {active === "charge" && (
          <ChargePage amount={chargeAmount} partner={partner} setAmount={setChargeAmount} />
        )}
        {active === "withdraw" && (
          <WithdrawPage amount={withdrawAmount} setAmount={setWithdrawAmount} />
        )}
        {active === "orders" && <OrdersPage />}
        {active === "settlement" && <SettlementPage />}
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

function ChargePage({ amount, partner, setAmount }) {
  return (
    <PageFrame title="충전">
      <section className="formTable">
        <div className="labelCell">아이디</div>
        <div className="valueCell">{partner?.id ?? "-"}</div>
        <div className="labelCell">입금자명</div>
        <div className="valueCell">{partner?.name ?? "-"}</div>
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
      <button className="primaryAction" type="button">충전 신청</button>
    </PageFrame>
  );
}

function WithdrawPage({ amount, setAmount }) {
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
        <div className="labelCell">환전계좌</div>
        <div className="valueCell strong">고객센터에 문의</div>
      </section>
      <button className="primaryAction" type="button">환전신청하기</button>
      <DataTable
        columns={["ID", "출금은행", "예금주", "계좌번호", "요청금액", "요청일", "완료일", "상태"]}
        rows={mockWithdraws.map((row) => [
          row.id,
          row.bank,
          row.holder,
          row.account,
          row.amount,
          row.requestedAt,
          row.completedAt,
          row.status
        ])}
      />
      <Pagination />
    </PageFrame>
  );
}

function OrdersPage() {
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
      <DataTable
        columns={["ID", "은행", "예금주", "계좌번호", "요청금액", "구매자", "요청일", "상태변경일", "상태"]}
        rows={mockOrders.map((row) => [
          row.id,
          row.bank,
          row.holder,
          row.account,
          row.amount,
          row.buyer,
          row.requestedAt,
          row.changedAt,
          row.status
        ])}
      />
      <Pagination />
    </PageFrame>
  );
}

function SettlementPage() {
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
      <DataTable
        columns={["날짜", "충전", "수수료", "충전(수수료제외)", "환전", "보유금액"]}
        rows={[...settlementRows, ["합계", "50,000,000 원", "300,000 원", "49,700,000 원", "49,700,000 원", ""]]}
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
