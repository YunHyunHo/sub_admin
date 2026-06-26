export const AUTH_API_URL = process.env.AUTH_API_URL ?? "https://laylow.me/partner/auth/login";
export const AUTH_API_KEY = process.env.AUTH_API_KEY;

export function buildAuthEndpoint(path) {
  return new URL(path, AUTH_API_URL).toString();
}

export function getAuthHeaders(extraHeaders = {}) {
  return {
    "Content-Type": "application/json",
    ...(AUTH_API_KEY ? { Authorization: `Bearer ${AUTH_API_KEY}` } : {}),
    ...extraHeaders
  };
}
