/**
 * CESS — Authentication Flow Controllers
 *
 * Each controller manages one screen's form state (idle, loading,
 * success, error), talks only through CessApi, and never persists
 * passwords or security answers beyond the single submit that needs
 * them (they live only in local JS variables tied to the DOM form,
 * never localStorage/sessionStorage, and are discarded on submit).
 */

/* =========================================================
 * SHARED FORM HELPERS
 * ========================================================= */

function cessSetFieldError(fieldEl, message) {
  const errorEl = fieldEl.parentElement.querySelector(".field-error");
  const input = fieldEl.querySelector(".input") || fieldEl;
  if (errorEl) {
    errorEl.textContent = message || "";
    errorEl.classList.toggle("is-visible", !!message);
  }
  if (input && input.setAttribute) {
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
}

function cessClearFieldErrors(formEl) {
  formEl.querySelectorAll(".field").forEach((f) => cessSetFieldError(f, ""));
}

function cessShowAlert(container, message, kind) {
  if (!container) return;
  container.innerHTML = "";
  if (!message) return;
  const div = document.createElement("div");
  div.className = `alert alert--${kind || "error"}`;
  div.setAttribute("role", kind === "error" ? "alert" : "status");
  div.textContent = message;
  container.appendChild(div);
}

function cessSetLoading(button, isLoading, loadingLabel, idleLabel) {
  if (!button) return;
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? `<span class="spinner" aria-hidden="true"></span><span>${loadingLabel}</span>`
    : idleLabel;
}

function cessWirePasswordToggle(toggleBtn, inputEl) {
  if (!toggleBtn || !inputEl) return;
  toggleBtn.addEventListener("click", () => {
    const isPassword = inputEl.getAttribute("type") === "password";
    inputEl.setAttribute("type", isPassword ? "text" : "password");
    toggleBtn.setAttribute("aria-pressed", String(isPassword));
    toggleBtn.textContent = isPassword
      ? (CessI18n.isRtl() ? "إخفاء" : "Hide")
      : (CessI18n.isRtl() ? "إظهار" : "Show");
  });
}

/**
 * Wraps a submit handler with submit-lock + duplicate-prevention.
 * Only one in-flight submission per form at a time.
 */
function cessGuardedSubmit(formEl, handler) {
  let inFlight = false;
  formEl.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (inFlight) return;
    inFlight = true;
    try {
      await handler(e);
    } finally {
      inFlight = false;
    }
  });
}

/* =========================================================
 * LOGIN
 * ========================================================= */

function initLoginForm() {
  const form = document.querySelector("[data-login-form]");
  if (!form) return;

  const alertBox = form.querySelector("[data-form-alert]");
  const submitBtn = form.querySelector("[data-submit]");
  const idleLabel = submitBtn.innerHTML;

  const pwField = form.querySelector("[data-password-field]");
  cessWirePasswordToggle(
    form.querySelector("[data-password-toggle]"),
    pwField
  );

  cessGuardedSubmit(form, async () => {
    cessClearFieldErrors(form);
    cessShowAlert(alertBox, "");

    const studentId = form.student_id.value.trim();
    const password = form.password.value;

    if (!studentId) {
      cessSetFieldError(form.querySelector("[data-field='student_id']"),
        CessI18n.isRtl() ? "الرقم الجامعي مطلوب" : "Student ID is required");
      return;
    }
    if (!password) {
      cessSetFieldError(form.querySelector("[data-field='password']"),
        CessI18n.isRtl() ? "كلمة المرور مطلوبة" : "Password is required");
      return;
    }

    cessSetLoading(submitBtn, true,
      CessI18n.isRtl() ? "جارٍ الدخول..." : "Signing in...", idleLabel);

    try {
      const result = await CessApi.login(studentId, password);
      CessSession.setToken(result.token);
      CessSession.setCachedMember(result.member);
      window.location.href = "dashboard.html";
    } catch (err) {
      cessShowAlert(alertBox, err.message, "error");
    } finally {
      cessSetLoading(submitBtn, false, "", idleLabel);
      form.password.value = "";
    }
  });
}

/* =========================================================
 * ACTIVATION WIZARD
 * (Student ID + email -> code -> password -> security questions)
 * ========================================================= */

