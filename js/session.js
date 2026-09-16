/**
 * CESS — Session Management
 *
 * Session tokens are opaque signed strings from the backend
 * (Utils.gs signSessionToken / verifySessionToken). The frontend
 * never inspects or trusts their contents — only the backend's
 * verdict via auth.getSession / auth.refreshSession matters.
 *
 * Storage: localStorage. This is a client-side convenience only;
 * the backend remains the sole authority for validity (see
 * Utils.gs requireSession). A stolen token from localStorage is
 * exactly as sensitive as a stolen cookie would be here — there is
 * no httpOnly option available to a static GitHub Pages frontend
 * talking to Apps Script, so this matches the constraint, not an
 * ideal we chose freely.
 */

const CESS_SESSION_KEY = "cess_session_token";
const CESS_MEMBER_KEY = "cess_session_member"; // cached, non-authoritative display info

const CessSession = {
  getToken() {
    return localStorage.getItem(CESS_SESSION_KEY);
  },

  setToken(token) {
    localStorage.setItem(CESS_SESSION_KEY, token);
  },

  clear() {
    localStorage.removeItem(CESS_SESSION_KEY);
    localStorage.removeItem(CESS_MEMBER_KEY);
  },

  getCachedMember() {
    const raw = localStorage.getItem(CESS_MEMBER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },

  setCachedMember(member) {
    localStorage.setItem(CESS_MEMBER_KEY, JSON.stringify(member));
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Validates the current token against the backend and refreshes
   * the cached display info. Call this on any authenticated page
   * load. Never assume a stored token is valid without this check —
   * backend authorization is the actual security boundary.
   *
   * @returns {Promise<object|null>} session info, or null if invalid
   */
  async validate() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const info = await CessApi.getSession(token);
      this.setCachedMember(info);
      return info;
    } catch (err) {
      // Any failure (expired, tampered, revoked) invalidates locally.
      this.clear();
      return null;
    }
  },

  /**
   * Attempts to extend the session's lifetime. Call proactively
   * (e.g. on page focus) rather than waiting for a request to fail,
   * since the backend does not push expiration events.
   */
  async refresh() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const { token: newToken } = await CessApi.refreshSession(token);
      this.setToken(newToken);
      return true;
    } catch (err) {
      this.clear();
      return false;
    }
  },

  logout() {
    this.clear();
  }
};

/**
 * Guards a page that requires authentication. Redirects to login
 * if there is no valid session. Call at the top of authenticated
 * pages (member/admin dashboards) before rendering account data.
 *
 * @param {string} loginPath - relative path to the login page
 * @returns {Promise<object|null>} session info if valid
 */
async function cessRequireAuth(loginPath) {
  const info = await CessSession.validate();
  if (!info) {
    window.location.href = loginPath || "login.html";
    return null;
  }
  return info;
}
