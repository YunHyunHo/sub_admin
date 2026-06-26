"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const MIN_TRANSACTION_AMOUNT = 10000;
const moneyButtons = [10000, 50000, 100000, 500000, 1000000, 5000000];

const navItems = [
  { key: "charge", label: "충전", icon: ArrowDownToLine },
  { key: "withdraw", label: "출금", icon: ArrowUpFromLine },
  { key: "orders", label: "구매내역", icon: CreditCard },
  { key: "settlement", label: "정산내역", icon: CalendarDays }
];

const SESSION_STORAGE_KEY = "winpay_partner_session";
const ACTIVE_MENU_STORAGE_KEY = "winpay_partner_active_menu";
const THEME_STORAGE_KEY = "winpay_partner_theme";
const HISTORY_REFRESH_INTERVAL_MS = 5000;
const NOTICE_SOUND_PATH = "/sounds/notice.mp3";

function getSharedNoticeAudio() {
  if (!window.__winpayNoticeAudio) {
    window.__winpayNoticeAudio = new Audio(NOTICE_SOUND_PATH);
    window.__winpayNoticeAudio.preload = "auto";
  }

  return window.__winpayNoticeAudio;
}

function unlockSharedNoticeSound() {
  if (window.__winpayNoticeSoundUnlocked) {
    return;
  }

  const audio = getSharedNoticeAudio();
  const previousVolume = audio.volume;

  audio.volume = 0;
  audio.play()
    .then(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = previousVolume || 1;
      window.__winpayNoticeSoundUnlocked = true;
    })
    .catch(() => {
      audio.volume = previousVolume || 1;
    });
}

function formatWon(value) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function parseWon(value) {
  return Number(String(value ?? "").replace(/[^0-9]/g, "")) || 0;
}

function floorToTransactionUnit(value) {
  return Math.floor(parseWon(value) / MIN_TRANSACTION_AMOUNT) * MIN_TRANSACTION_AMOUNT;
}

function isValidTransactionAmount(value) {
  const amount = parseWon(value);

  return amount >= MIN_TRANSACTION_AMOUNT && amount % MIN_TRANSACTION_AMOUNT === 0;
}

function formatWonText(value) {
  return `${formatWon(parseWon(value))} 원`;
}

function normalizePagination(pagination, fallbackPage) {
  return {
    page: Math.max(1, Number(pagination?.page) || fallbackPage),
    pageSize: Math.max(1, Number(pagination?.pageSize) || 10),
    total: Math.max(0, Number(pagination?.total) || 0)
  };
}

function getRowsSignature(rows, pagination) {
  return JSON.stringify({
    rows: (rows ?? []).map((row) => [
      row?.id,
      row?.status,
      row?.amount,
      row?.completedAt,
      row?.changedAt
    ]),
    total: Number(pagination?.total) || 0
  });
}

function formatMonthDayTime(value) {
  const text = String(value ?? "").trim();
  const matched = text.match(/^(?:\d{2}|\d{4})-(\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/);

  if (!matched) {
    return text || "-";
  }

  return [matched[1], matched[2]].filter(Boolean).join(" ");
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatShortDate(value) {
  const text = String(value ?? "").trim();
  const matched = text.match(/^(\d{2}|\d{4})-(\d{2})-(\d{2})$/);

  if (!matched) {
    return text;
  }

  return `${matched[1].slice(-2)}-${matched[2]}-${matched[3]}`;
}

function normalizeDateInput(value) {
  const text = String(value ?? "").trim();
  const fullMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (fullMatch) {
    return text;
  }

  const shortMatch = text.match(/^(\d{2})-(\d{2})-(\d{2})$/);

  if (shortMatch) {
    return `20${shortMatch[1]}-${shortMatch[2]}-${shortMatch[3]}`;
  }

  return text;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    from: `${dateParts.year}-${dateParts.month}-01`,
    to: `${dateParts.year}-${dateParts.month}-${dateParts.day}`
  };
}

function getKoreaTodayDateRange() {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

  return {
    from: today,
    to: today
  };
}

function getMillisecondsUntilNextKoreaMidnight() {
  const now = Date.now();
  const koreaNow = new Date(now + 9 * 60 * 60 * 1000);
  const nextMidnight = Date.UTC(
    koreaNow.getUTCFullYear(),
    koreaNow.getUTCMonth(),
    koreaNow.getUTCDate() + 1
  ) - 9 * 60 * 60 * 1000;

  return Math.max(nextMidnight - now + 1000, 1000);
}

function appendDomainParams(params, partner) {
  if (partner?.domainId) {
    params.set("domainId", partner.domainId);
  } else if (partner?.name || partner?.domain) {
    params.set("domainName", partner.domain || partner.name);
  }
}

const inFlightGetRequests = new Map();

class ApiRequestError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

function getJson(url, token, options = {}) {
  const requestKey = `${token ?? ""}:${url}`;

  if (!options.force && inFlightGetRequests.has(requestKey)) {
    return inFlightGetRequests.get(requestKey);
  }

  const request = fetch(url, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })
    .then(async (response) => {
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new ApiRequestError(result?.message ?? "데이터 조회에 실패했습니다.", response.status);
      }

      return result;
    })
    .finally(() => {
      if (inFlightGetRequests.get(requestKey) === request) {
        inFlightGetRequests.delete(requestKey);
      }
    });

  if (!options.force) {
    inFlightGetRequests.set(requestKey, request);
  }

  return request;
}