const CessActivation = {
  state: {
    step: 1,
    studentId: null,
    email: null,
    activationToken: null
  },

  goToStep(n) {
    this.state.step = n;
    document.querySelectorAll("[data-activation-step]").forEach((panel) => {
      const step = Number(panel.getAttribute("data-activation-step"));
      panel.classList.toggle("hidden", step !== n);
    });
    document.querySelectorAll("[data-steps-indicator] li").forEach((li, idx) => {
      const stepNum = idx + 1;
      li.classList.toggle("is-active", stepNum === n);
      li.classList.toggle("is-done", stepNum < n);
    });
    const firstInput = document.querySelector(
      `[data-activation-step="${n}"] input:not([type=hidden])`
    );
    if (firstInput) firstInput.focus();
  },

  init() {
    const root = document.querySelector("[data-activation-wizard]");
    if (!root) return;

    this.goToStep(1);
    this.initStep1();
    this.initStep2();
    this.initStep3();
    this.initStep4();
  },

  initStep1() {
    const form = document.querySelector("[data-activation-step='1'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");

      const studentId = form.student_id.value.trim();
      const email = form.email.value.trim();

      if (!studentId) {
        cessSetFieldError(form.querySelector("[data-field='student_id']"),
          CessI18n.isRtl() ? "الرقم الجامعي مطلوب" : "Student ID is required");
        return;
      }
      if (!email) {
        cessSetFieldError(form.querySelector("[data-field='email']"),
          CessI18n.isRtl() ? "البريد الإلكتروني مطلوب" : "Email is required");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ الإرسال..." : "Sending...", idleLabel);

      try {
        // Backend always returns a generic ack (never reveals whether
        // the student/email combination exists) — this is intentional
        // anti-enumeration behavior in authStartActivation. The UI
        // must not claim success/failure beyond what the backend says.
        await CessApi.startActivation(studentId, email);
        CessActivation.state.studentId = studentId;
        CessActivation.state.email = email;
        CessActivation.goToStep(2);
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
      }
    });
  },

  initStep2() {
    const form = document.querySelector("[data-activation-step='2'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");

      const code = form.code.value.trim();
      if (!/^\d{6}$/.test(code)) {
        cessSetFieldError(form.querySelector("[data-field='code']"),
          CessI18n.isRtl() ? "أدخل رمزًا مكونًا من 6 أرقام" : "Enter the 6-digit code");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ التحقق..." : "Verifying...", idleLabel);

      try {
        const result = await CessApi.verifyActivationCode(
          CessActivation.state.studentId,
          code
        );
        CessActivation.state.activationToken = result.activation_token;
        CessActivation.goToStep(3);
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
      }
    });
  },

  initStep3() {
    const form = document.querySelector("[data-activation-step='3'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessWirePasswordToggle(
      form.querySelector("[data-password-toggle='p1']"),
      form.querySelector("[data-password-field='p1']")
    );
    cessWirePasswordToggle(
      form.querySelector("[data-password-toggle='p2']"),
      form.querySelector("[data-password-field='p2']")
    );

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");

      const password = form.password.value;
      const confirm = form.confirm_password.value;

      if (password.length < 10) {
        cessSetFieldError(form.querySelector("[data-field='password']"),
          CessI18n.isRtl() ? "10 أحرف على الأقل" : "At least 10 characters");
        return;
      }
      if (password !== confirm) {
        cessSetFieldError(form.querySelector("[data-field='confirm_password']"),
          CessI18n.isRtl() ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ الحفظ..." : "Saving...", idleLabel);

      try {
        const result = await CessApi.setPassword(
          CessActivation.state.activationToken,
          password,
          confirm
        );
        CessActivation.state.activationToken = result.activation_token;
        CessActivation.goToStep(4);
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
        form.password.value = "";
        form.confirm_password.value = "";
      }
    });
  },

  initStep4() {
    const form = document.querySelector("[data-activation-step='4'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    const select1 = form.querySelector("[name='q1_id']");
    const select2 = form.querySelector("[name='q2_id']");

    // Prevent picking the same question twice at the UI level;
    // the backend also enforces this (authSetSecurityQuestions).
    function syncOptions() {
      [select1, select2].forEach((sel, idx) => {
        const other = idx === 0 ? select2 : select1;
        Array.from(sel.options).forEach((opt) => {
          if (!opt.value) return;
          opt.disabled = other.value === opt.value;
        });
      });
    }
    select1.addEventListener("change", syncOptions);
    select2.addEventListener("change", syncOptions);

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");

      const q1 = select1.value;
      const q2 = select2.value;
      const a1 = form.a1.value.trim();
      const a2 = form.a2.value.trim();

      if (!q1 || !q2) {
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "يرجى اختيار سؤالين" : "Please choose two questions", "error");
        return;
      }
      if (q1 === q2) {
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "يرجى اختيار سؤالين مختلفين" : "Please choose two different questions", "error");
        return;
      }
      if (!a1 || !a2) {
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "الإجابات مطلوبة" : "Answers are required", "error");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ التفعيل..." : "Activating...", idleLabel);

      try {
        await CessApi.setSecurityQuestions(
          CessActivation.state.activationToken, q1, a1, q2, a2
        );
        CessActivation.goToStep(5); // success panel
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
        form.a1.value = "";
        form.a2.value = "";
      }
    });
  }
};

