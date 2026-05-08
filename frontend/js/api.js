const API_BASE = "/api";
const TOKEN_KEY = "token";

function normalizeSiteConfigPayload(payload) {
  const config = payload && typeof payload === "object" ? payload : {};
  const sensors = Array.isArray(config.sensors) ? config.sensors : [];
  const codes = Array.isArray(config.codes) ? config.codes : [];
  const quickQuestions = Array.isArray(config.quickQuestions) ? config.quickQuestions : [];
  return {
    sensors: sensors.map((s) => ({
      ...s,
      name: String(s?.name || ""),
      desc: String(s?.desc || ""),
      ico: String(s?.ico || "⚙️"),
      image: String(s?.image || ""),
      lbl: String(s?.lbl || ""),
      note: String(s?.note || ""),
      pins: Array.isArray(s?.pins) ? s.pins : [["PIN", "D2", "pd", "Сипат"]],
    })),
    codes: codes.map((c) => ({
      ...c,
      title: String(c?.title || ""),
      meta: String(c?.meta || ""),
      code: String(c?.code || ""),
    })),
    quickQuestions: quickQuestions.map((q) => ({
      ...q,
      label: String(q?.label || ""),
      prompt: String(q?.prompt || ""),
      answer: String(q?.answer || ""),
      type: q?.type === "error" ? "error" : "quick",
    })),
  };
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function mapApiError(data) {
  if (data?.message) return data.message;
  const fieldErrors = data?.issues?.fieldErrors || {};
  const firstField = Object.keys(fieldErrors).find((key) => Array.isArray(fieldErrors[key]) && fieldErrors[key].length);
  if (firstField) return fieldErrors[firstField][0];
  return "Request failed";
}

async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const nextOptions = { ...options };
  if (path === "/site-config" && typeof nextOptions.body === "string") {
    try {
      const parsed = JSON.parse(nextOptions.body);
      nextOptions.body = JSON.stringify(normalizeSiteConfigPayload(parsed));
    } catch (_e) {
      // Keep original body when it is not a valid JSON string.
    }
  }
  const headers = {
    "Content-Type": "application/json",
    ...(nextOptions.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const method = String(nextOptions.method || "GET").toUpperCase();
  const retries = method === "GET" ? 1 : 0;
  let response;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      response = await fetchWithTimeout(`${API_BASE}${path}`, { ...nextOptions, headers });
      if (response.status >= 500 && attempt < retries) continue;
      break;
    } catch (e) {
      if (attempt >= retries) {
        const timeoutErr = new Error(e?.name === "AbortError" ? "Сұрау уақыты бітті (timeout)" : "Желі қатесі");
        timeoutErr.status = 0;
        timeoutErr.data = {};
        throw timeoutErr;
      }
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(mapApiError(data));
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
