/**
 * CESS — Member Dashboard Controller
 *
 * Renders ONLY real data returned by auth.getSession. Never fabricates
 * membership statistics, activity counts, or admin permissions.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("dash-loading");
  const contentEl = document.getElementById("dash-content");

  const session = await cessRequireAuth("login.html");
  if (!session) return; // redirected

  loadingEl.classList.add("hidden");
  contentEl.classList.remove("hidden");

  const lang = CessI18n.current();

  document.getElementById("info-student-id").textContent = session.student_id || "—";

  const statusEl = document.getElementById("info-membership-status");
  const statusText = session.membership_status || "—";
  const badge = document.createElement("span");
  badge.className = `badge ${statusText === "active" ? "badge--active" : "badge--pending"}`;
  badge.textContent = statusText;
  statusEl.innerHTML = "";
  statusEl.appendChild(badge);

  const adminEl = document.getElementById("info-admin-status");
  if (session.isAdmin) {
    const adminBadge = document.createElement("span");
    adminBadge.className = "badge badge--admin";
    adminBadge.textContent = lang === "ar" ? "مسؤول" : "Admin";
    adminEl.innerHTML = "";
    adminEl.appendChild(adminBadge);
    document.getElementById("admin-link").classList.remove("hidden");
  } else {
    adminEl.textContent = lang === "ar" ? "لا" : "No";
  }

  initChangeEmailForm();
});

function initChangeEmailForm() {
  const form = document.getElementById("change-email-form");
  if (!form) return;

  const alertBox = document.querySelector('[data-form-alert="email"]');
  const step1 = document.getElementById("email-step-1");
  const step2 = document.getElementById("email-step-2");

  let pendingEmail = null;
  let inFlight = false;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (inFlight) return;

    const submitter = e.submitter;
    const step = submitter ? submitter.getAttribute("data-step") : "1";
    const token = CessSession.getToken();

    cessShowAlert(alertBox, "");
    inFlight = true;
    const idleLabel = submitter.innerHTML;
    cessSetLoading(submitter, true, CessI18n.isRtl() ? "جارٍ الإرسال..." : "Sending...", idleLabel);

    try {
      if (step === "1") {
        const newEmail = form.new_email.value.trim();
        if (!newEmail) throw new CessApiError(
          CessI18n.isRtl() ? "البريد الإلكتروني مطلوب" : "Email is required"
        );
        const result = await CessApi.changeEmail(token, newEmail);
        pendingEmail = newEmail;
        step1.classList.add("hidden");
        step2.classList.remove("hidden");
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "تم إرسال رمز التحقق إلى البريد الجديد." : "A verification code was sent to the new email.",
          "success"
        );
      } else {
        const code = form.code.value.trim();
        if (!/^\d{6}$/.test(code)) throw new CessApiError(
          CessI18n.isRtl() ? "أدخل رمزًا مكونًا من 6 أرقام" : "Enter the 6-digit code"
        );
        await CessApi.changeEmail(token, pendingEmail, code);
        cessShowAlert(alertBox,
          CessI18n.isRtl() ? "تم تغيير البريد الإلكتروني بنجاح." : "Email changed successfully.",
          "success"
        );
        step2.classList.add("hidden");
        form.reset();
        step1.classList.remove("hidden");
      }
    } catch (err) {
      cessShowAlert(alertBox, err.message, "error");
    } finally {
      inFlight = false;
      cessSetLoading(submitter, false, "", idleLabel);
    }
  });
}
