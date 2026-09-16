/**
 * CESS — Internationalization (Arabic / English)
 *
 * Default language: Arabic (RTL). English is LTR.
 * Strings live in data-i18n-* attributes in the HTML; this module
 * swaps text content and toggles document direction.
 *
 * Usage in HTML:
 *   <h1 data-i18n-ar="مرحبا" data-i18n-en="Welcome"></h1>
 *   <input data-i18n-ar-placeholder="..." data-i18n-en-placeholder="...">
 */

const CESS_LANG_KEY = "cess_lang";

const CessI18n = {
  current() {
    return localStorage.getItem(CESS_LANG_KEY) || "ar";
  },

  isRtl(lang) {
    return (lang || this.current()) === "ar";
  },

  set(lang) {
    if (lang !== "ar" && lang !== "en") lang = "ar";
    localStorage.setItem(CESS_LANG_KEY, lang);
    this.apply(lang);
  },

  apply(lang) {
    lang = lang || this.current();
    const dir = this.isRtl(lang) ? "rtl" : "ltr";

    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", dir);

    // Text content
    document.querySelectorAll(`[data-i18n-${lang}]`).forEach((el) => {
      const value = el.getAttribute(`data-i18n-${lang}`);
      if (value !== null) el.textContent = value;
    });

    // Placeholders
    document.querySelectorAll(`[data-i18n-${lang}-placeholder]`).forEach((el) => {
      const value = el.getAttribute(`data-i18n-${lang}-placeholder`);
      if (value !== null) el.setAttribute("placeholder", value);
    });

    // aria-label
    document.querySelectorAll(`[data-i18n-${lang}-aria-label]`).forEach((el) => {
      const value = el.getAttribute(`data-i18n-${lang}-aria-label`);
      if (value !== null) el.setAttribute("aria-label", value);
    });

    // Update language switch buttons state
    document.querySelectorAll("[data-lang-option]").forEach((btn) => {
      const isActive = btn.getAttribute("data-lang-option") === lang;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-pressed", String(isActive));
    });

    document.dispatchEvent(new CustomEvent("cess:langchange", { detail: { lang, dir } }));
  },

  init() {
    this.apply(this.current());

    document.querySelectorAll("[data-lang-option]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.set(btn.getAttribute("data-lang-option"));
      });
    });
  }
};

document.addEventListener("DOMContentLoaded", () => CessI18n.init());