/* =========================================================
 * FORGOT PASSWORD WIZARD
 * (Student ID -> email code -> security answers -> new password)
 * ========================================================= */

const CessRecovery = {
  state: { step: 1, studentId: null, recoveryToken: null, questions: [] },

  goToStep(n) {
    this.state.step = n;
    document.querySelectorAll("[data-recovery-step]").forEach((panel) => {
      const step = Number(panel.getAttribute("data-recovery-step"));
      panel.classList.toggle("hidden", step !== n);
    });
  },

  init() {
    const root = document.querySelector("[data-recovery-wizard]");
    if (!root) return;
    this.goToStep(1);
    this.initStep1();
    this.initStep2();
    this.initStep3();
  },

  initStep1() {
    const form = document.querySelector("[data-recovery-step='1'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");
      const studentId = form.student_id.value.trim();
      if (!studentId) {
        cessSetFieldError(form.querySelector("[data-field='student_id']"),
          CessI18n.isRtl() ? "الرقم الجامعي مطلوب" : "Student ID is required");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ الإرسال..." : "Sending...", idleLabel);

      try {
        // Generic ack regardless of whether the account exists —
        // matches authForgotPasswordStart's anti-enumeration design.
        await CessApi.forgotPasswordStart(studentId);
        CessRecovery.state.studentId = studentId;
        CessRecovery.goToStep(2);
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
      }
    });
  },

  initStep2() {
    const form = document.querySelector("[data-recovery-step='2'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");
      const code = form.email_code.value.trim();
      if (!/^\d{6}$/.test(code)) {
        cessSetFieldError(form.querySelector("[data-field='email_code']"),
          CessI18n.isRtl() ? "أدخل رمزًا مكونًا من 6 أرقام" : "Enter the 6-digit code");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ التحقق..." : "Verifying...", idleLabel);

      try {
        const result = await CessApi.forgotPasswordStart(
          CessRecovery.state.studentId, code
        );
        CessRecovery.state.recoveryToken = result.recovery_token;
        CessRecovery.state.questions = result.questions;
        CessRecovery.renderQuestions();
        CessRecovery.goToStep(3);
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
      }
    });
  },

  renderQuestions() {
    const lang = CessI18n.current();
    const [q1, q2] = this.state.questions;
    const label1 = document.querySelector("[data-security-q1-label]");
    const label2 = document.querySelector("[data-security-q2-label]");
    if (label1 && q1) label1.textContent = q1[lang];
    if (label2 && q2) label2.textContent = q2[lang];
  },

  initStep3() {
    const form = document.querySelector("[data-recovery-step='3'] form");
    if (!form) return;
    const alertBox = form.querySelector("[data-form-alert]");
    const submitBtn = form.querySelector("[data-submit]");
    const idleLabel = submitBtn.innerHTML;

    cessWirePasswordToggle(
      form.querySelector("[data-password-toggle='np1']"),
      form.querySelector("[data-password-field='np1']")
    );
    cessWirePasswordToggle(
      form.querySelector("[data-password-toggle='np2']"),
      form.querySelector("[data-password-field='np2']")
    );

    cessGuardedSubmit(form, async () => {
      cessClearFieldErrors(form);
      cessShowAlert(alertBox, "");

      const a1 = form.a1.value.trim();
      const a2 = form.a2.value.trim();
      const newPassword = form.new_password.value;
      const confirm = form.confirm_password.value;

      if (!a1 || !a2) {
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "الإجابات مطلوبة" : "Answers are required", "error");
        return;
      }
      if (newPassword.length < 10) {
        cessSetFieldError(form.querySelector("[data-field='new_password']"),
          CessI18n.isRtl() ? "10 أحرف على الأقل" : "At least 10 characters");
        return;
      }
      if (newPassword !== confirm) {
        cessSetFieldError(form.querySelector("[data-field='confirm_password']"),
          CessI18n.isRtl() ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
        return;
      }

      cessSetLoading(submitBtn, true,
        CessI18n.isRtl() ? "جارٍ إعادة التعيين..." : "Resetting...", idleLabel);

      try {
        await CessApi.resetPassword(
          CessRecovery.state.recoveryToken, a1, a2, newPassword, confirm
        );
        CessRecovery.goToStep(4); // success panel
      } catch (err) {
        cessShowAlert(alertBox, err.message, "error");
      } finally {
        cessSetLoading(submitBtn, false, "", idleLabel);
        form.a1.value = "";
        form.a2.value = "";
        form.new_password.value = "";
        form.confirm_password.value = "";
      }
    });
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initLoginForm();
  CessActivation.init();
  CessRecovery.init();
});
