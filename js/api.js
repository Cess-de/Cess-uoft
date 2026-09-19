/**
 * CESS — Centralized API Client
 *
 * Single point of contact with the production Google Apps Script
 * Web App. Do not call fetch() directly anywhere else in the app.
 *
 * Backend contract (frozen — see Code.gs):
 *   auth.startActivation
 *   auth.verifyActivationCode
 *   auth.setPassword
 *   auth.setSecurityQuestions
 *   auth.login
 *   auth.refreshSession
 *   auth.getSession
 *   auth.forgotPasswordStart
 *   auth.resetPassword
 *   auth.changeEmail
 *   auth.recoverEmail
 *
 * Response envelope (Utils.gs jsonResponse):
 *   { ok: boolean, data: object|null, error: string|null }
 */
const CESS_API_URL =
  "https://script.google.com/macros/s/AKfycbz3-9MvXuDzpgCUIUWB_F3BzYdM6elJ_ZtcKqiIYiPnIRfEMYzVTSlz4-RKbTRGia1q/exec";
/**
 * Error types the UI layer can branch on.
 * These are inferred client-side; the backend itself only ever
 * returns { ok:false, error: <string> } with no error codes.
 */
const CessApiErrorType = {
  NETWORK: "network",
  SERVER: "server",
  VALIDATION: "validation"
};
class CessApiError extends Error {
  constructor(message, type) {
    super(message);
    this.name = "CessApiError";
    this.type = type || CessApiErrorType.SERVER;
  }
}
/**
 * Low-level POST to the Apps Script Web App.
 * Never add custom headers — Apps Script Web Apps do not need them
 * and nonstandard headers can trigger CORS preflight issues.
 *
 * @param {string} action - one of the IMPLEMENTED_ACTIONS keys
 * @param {object} payload - action-specific fields
 * @returns {Promise<object>} the `data` object from a successful response
 * @throws {CessApiError}
 */
async function cessApiCall(action, payload) {
  if (!action || typeof action !== "string") {
    throw new CessApiError("Missing action.", CessApiErrorType.VALIDATION);
  }
  const params = new URLSearchParams();
  params.set("action", action);
  Object.entries(payload || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    params.set(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value)
    );
  });
  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      response = await fetch(CESS_API_URL, {
        method: "POST",
        body: params,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (networkErr) {
    if (networkErr && networkErr.name === "AbortError") {
      throw new CessApiError(
        "API request timed out after 15 seconds.",
        CessApiErrorType.NETWORK
      );
    }
    throw new CessApiError(
      "Network error. Check your connection and try again.",
      CessApiErrorType.NETWORK
    );
  }
  let json;
  try {
    json = await response.json();
  } catch (parseErr) {
    throw new CessApiError(
      "Unexpected server response.",
      CessApiErrorType.SERVER
    );
  }
  if (
    !json ||
    typeof json !== "object" ||
    typeof json.ok !== "boolean"
  ) {
    throw new CessApiError(
      "Unexpected server response.",
      CessApiErrorType.SERVER
    );
  }
  if (!json.ok) {
    throw new CessApiError(
      json.error || "Request could not be completed.",
      CessApiErrorType.VALIDATION
    );
  }
  return json.data;
}
/**
 * Namespaced, typed wrappers — one per implemented backend action.
 * Pages/components should only ever call through CessApi.*
 */
const CessApi = {
  // ---- Activation ----
  startActivation(studentId, email) {
    return cessApiCall("auth.startActivation", {
      student_id: studentId,
      email
    });
  },
  verifyActivationCode(studentId, code) {
    return cessApiCall("auth.verifyActivationCode", {
      student_id: studentId,
      code
    });
  },
  setPassword(activationToken, password, confirmPassword) {
    return cessApiCall("auth.setPassword", {
      activation_token: activationToken,
      password,
      confirm_password: confirmPassword
    });
  },
  setSecurityQuestions(activationToken, q1Id, a1, q2Id, a2) {
    return cessApiCall("auth.setSecurityQuestions", {
      activation_token: activationToken,
      q1_id: q1Id,
      a1,
      q2_id: q2Id,
      a2
    });
  },
  // ---- Login / session ----
  login(studentId, password) {
    return cessApiCall("auth.login", {
      student_id: studentId,
      password
    });
  },
  refreshSession(token) {
    return cessApiCall("auth.refreshSession", { token });
  },
  getSession(token) {
    return cessApiCall("auth.getSession", { token });
  },
  // ---- Password recovery ----
  forgotPasswordStart(studentId, emailCode) {
    const payload = { student_id: studentId };
    if (emailCode) {
      payload.email_code = emailCode;
    }
    return cessApiCall("auth.forgotPasswordStart", payload);
  },
  resetPassword(
    recoveryToken,
    a1,
    a2,
    newPassword,
    confirmPassword
  ) {
    return cessApiCall("auth.resetPassword", {
      recovery_token: recoveryToken,
      a1,
      a2,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
  },
  // ---- Email management ----
  changeEmail(sessionToken, newEmail, code) {
    const payload = {
      token: sessionToken,
      new_email: newEmail
    };
    if (code) {
      payload.code = code;
    }
    return cessApiCall("auth.changeEmail", payload);
  },
  recoverEmailStart(studentId) {
    return cessApiCall("auth.recoverEmail", {
      student_id: studentId
    });
  },
  recoverEmailVerify(
    studentId,
    emailCode,
    a1,
    a2,
    newEmail
  ) {
    return cessApiCall("auth.recoverEmail", {
      student_id: studentId,
      email_code: emailCode,
      a1,
      a2,
      new_email: newEmail
    });
  },
  recoverEmailComplete(
    recoveryToken,
    newEmail,
    verificationCode
  ) {
    return cessApiCall("auth.recoverEmail", {
      recovery_token: recoveryToken,
      new_email: newEmail,
      verification_code: verificationCode
    });
  }
};
