// ============================================================
// common/session.js
// Shared across every module's sidebar/header. Include this
// file BEFORE each module's own <module>.js, e.g.:
//   <script src="/common/session.js"></script>
//   <script src="/dashboard/dashboard.js"></script>
//
// Responsibilities:
//   1. getCurrentUser()      — read {token, role, partnerId, partnerName} from sessionStorage
//   2. applyRoleBasedMenu()  — hide any [data-role] element whose allowed
//                              role list does not include the current user's role
//   3. applyProfileRoleLabel() — fill "Logged in as: {role}" (+ partner name)
//                              into the header profile dropdown, if present
//
// TODO: once auth/login is wired to the backend, confirm the exact
// sessionStorage keys used at login time match what getCurrentUser() reads below.
// ============================================================

(function (global) {
  const SESSION_KEY = "sqms_session"; // sessionStorage key holding the JSON blob

  /**
   * Returns the current logged-in user info, or null if not logged in.
   * Shape: { token, role, partnerId, partnerName }
   */
  function getCurrentUser() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        token: parsed.token || null,
        role: parsed.role || null,
        partnerId: parsed.partnerId || null,
        partnerName: parsed.partnerName || null,
      };
    } catch (err) {
      console.error("session.js: failed to read session", err);
      return null;
    }
  }

  /**
   * Hides every [data-role] element in the DOM whose comma-separated
   * role list does not include the current user's role.
   * Elements with no data-role attribute are left untouched (default: visible to all).
   */
  function applyRoleBasedMenu() {
    const user = getCurrentUser();
    const currentRole = user ? user.role : null;

    // Fail-open when there is no session yet (e.g. opening a module
    // directly during dev/testing, before login is wired up): don't
    // hide anything. Once a real session with a role is set at login,
    // restriction kicks in normally.
    // TODO: once login flow is wired to the backend and always sets
    // a session before these pages are reachable, this fail-open
    // branch can be removed so an unknown/missing role hides
    // restricted items by default instead of showing them.
    if (!currentRole) {
      console.warn("session.js: no active session/role found — showing all menu items (dev fallback).");
      return;
    }

    document.querySelectorAll("[data-role]").forEach((el) => {
      const allowedRoles = el
        .getAttribute("data-role")
        .split(",")
        .map((r) => r.trim())
        .filter(Boolean);

      const isAllowed = allowedRoles.includes(currentRole);
      el.style.display = isAllowed ? "" : "none";
    });
  }

  /**
   * Fills "Logged in as: {role}" (and partner name for Channel Partner
   * roles) into the header profile dropdown, if the expected elements
   * exist on the page (#profileRoleLabel / #profilePartnerLabel).
   */
  function applyProfileRoleLabel() {
    const user = getCurrentUser();
    if (!user) return;

    const roleLabelEl = document.getElementById("profileRoleLabel");
    const partnerLabelEl = document.getElementById("profilePartnerLabel");

    if (roleLabelEl) {
      roleLabelEl.textContent = `Logged in as: ${user.role || "-"}`;
    }

    if (partnerLabelEl) {
      const isChannelPartner = (user.role || "").startsWith("CHANNEL_PARTNER");
      if (isChannelPartner && user.partnerName) {
        partnerLabelEl.textContent = user.partnerName;
        partnerLabelEl.classList.remove("hidden");
      } else {
        partnerLabelEl.classList.add("hidden");
      }
    }
  }

  function initSessionUI() {
    applyRoleBasedMenu();
    applyProfileRoleLabel();
  }

  document.addEventListener("DOMContentLoaded", initSessionUI);

  // Expose on window so individual module JS files can call these
  // directly too (e.g. after dynamically re-rendering the sidebar).
  global.getCurrentUser = getCurrentUser;
  global.applyRoleBasedMenu = applyRoleBasedMenu;
  global.applyProfileRoleLabel = applyProfileRoleLabel;
})(window);