function createExternalId(type, userId) {
  const safeUserId = (userId || "partner").replace(/[^a-zA-Z0-9_-]/g, "");
  return `domain-${safeUserId}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function postJson(url, payload, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.ok) {
    throw new ApiRequestError(result?.message ?? "요청 처리에 실패했습니다.", response.status);
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
  const [chargePage, setChargePage] = useState(1);
  const [exchangePage, setExchangePage] = useState(1);
  const [chargePagination, setChargePagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [exchangePagination, setExchangePagination] = useState({ page: 1, pageSize: 10, total: 0 });
  const [orderFilters, setOrderFilters] = useState(() => ({
    keyword: "",
    status: "",
    ...getDefaultDateRange()
  }));
  const [settlementRows, setSettlementRows] = useState([]);
  const [settlementTotal, setSettlementTotal] = useState(null);
  const [dailySettlementTotal, setDailySettlementTotal] = useState(null);
  const [pendingExchangeAmount, setPendingExchangeAmount] = useState(0);
  const [pendingSummary, setPendingSummary] = useState({ charge: 0, withdraw: 0 });
  const [historyError, setHistoryError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const historyReadyRef = useRef(false);
  const sessionRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const chargeSignatureRef = useRef("");
  const exchangeSignatureRef = useRef("");
  const sseConnectedRef = useRef(false);
  const chargeStatusRef = useRef(new Map());
  const chargeStatusReadyRef = useRef(false);
  const exchangeStatusRef = useRef(new Map());
  const exchangeStatusReadyRef = useRef(false);
  const approvedChargeNotificationRef = useRef(new Set());
  const approvedExchangeNotificationRef = useRef(new Set());
  const noticeAudioRef = useRef(null);
  const noticeSoundUnlockedRef = useRef(false);
  const noticeRetryTimerRef = useRef(null);
  const partner = session?.partner ?? dashboard?.partner;
  const withdrawAccount = partner?.withdrawAccount ?? {};
  const sessionUserId = session?.user?.loginId ?? "";

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const withdrawBalanceAmount = useMemo(
    () => {
      if (dailySettlementTotal?.balanceAmount != null) {
        return parseWon(dailySettlementTotal.balanceAmount);
      }

      if (dailySettlementTotal?.netChargeAmount != null) {
        return parseWon(dailySettlementTotal.netChargeAmount);
      }

      const chargeAmount = parseWon(dailySettlementTotal?.chargeAmount);
      const feeAmount = parseWon(dailySettlementTotal?.feeAmount);

      return Math.max(chargeAmount - feeAmount, 0);
    },
    [dailySettlementTotal]
  );
  const availableWithdrawAmount = useMemo(
    () => withdrawBalanceAmount,
    [withdrawBalanceAmount]
  );

  const refreshPendingSummary = useCallback(async (options = {}) => {
    if (!loggedIn || !partner) {
      return;
    }

    const baseParams = new URLSearchParams({
      page: "1",
      pageSize: "100",
      status: "PENDING"
    });
    appendDomainParams(baseParams, partner);

    if (!baseParams.has("domainId") && !baseParams.has("domainName")) {
      return;
    }

    const chargeParams = new URLSearchParams(baseParams);
    const exchangeParams = new URLSearchParams(baseParams);
    const [pendingCharges, firstPendingExchanges] = await Promise.all([
      authGetJson(`/api/integration/charge-requests?${chargeParams.toString()}`, options),
      authGetJson(`/api/integration/domain-exchanges?${exchangeParams.toString()}`, options)
    ]);

    const exchangePageSize = normalizePagination(firstPendingExchanges.pagination, 1).pageSize;
    const exchangeTotal = normalizePagination(firstPendingExchanges.pagination, 1).total;
    let pendingExchangeItems = firstPendingExchanges.items ?? [];

    for (
      let nextPage = 2;
      (nextPage - 1) * exchangePageSize < exchangeTotal;
      nextPage += 1
    ) {
      const nextExchangeParams = new URLSearchParams(exchangeParams);
      nextExchangeParams.set("page", String(nextPage));
      const nextPendingExchanges = await authGetJson(
        `/api/integration/domain-exchanges?${nextExchangeParams.toString()}`,
        options
      );
      pendingExchangeItems = pendingExchangeItems.concat(nextPendingExchanges.items ?? []);
    }

    setPendingSummary({
      charge: normalizePagination(pendingCharges.pagination, 1).total,
      withdraw: exchangeTotal
    });
    setPendingExchangeAmount(
      pendingExchangeItems.reduce((sum, row) => sum + parseWon(row?.amount), 0)
    );
  }, [
    loggedIn,
    partner?.domainId,
    partner?.domain,
    partner?.name,
    session?.token
  ]);

  const refreshSettlementData = useCallback(async (options = {}) => {
    if (!loggedIn || !partner) {
      return;
    }

    const range = getDefaultDateRange();
    const todayRange = getKoreaTodayDateRange();
    const settlementParams = new URLSearchParams({ from: range.from, to: range.to });
    appendDomainParams(settlementParams, partner);

    if (!settlementParams.has("domainId") && !settlementParams.has("domainName")) {
      return;
    }

    const dailySettlementParams = new URLSearchParams(settlementParams);
    dailySettlementParams.set("from", todayRange.from);
    dailySettlementParams.set("to", todayRange.to);

    try {
      const [settlements, dailySettlements] = await Promise.all([
        authGetJson(
          `/api/integration/domain-settlements?${settlementParams.toString()}`,
          options
        ),
        authGetJson(
          `/api/integration/domain-settlements?${dailySettlementParams.toString()}`,
          options
        )
      ]);

      setSettlementRows(settlements.items ?? []);
      setSettlementTotal(settlements.total ?? null);
      setDailySettlementTotal(dailySettlements.total ?? null);
      setHistoryError("");
    } catch (error) {
      setHistoryError(error.message);
    }
  }, [
    loggedIn,
    partner?.domainId,
    partner?.domain,
    partner?.name,
    session?.token
  ]);

  useEffect(() => {
    if (!loggedIn || !partner) {
      return;
    }

    let stopped = false;
    let timer = null;

    function scheduleMidnightRefresh() {
      timer = window.setTimeout(async () => {
        if (stopped) {
          return;
        }

        setOrderFilters((current) => ({
          ...current,
          ...getDefaultDateRange()
        }));
        setChargePage(1);
        await refreshSettlementData();
        scheduleMidnightRefresh();
      }, getMillisecondsUntilNextKoreaMidnight());
    }

    scheduleMidnightRefresh();

    return () => {
      stopped = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [loggedIn, partner, refreshSettlementData]);

  const loadChargePage = useCallback(async (page, options = {}) => {
    if (!loggedIn || !partner) {
      return;
    }

    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      from: orderFilters.from,
      to: orderFilters.to
    });

    if (orderFilters.status) {
      params.set("status", orderFilters.status);
    }

    if (orderFilters.keyword.trim()) {
      params.set("keyword", orderFilters.keyword.trim());
    }

    appendDomainParams(params, partner);

    const charges = await authGetJson(
      `/api/integration/charge-requests?${params.toString()}`,
      options
    );
    const pagination = normalizePagination(charges.pagination, page);
    const rows = charges.items ?? [];

    chargeSignatureRef.current = getRowsSignature(rows, pagination);
    setChargeRequests(rows);
    setChargePagination(pagination);
    notifyChargeStatusChanges(rows);
    setHistoryError("");
  }, [
    loggedIn,
    orderFilters.from,
    orderFilters.keyword,
    orderFilters.status,
    orderFilters.to,
    partner?.domainId,
    partner?.domain,
    partner?.name,
    session?.token
  ]);

  const loadExchangePage = useCallback(async (page, options = {}) => {
    if (!loggedIn || !partner) {
      return;
    }

    const range = getDefaultDateRange();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "10",
      from: range.from,
      to: range.to
    });
    appendDomainParams(params, partner);

    const exchanges = await authGetJson(
      `/api/integration/domain-exchanges?${params.toString()}`,
      options
    );
    const pagination = normalizePagination(exchanges.pagination, page);
    const rows = exchanges.items ?? [];

    exchangeSignatureRef.current = getRowsSignature(rows, pagination);
    setDomainExchangeRequests(rows);
    setExchangePagination(pagination);
    notifyExchangeStatusChanges(rows);
    setHistoryError("");
  }, [
    loggedIn,
    partner?.domainId,
    partner?.domain,
    partner?.name,
    session?.token
  ]);

  const logout = useCallback(() => {
    const currentSession = sessionRef.current;

    if (currentSession?.token || currentSession?.refreshToken) {
      void fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentSession.token ? { Authorization: `Bearer ${currentSession.token}` } : {})
        },
        body: JSON.stringify({ refreshToken: currentSession.refreshToken })
      }).catch(() => {});
    }

    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    window.localStorage.removeItem(ACTIVE_MENU_STORAGE_KEY);
    sessionRef.current = null;
    setSession(null);
    setLoggedIn(false);
    setActive("charge");
  }, []);

  function saveSession(nextSession) {
    sessionRef.current = nextSession;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    setSession(nextSession);
    setLoggedIn(true);
  }

  function clearSession() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionRef.current = null;
    setSession(null);
    setLoggedIn(false);
    setActive("charge");
  }

  async function refreshSessionToken() {
    const currentSession = sessionRef.current;

    if (!currentSession?.refreshToken) {
      throw new Error("refreshToken이 없습니다.");
    }

    if (!refreshPromiseRef.current) {
      refreshPromiseRef.current = fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken: currentSession.refreshToken })
      })
        .then(async (response) => {
          const result = await response.json().catch(() => null);

          if (!response.ok || !result?.ok || !result?.token) {
            throw new Error(result?.message ?? "로그인 토큰 갱신에 실패했습니다.");
          }

          const nextSession = {
            ...currentSession,
            ...result,
            user: result.user ?? currentSession.user,
            partner: result.partner ?? currentSession.partner,
            refreshToken: result.refreshToken ?? currentSession.refreshToken
          };

          saveSession(nextSession);

          return nextSession;
        })
        .finally(() => {
          refreshPromiseRef.current = null;
        });
    }

    return refreshPromiseRef.current;
  }

  async function authGetJson(url, options = {}) {
    try {
      return await getJson(url, sessionRef.current?.token, options);
    } catch (error) {
      if (!sessionRef.current?.refreshToken || error.status !== 401) {
        throw error;
      }

      const refreshedSession = await refreshSessionToken().catch((refreshError) => {
        clearSession();
        throw refreshError;
      });

      return getJson(url, refreshedSession.token, { ...options, force: true });
    }
  }

  async function authPostJson(url, payload) {
    try {
      return await postJson(url, payload, sessionRef.current?.token);
    } catch (error) {
      if (!sessionRef.current?.refreshToken || error.status !== 401) {
        throw error;
      }

      await refreshSessionToken().catch((refreshError) => {
        clearSession();
        throw refreshError;
      });

      throw new ApiRequestError(
        "로그인 정보가 갱신되었습니다. 다시 신청해주세요.",
        401
      );
    }
  }

  function updateOrderFilter(key, value) {
    setOrderFilters((current) => ({
      ...current,
      [key]: key === "from" || key === "to" ? normalizeDateInput(value) : value
    }));
  }

  function searchOrders() {
    if (chargePage !== 1) {
      setChargePage(1);
      return;
    }

    loadChargePage(1, { force: true }).catch((error) => setHistoryError(error.message));
  }

  function resetOrderFilters() {
    setOrderFilters({
      keyword: "",
      status: "",
      ...getDefaultDateRange()
    });
    setChargePage(1);
  }

  function handleThemeChange(nextDark) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextDark ? "dark" : "light");
    setDark(nextDark);
  }

  function getNoticeAudio() {
    if (!noticeAudioRef.current) {
      noticeAudioRef.current = getSharedNoticeAudio();
    }

    return noticeAudioRef.current;
  }

  function unlockNoticeSound() {
    if (noticeSoundUnlockedRef.current || window.__winpayNoticeSoundUnlocked) {
      return;
    }

    unlockSharedNoticeSound();
    noticeSoundUnlockedRef.current = Boolean(window.__winpayNoticeSoundUnlocked);
  }

  function playNoticeSound(attempt = 0) {
    const audio = getNoticeAudio();

    audio.muted = false;
    audio.volume = 1;
    audio.currentTime = 0;
    audio.play()
      .then(() => {
        if (noticeRetryTimerRef.current) {
          window.clearTimeout(noticeRetryTimerRef.current);
          noticeRetryTimerRef.current = null;
        }
      })
      .catch(() => {
        console.warn("[exchange-notice] 알림음 재생 재시도", { attempt: attempt + 1 });
        if (attempt >= 5) {
          return;
        }

        noticeRetryTimerRef.current = window.setTimeout(
          () => playNoticeSound(attempt + 1),
          1000
        );
      });
  }

  function playExchangeApprovalSound() {
    playNoticeSound();
  }

  function notifyApprovedExchange(row) {
    if (!row?.id) {
      playExchangeApprovalSound();
      return;
    }

    if (approvedExchangeNotificationRef.current.has(row.id)) {
      return;
    }

    approvedExchangeNotificationRef.current.add(row.id);
    exchangeStatusRef.current.set(row.id, "APPROVED");
    playExchangeApprovalSound();
  }

  function notifyApprovedCharge(row) {
    if (!row?.id || approvedChargeNotificationRef.current.has(row.id)) {
      return;
    }

    approvedChargeNotificationRef.current.add(row.id);
    chargeStatusRef.current.set(row.id, "APPROVED");
    playNoticeSound();
  }

  function notifyChargeStatusChanges(rows) {
    const previousStatuses = chargeStatusRef.current;
    const nextStatuses = new Map(previousStatuses);
    const changedRows = [];

    rows.forEach((row) => {
      if (!row?.id || !row?.status) {
        return;
      }

      const previousStatus = previousStatuses.get(row.id);

      if (
        chargeStatusReadyRef.current &&
        previousStatus === "PENDING" &&
        row.status === "APPROVED"
      ) {
        changedRows.push(row);
      }

      nextStatuses.set(row.id, row.status);
    });

    chargeStatusRef.current = nextStatuses;
    chargeStatusReadyRef.current = true;
    changedRows.forEach(notifyApprovedCharge);
  }

  function notifyExchangeStatusChanges(rows) {
    const previousStatuses = exchangeStatusRef.current;
    const nextStatuses = new Map();
    const changedRows = [];

    rows.forEach((row) => {
      if (!row?.id || !row?.status) {
        return;
      }

      const previousStatus = previousStatuses.get(row.id);

      if (
        exchangeStatusReadyRef.current &&
        previousStatus === "PENDING" &&
        row.status === "APPROVED"
      ) {
        changedRows.push(row);
      }

      nextStatuses.set(row.id, row.status);
    });

    exchangeStatusRef.current = nextStatuses;
    exchangeStatusReadyRef.current = true;
    changedRows.forEach(notifyApprovedExchange);
  }

  useEffect(() => {
    fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setDashboard)
      .catch(() => setDashboard(null));
  }, []);

  useEffect(() => {
    historyReadyRef.current = false;
    chargeSignatureRef.current = "";
    exchangeSignatureRef.current = "";
    sseConnectedRef.current = false;
    chargeStatusRef.current = new Map();
    chargeStatusReadyRef.current = false;
    exchangeStatusRef.current = new Map();
    exchangeStatusReadyRef.current = false;
    approvedChargeNotificationRef.current = new Set();
    approvedExchangeNotificationRef.current = new Set();
    setPendingExchangeAmount(0);
    setPendingSummary({ charge: 0, withdraw: 0 });
  }, [loggedIn, partner?.domainId, partner?.domain]);

  useEffect(() => {
    return () => {
      if (noticeRetryTimerRef.current) {
        window.clearTimeout(noticeRetryTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!loggedIn || !partner?.domainId || typeof EventSource === "undefined") {
      return;
    }

    const eventsUrl = `https://laylow.me/api/integration/domain-events?domainId=${encodeURIComponent(partner.domainId)}`;
    const events = new EventSource(eventsUrl);

    function handleOpen() {
      sseConnectedRef.current = true;
      console.info("[domain-events] 연결됨", { domainId: partner.domainId });
    }

    function handleError() {
      sseConnectedRef.current = false;
      console.warn("[domain-events] 연결 끊김", {
        domainId: partner.domainId
      });
    }

    function refreshServerState() {
      const forceRefresh = { force: true };

      return Promise.allSettled([
        loadChargePage(chargePage, forceRefresh),
        loadExchangePage(exchangePage, forceRefresh),
        refreshPendingSummary(forceRefresh),
        refreshSettlementData(forceRefresh)
      ]);
    }

    function handleDomainEvent(event) {
      try {
        const data = JSON.parse(event.data);

        if (data?.id) {
          if (event.type === "charge-request-approved") {
            notifyApprovedCharge({
              id: data.id,
              amount: data.amount,
              status: data.status ?? "APPROVED",
              changedAt: data.updatedAt ?? data.changedAt
            });
          }

          if (event.type === "domain-exchange-approved") {
            notifyApprovedExchange({
              id: data.id,
              domainId: data.domainId,
              amount: data.amount,
              status: data.status ?? "APPROVED",
              completedAt: data.updatedAt ?? data.changedAt ?? data.approvedAt
            });
          }
        }

        void refreshServerState();
      } catch {
        // Ignore malformed events. The next server-driven refresh will reconcile state.
      }
    }

    const eventNames = [
      "charge-request-created",
      "charge-request-approved",
      "charge-request-rejected",
      "domain-exchange-created",
      "domain-exchange-approved",
      "domain-exchange-rejected",
      "domain-balance-updated"
    ];

    events.onopen = handleOpen;
    events.onerror = handleError;
    eventNames.forEach((eventName) => {
      events.addEventListener(eventName, handleDomainEvent);
    });

    return () => {
      sseConnectedRef.current = false;
      events.onopen = null;
      events.onerror = null;
      eventNames.forEach((eventName) => {
        events.removeEventListener(eventName, handleDomainEvent);
      });
      events.close();
    };
  }, [
    chargePage,
    loadChargePage,
    exchangePage,
    loadExchangePage,
    loggedIn,
    partner?.domainId,
    refreshPendingSummary,
    refreshSettlementData
  ]);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const savedActiveMenu = window.localStorage.getItem(ACTIVE_MENU_STORAGE_KEY);
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

    if (savedTheme === "light") {
      setDark(false);
    }

    if (navItems.some((item) => item.key === savedActiveMenu)) {
      setActive(savedActiveMenu);
    }

    if (!savedSession) {
      return;
    }

    try {
      const parsedSession = JSON.parse(savedSession);
      sessionRef.current = parsedSession;

      if (parsedSession.refreshToken) {
        refreshSessionToken().catch(() => {
          clearSession();
        });
        return;
      }

      setSession(parsedSession);
      setLoggedIn(true);
    } catch {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_MENU_STORAGE_KEY, active);
  }, [active]);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    function unlockSoundFromUserAction() {
      unlockNoticeSound();
    }

    const activityEvents = ["click", "keydown", "touchstart"];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, unlockSoundFromUserAction, { passive: true });
    });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, unlockSoundFromUserAction);
      });
    };
  }, [loggedIn]);

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
      const chargeAmount = parseWon(dailySettlementTotal?.chargeAmount);
      const feeAmount = parseWon(dailySettlementTotal?.feeAmount);
      const dailyExchangeAmount = parseWon(dailySettlementTotal?.exchangeAmount);

      return [
        ["입금", formatWon(chargeAmount)],
        ["수수료", formatWon(feeAmount)],
        ["환전", formatWon(dailyExchangeAmount)],
        ["잔고", formatWon(availableWithdrawAmount)],
        ["환전액", formatWon(dailyExchangeAmount)]
      ];
    },
    [availableWithdrawAmount, dailySettlementTotal]
  );

  const waitingSummary = useMemo(
    () => pendingSummary,
    [pendingSummary]
  );

  useEffect(() => {
    if (!loggedIn || !partner) {
      return;
    }

    let cancelled = false;
    let retryTimer = null;

    async function loadInitialHistoryData() {
      const range = getDefaultDateRange();
      const todayRange = getKoreaTodayDateRange();
      const baseParams = new URLSearchParams({
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
        const chargeParams = new URLSearchParams(baseParams);
        chargeParams.set("page", String(chargePage));
        chargeParams.set("from", orderFilters.from);
        chargeParams.set("to", orderFilters.to);
        if (orderFilters.status) {
          chargeParams.set("status", orderFilters.status);
        }
        if (orderFilters.keyword.trim()) {
          chargeParams.set("keyword", orderFilters.keyword.trim());
        }
        const exchangeParams = new URLSearchParams(baseParams);
        exchangeParams.set("page", String(exchangePage));
        const settlementParams = new URLSearchParams(baseParams);
        settlementParams.delete("pageSize");
        const dailySettlementParams = new URLSearchParams(settlementParams);
        dailySettlementParams.set("from", todayRange.from);
        dailySettlementParams.set("to", todayRange.to);
        const [charges, exchanges, settlements, dailySettlements] = await Promise.all([
          authGetJson(`/api/integration/charge-requests?${chargeParams.toString()}`),
          authGetJson(`/api/integration/domain-exchanges?${exchangeParams.toString()}`),
          authGetJson(`/api/integration/domain-settlements?${settlementParams.toString()}`),
          authGetJson(`/api/integration/domain-settlements?${dailySettlementParams.toString()}`)
        ]);

        const exchangeItems = exchanges.items ?? [];

        const nextChargePagination = normalizePagination(charges.pagination, chargePage);
        const nextExchangePagination = normalizePagination(exchanges.pagination, exchangePage);
        const chargeTotalPages = Math.max(
          1,
          Math.ceil(nextChargePagination.total / nextChargePagination.pageSize)
        );
        const exchangeTotalPages = Math.max(
          1,
          Math.ceil(nextExchangePagination.total / nextExchangePagination.pageSize)
        );

        if (cancelled) {
          return;
        }

        const chargeItems = charges.items ?? [];
        setChargeRequests(chargeItems);
        setChargePagination(nextChargePagination);
        setDomainExchangeRequests(exchangeItems);
        setExchangePagination(nextExchangePagination);
        if (chargePage > chargeTotalPages) {
          setChargePage(chargeTotalPages);
        }
        if (exchangePage > exchangeTotalPages) {
          setExchangePage(exchangeTotalPages);
        }
        chargeSignatureRef.current = getRowsSignature(chargeItems, nextChargePagination);
        exchangeSignatureRef.current = getRowsSignature(exchangeItems, nextExchangePagination);
        notifyChargeStatusChanges(chargeItems);
        notifyExchangeStatusChanges(exchangeItems);
        setSettlementRows(settlements.items ?? []);
        setSettlementTotal(settlements.total ?? null);
        setDailySettlementTotal(dailySettlements.total ?? null);
        await refreshPendingSummary();
        historyReadyRef.current = true;
      } catch (error) {
        if (!cancelled) {
          setHistoryError(error.message);
          retryTimer = window.setTimeout(loadInitialHistoryData, HISTORY_REFRESH_INTERVAL_MS);
        }
      }
    }

    loadInitialHistoryData();

    return () => {
      cancelled = true;
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    loggedIn,
    orderFilters.from,
    orderFilters.keyword,
    orderFilters.status,
    orderFilters.to,
    partner?.domainId,
    partner?.domain,
    partner?.name,
    refreshPendingSummary,
    session?.token
  ]);

  useEffect(() => {
    if (!loggedIn || !partner || !historyReadyRef.current) {
      return;
    }

    loadChargePage(chargePage).catch((error) => setHistoryError(error.message));
  }, [chargePage, loadChargePage, loggedIn, partner?.domainId, partner?.domain]);

  useEffect(() => {
    if (!loggedIn || !partner || !historyReadyRef.current) {
      return;
    }

    loadExchangePage(exchangePage).catch((error) => setHistoryError(error.message));
  }, [exchangePage, loadExchangePage, loggedIn, partner?.domainId, partner?.domain]);

  if (!loggedIn) {
    return <LoginScreen onLogin={(result) => {
      saveSession(result);
    }} />;
  }

  async function handleChargeSubmit() {
    if (chargeSubmitting) {
      return;
    }

    setChargeStatus(null);
    setChargeSubmitting(true);

    const amount = parseWon(chargeAmount);

    if (!isValidTransactionAmount(amount)) {
      setChargeStatus({
        type: "error",
        message: "충전 금액은 1만원 이상, 1만원 단위로 입력해주세요."
      });
      setChargeSubmitting(false);
      return;
    }

    try {
      const result = await authPostJson("/api/integration/charge-requests", {
        externalId: createExternalId("charge", chargeUserId || sessionUserId),
        partner,
        userId: chargeUserId || sessionUserId,
        depositorName: chargeDepositor,
        amount
      });
      setChargeStatus({
        type: "success",
        message: result.message ?? "충전신청이 관리자에 전송되었습니다."
      });
      setChargeUserId("");
      setChargeDepositor("");
      setChargeAmount("");
      if (chargePage !== 1) {
        setChargePage(1);
      }
      await Promise.all([
        loadChargePage(1),
        refreshPendingSummary(),
        refreshSettlementData()
      ]);
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

    const requestedAmount = parseWon(withdrawAmount);
    const maxWithdrawAmount = parseWon(availableWithdrawAmount);
    const amount = Math.min(requestedAmount, maxWithdrawAmount);

    if (requestedAmount !== amount) {
      setWithdrawAmount(amount ? String(amount) : "");
    }

    if (amount <= 0) {
      setWithdrawStatus({
        type: "error",
        message: "환전 금액을 입력해주세요."
      });
      return;
    }

    try {
      const result = await authPostJson("/api/integration/domain-exchanges", {
        externalId: createExternalId("exchange", sessionUserId),
        partner,
        userId: sessionUserId,
        amount,
        bankName: withdrawBank,
        accountHolder: withdrawAccountHolder,
        accountNumber: withdrawAccountNumber
      });
      setWithdrawStatus({
        type: "success",
        message: result.message ?? "환전신청이 관리자에 전송되었습니다."
      });
      setWithdrawAmount("");
      setWithdrawBank("");
      setWithdrawAccountHolder("");
      setWithdrawAccountNumber("");
      if (exchangePage !== 1) {
        setExchangePage(1);
      }
      await Promise.all([
        loadExchangePage(1),
        refreshPendingSummary(),
        refreshSettlementData()
      ]);
    } catch (error) {
      setWithdrawStatus({
        type: "error",
        message: error.message
      });
    }
  }

  return (
    <main
      className={dark ? "shell dark" : "shell light"}
      onKeyDownCapture={unlockNoticeSound}
      onPointerDownCapture={unlockNoticeSound}
    >
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
            <span>충전 {formatWon(waitingSummary.charge)}</span>
            <span>출금 {formatWon(waitingSummary.withdraw)}</span>
          </div>
        </section>

        <div className="sideFooter">
          <Toggle label="다크 / 라이트" checked={dark} onChange={handleThemeChange} icons={[Moon, Sun]} />
          <span className="timeLabel">한국시간</span>
          <time>{koreaTime}</time>
          <span>Version {dashboard?.partner?.version ?? "01.30"}</span>
          <div className="footerLinks">
            <button type="button">
              <Contact size={15} />
              Contact Us
            </button>
            <button
              onClick={logout}
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
            amount={withdrawAmount}
            availableAmount={availableWithdrawAmount}
            page={exchangePage}
            pagination={exchangePagination}
            rows={domainExchangeRequests}
            status={withdrawStatus}
            setAmount={setWithdrawAmount}
            setPage={setExchangePage}
            withdrawAccount={withdrawAccount}
            onSubmit={handleWithdrawSubmit}
          />
        )}
        {active === "orders" && (
          <OrdersPage
            error={historyError}
            filters={orderFilters}
            onFilterChange={updateOrderFilter}
            onReset={resetOrderFilters}
            onSearch={searchOrders}
            page={chargePage}
            pagination={chargePagination}
            rows={chargeRequests}
            setPage={setChargePage}
          />
        )}
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
    unlockSharedNoticeSound();
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

function AmountButtons({ allAmount = 0, onPick, includeAll }) {
  return (
    <div className="amountButtons">
      {moneyButtons.map((value) => (
        <button key={value} onClick={() => onPick(value, "add")} type="button">
          {value / 10000}만원
        </button>
      ))}
      {includeAll && (
        <button onClick={() => onPick(allAmount, "all")} type="button">
          전액
        </button>
      )}
      <button className="soft" onClick={() => onPick(0, "reset")} type="button">
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
  function handleAmountPick(value, action) {
    if (action === "reset") {
      setAmount("");
      return;
    }

    const nextAmount = floorToTransactionUnit(amount) + value;

    setAmount(nextAmount ? String(nextAmount) : "");
  }

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
          <AmountButtons onPick={handleAmountPick} />
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
  amount,
  availableAmount,
  page,
  pagination,
  rows,
  status,
  setAmount,
  setPage,
  withdrawAccount,
  onSubmit
}) {
  function setLimitedAmount(value) {
    const nextAmount = Math.min(parseWon(value), parseWon(availableAmount));

    setAmount(nextAmount ? String(nextAmount) : "");
  }

  function handleAmountPick(value, action) {
    if (action === "reset") {
      setAmount("");
      return;
    }

    if (action === "all") {
      setLimitedAmount(value);
      return;
    }

    setLimitedAmount(parseWon(amount) + value);
  }

  const accountSummary = [
    withdrawAccount?.bankName,
    withdrawAccount?.accountHolder,
    withdrawAccount?.accountNumber
  ].filter(Boolean).join(" / ");

  return (
    <PageFrame title="출금">
      <section className="formTable">
        <div className="labelCell">보유금액</div>
        <div className="valueCell strong">₩ {formatWon(availableAmount)}</div>
        <div className="labelCell">환전금액</div>
        <div className="valueCell moneyInput">
          <span>₩</span>
          <input
            inputMode="numeric"
            onChange={(event) => setLimitedAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="환전 금액 입력"
            value={amount ? formatWon(parseWon(amount)) : ""}
          />
          <AmountButtons
            allAmount={availableAmount}
            includeAll
            onPick={handleAmountPick}
          />
        </div>
        <div className="labelCell">신청계좌</div>
        <div className={accountSummary ? "valueCell strong" : "valueCell"}>
          {accountSummary || "관리자 설정 계좌를 확인할 수 없습니다."}
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
      <Pagination onPageChange={setPage} page={page} pagination={pagination} />
    </PageFrame>
  );
}

function FormNotice({ status }) {
  if (!status) {
    return null;
  }

  return <p className={`formNotice ${status.type}`}>{status.message}</p>;
}

function OrdersPage({ error, filters, onFilterChange, onReset, onSearch, page, pagination, rows, setPage }) {
  const keyword = filters.keyword.trim().toLowerCase();
  const filteredRows = keyword
    ? rows.filter((row) => [
      row.id,
      row.bankName,
      row.depositorName,
      row.accountNumber,
      row.amount,
      row.buyer,
      row.requestedAt,
      row.changedAt,
      formatStatus(row.status)
    ].some((value) => String(value ?? "").toLowerCase().includes(keyword)))
    : rows;

  return (
    <PageFrame title="구매내역">
      <div className="toolbar">
        <strong>조건선택</strong>
        <SelectButton label="충전" />
        <SelectButton
          label="상태"
          onChange={(event) => onFilterChange("status", event.target.value)}
          options={[
            { label: "전체", value: "" },
            { label: "대기", value: "PENDING" },
            { label: "승인", value: "APPROVED" },
            { label: "거절", value: "REJECTED" }
          ]}
          value={filters.status}
        />
        <div className="toolbarSpacer" />
        <label className="searchBox">
          <Search size={17} />
          <input
            onChange={(event) => onFilterChange("keyword", event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder="구매자 입력"
            value={filters.keyword}
          />
        </label>
        <DateInput onChange={(event) => onFilterChange("from", event.target.value)} value={formatShortDate(filters.from)} />
        <span className="dash">-</span>
        <DateInput onChange={(event) => onFilterChange("to", event.target.value)} value={formatShortDate(filters.to)} />
        <button className="toolbarBtn" onClick={onSearch} type="button">검색</button>
        <button className="toolbarBtn muted" onClick={onReset} type="button">
          <RefreshCcw size={16} />
          초기화
        </button>
      </div>
      <FormNotice status={error ? { type: "error", message: error } : null} />
      <DataTable
        columns={["ID", "은행", "예금주", "계좌번호", "요청금액", "구매자", "요청일", "상태변경일", "상태"]}
        highlightColumns={[2, 3, 4]}
        rows={filteredRows.map((row) => [
          row.id ? String(row.id).slice(0, 5) : "-",
          row.bankName ?? "-",
          row.depositorName ?? "-",
          row.accountNumber ?? "-",
          formatWonText(row.amount),
          row.buyer ?? "-",
          formatMonthDayTime(row.requestedAt),
          formatMonthDayTime(row.changedAt),
          formatStatus(row.status)
        ])}
        variant="orders"
      />
      <Pagination onPageChange={setPage} page={page} pagination={pagination} />
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

function SelectButton({ label, onChange, options, value }) {
  if (options) {
    return (
      <label className="selectBtn selectField">
        <span className="srOnly">{label}</span>
        <select onChange={onChange} value={value}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown size={16} />
      </label>
    );
  }

  return (
    <button className="selectBtn" type="button">
      {label}
      <ChevronDown size={16} />
    </button>
  );
}

function DateInput({ onChange, value }) {
  return (
    <label className="dateInput">
      <CalendarDays size={16} />
      <input onChange={onChange} readOnly={!onChange} value={value} />
    </label>
  );
}

function DataTable({ columns, rows, highlightColumns = [], variant = "" }) {
  return (
    <div className={`tableWrap ${variant ? `${variant}Table` : ""}`}>
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
                <td
                  className={[
                    cell === "승인" ? "statusCell approved" : "",
                    cell === "거절" ? "statusCell rejected" : "",
                    highlightColumns.includes(cellIndex) ? "highlightCell" : ""
                  ].filter(Boolean).join(" ")}
                  key={`${cell}-${cellIndex}`}
                  title={String(cell)}
                >
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

function Pagination({ onPageChange, page, pagination }) {
  const pageSize = Math.max(1, Number(pagination?.pageSize) || 10);
  const total = Math.max(0, Number(pagination?.total) || 0);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const visiblePages = Array.from(
    { length: Math.min(5, totalPages) },
    (_, index) => firstVisiblePage + index
  );

  function moveTo(nextPage) {
    const safePage = Math.min(Math.max(1, nextPage), totalPages);

    if (safePage !== currentPage) {
      onPageChange(safePage);
    }
  }

  return (
    <div className="pagination">
      <button aria-label="첫 페이지" disabled={currentPage === 1} onClick={() => moveTo(1)} title="첫 페이지" type="button">
        <ChevronsLeft size={16} />
      </button>
      <button aria-label="이전 페이지" disabled={currentPage === 1} onClick={() => moveTo(currentPage - 1)} title="이전 페이지" type="button">‹</button>
      {visiblePages.map((pageNumber) => (
        <button
          className={pageNumber === currentPage ? "active" : ""}
          key={pageNumber}
          onClick={() => moveTo(pageNumber)}
          type="button"
        >
          {pageNumber}
        </button>
      ))}
      <button aria-label="다음 페이지" disabled={currentPage === totalPages} onClick={() => moveTo(currentPage + 1)} title="다음 페이지" type="button">›</button>
      <button aria-label="마지막 페이지" disabled={currentPage === totalPages} onClick={() => moveTo(totalPages)} title="마지막 페이지" type="button">
        <ChevronsRight size={16} />
      </button>
    </div>
  );
}
