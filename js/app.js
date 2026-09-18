/**
 * CESS — App Shell
 * Shared behavior across all pages: theme, mobile nav, header auth state.
 */

const CESS_THEME_KEY = "cess_theme";

const CessTheme = {
  current() {
    return localStorage.getItem(CESS_THEME_KEY) ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  },

  apply(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(CESS_THEME_KEY, theme);
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(theme === "dark"));
    });
  },

  toggle() {
    this.apply(this.current() === "dark" ? "light" : "dark");
  },

  init() {
    this.apply(this.current());
    document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => this.toggle());
    });
  }
};

function initMobileNav() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const menu = document.querySelector("[data-mobile-menu]");
  if (!toggle || !menu) return;

  toggle.addEventListener("click", () => {
    const isOpen = !menu.classList.contains("hidden");
    menu.classList.toggle("hidden", isOpen);
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });
}

/**
 * Reflects current login state in the header (Login vs Dashboard/Logout).
 * Reads cached session presence only — pages that need authorized data
 * must call cessRequireAuth() themselves; this is UX only.
 */
function updateHeaderAuthState() {
  const loggedIn = typeof CessSession !== "undefined" && CessSession.isLoggedIn();
  document.querySelectorAll("[data-auth-only]").forEach((el) => {
    el.classList.toggle("hidden", !loggedIn);
  });
  document.querySelectorAll("[data-guest-only]").forEach((el) => {
    el.classList.toggle("hidden", loggedIn);
  });

  const logoutBtn = document.querySelector("[data-logout]");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      CessSession.logout();
      window.location.href = "index.html";
    });
  }
}

function highlightCurrentNavLink() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll("[data-nav-link]").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && href.endsWith(path)) {
      link.setAttribute("aria-current", "page");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  CessTheme.init();
  initMobileNav();
  highlightCurrentNavLink();
  if (typeof CessSession !== "undefined") updateHeaderAuthState();
});
