// First path segments that look like /:owner/:repo but aren't repos.
const RESERVED_OWNERS = new Set([
  "settings", "marketplace", "notifications", "explore", "topics",
  "codespaces", "issues", "pulls", "sponsors", "orgs", "new",
  "login", "logout", "join", "about", "pricing", "enterprise",
  "customer-stories", "team", "features", "security", "dashboard",
  "trending", "collections", "events", "sessions", "discussions",
  "apps", "github-copilot", "site", "search",
]);

const HINT_CONTAINER_ID = "gh-shortcuts-hints";
const HINT_BADGE_CLASS = "gh-shortcut-badge";
const PR_ROW_SELECTED_CLASS = "gh-shortcuts-pr-selected";

function getRepoContext() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [owner, repo] = segments;
  if (RESERVED_OWNERS.has(owner)) return null;
  return { owner, repo };
}

function isTypingTarget(el) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function repoPath(ctx, subPath) {
  const base = `/${ctx.owner}/${ctx.repo}`;
  return subPath ? `${base}/${subPath}` : base;
}

function isRepoRootPage(ctx) {
  const path = window.location.pathname.replace(/\/$/, "");
  return path === `/${ctx.owner}/${ctx.repo}`;
}

function findReadmeAnchor() {
  return (
    document.getElementById("readme") ||
    document.querySelector("article.markdown-body")
  );
}

document.addEventListener(
  "keydown",
  (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;

    // Pulls list navigation takes priority when on a pulls page.
    if (handlePullsListKey(event)) return;

    if (event.key.length !== 1) return;
    const key = event.key.toLowerCase();
    const target = SHORTCUTS.repo[key];
    if (target === undefined) return;

    const ctx = getRepoContext();
    if (!ctx) return;

    event.preventDefault();
    event.stopPropagation();

    if (typeof target === "object" && target.type === "owner") {
      window.location.assign(`/${ctx.owner}`);
      return;
    }
    if (typeof target === "object" && target.type === "readme") {
      if (!isRepoRootPage(ctx)) {
        window.location.assign(`${repoPath(ctx, "")}#readme`);
        return;
      }
      const readme = findReadmeAnchor();
      if (readme) {
        readme.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `${window.location.pathname}#readme`);
      }
      return;
    }
    window.location.assign(repoPath(ctx, target));
  },
  true,
);

// --- Hint badges ---------------------------------------------------------

const badgeRegistry = new Map(); // key -> { badge, anchor }

function ensureHintInfra() {
  let container = document.getElementById(HINT_CONTAINER_ID);
  if (container) return container;

  const style = document.createElement("style");
  style.textContent = `
    #${HINT_CONTAINER_ID} {
      position: absolute;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 2147483600;
    }
    #${HINT_CONTAINER_ID} .${HINT_BADGE_CLASS} {
      position: absolute;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      font-weight: 600;
      line-height: 1;
      padding: 2px 4px;
      background: rgba(31, 35, 40, 0.92);
      color: #f6f8fa;
      border: 1px solid rgba(240, 246, 252, 0.1);
      border-radius: 4px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
      transform: translate(-50%, -50%);
      white-space: nowrap;
    }
    .${PR_ROW_SELECTED_CLASS} {
      box-shadow: inset 3px 0 0 0 #2f81f7, 0 0 0 1px rgba(47, 129, 247, 0.4);
      background-color: rgba(47, 129, 247, 0.08) !important;
    }
  `;
  document.head.appendChild(style);

  container = document.createElement("div");
  container.id = HINT_CONTAINER_ID;
  document.body.appendChild(container);
  return container;
}

function findAnchor(ctx, target) {
  if (typeof target === "object" && target.type === "readme") {
    if (!isRepoRootPage(ctx)) return null;
    return findReadmeAnchor();
  }
  if (typeof target === "object" && target.type === "owner") {
    const ownerHref = `/${ctx.owner}`;
    // Prefer the owner link in the repo header breadcrumb.
    return (
      document.querySelector(
        `[itemprop='author'] a[href="${ownerHref}"], [itemprop='author'] a[href="${ownerHref}/"]`,
      ) ||
      document.querySelector(
        `a[data-hovercard-type='organization'][href="${ownerHref}"]`,
      ) ||
      document.querySelector(
        `a[data-hovercard-type='user'][href="${ownerHref}"]`,
      ) ||
      document.querySelector(`a[href="${ownerHref}"]`)
    );
  }
  const path = repoPath(ctx, target);
  const nav = document.querySelector('nav[aria-label="Repository"]');
  const scope = nav || document;
  return (
    scope.querySelector(`a[href="${path}"]`) ||
    scope.querySelector(`a[href="${path}/"]`)
  );
}

function hideAll() {
  for (const entry of badgeRegistry.values()) {
    entry.badge.style.display = "none";
    entry.anchor = null;
  }
}

function updateHints() {
  const ctx = getRepoContext();
  if (!ctx) {
    hideAll();
    return;
  }

  const container = ensureHintInfra();

  for (const [key, target] of Object.entries(SHORTCUTS.repo)) {
    const anchor = findAnchor(ctx, target);
    let entry = badgeRegistry.get(key);

    if (!anchor) {
      if (entry) {
        entry.badge.style.display = "none";
        entry.anchor = null;
      }
      continue;
    }

    if (!entry) {
      const badge = document.createElement("span");
      badge.className = HINT_BADGE_CLASS;
      badge.textContent = key.toUpperCase();
      container.appendChild(badge);
      entry = { badge, anchor: null };
      badgeRegistry.set(key, entry);
    }

    entry.anchor = anchor;
    entry.badge.style.display = "";

    const rect = anchor.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      entry.badge.style.display = "none";
      continue;
    }
    // Anchor: top-right corner of the link.
    const x = rect.right + window.scrollX;
    const y = rect.top + window.scrollY;
    entry.badge.style.left = `${x}px`;
    entry.badge.style.top = `${y}px`;
  }
}

// --- Pulls list navigation ----------------------------------------------

const PR_ROW_SELECTORS = [
  ".js-issue-row",
  "[data-testid='issue-pr-row']",
  "[data-listview-component='items-list-item']",
];

let pullsState = {
  rows: [],
  index: -1,
  hintBadges: [], // {badge}
};

function isPullsListPage() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  if (segments.length < 3) return false;
  if (RESERVED_OWNERS.has(segments[0])) return false;
  return segments[2] === "pulls";
}

function findPRRows() {
  for (const sel of PR_ROW_SELECTORS) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) return Array.from(found);
  }
  return [];
}

function findPRLink(row) {
  // Title link to the PR detail page.
  return (
    row.querySelector("a[data-hovercard-type='pull_request']") ||
    row.querySelector("a[id^='issue_'][href*='/pull/']") ||
    row.querySelector("a[href*='/pull/']")
  );
}

function clearPullsSelection() {
  for (const row of pullsState.rows) {
    row.classList.remove(PR_ROW_SELECTED_CLASS);
  }
  pullsState.index = -1;
}

function setPullsSelection(index) {
  if (pullsState.rows.length === 0) return;
  const clamped = Math.max(0, Math.min(pullsState.rows.length - 1, index));
  for (let i = 0; i < pullsState.rows.length; i++) {
    pullsState.rows[i].classList.toggle(PR_ROW_SELECTED_CLASS, i === clamped);
  }
  pullsState.index = clamped;
  const el = pullsState.rows[clamped];
  const rect = el.getBoundingClientRect();
  if (rect.top < 80 || rect.bottom > window.innerHeight - 40) {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  scheduleUpdate();
}

function refreshPullsRows() {
  if (!isPullsListPage()) {
    if (pullsState.rows.length) clearPullsSelection();
    pullsState.rows = [];
    return;
  }
  const rows = findPRRows();
  // If rows changed, reset selection.
  const changed =
    rows.length !== pullsState.rows.length ||
    rows.some((r, i) => r !== pullsState.rows[i]);
  if (changed) {
    clearPullsSelection();
    pullsState.rows = rows;
  }
}

function handlePullsListKey(event) {
  if (!isPullsListPage()) return false;
  refreshPullsRows();
  if (pullsState.rows.length === 0) return false;

  const cfg = SHORTCUTS.pullsList || {};
  const key = event.key;

  if ((cfg.next || []).includes(key)) {
    event.preventDefault();
    event.stopPropagation();
    setPullsSelection(pullsState.index < 0 ? 0 : pullsState.index + 1);
    return true;
  }
  if ((cfg.prev || []).includes(key)) {
    event.preventDefault();
    event.stopPropagation();
    setPullsSelection(pullsState.index < 0 ? 0 : pullsState.index - 1);
    return true;
  }
  if ((cfg.open || []).includes(key) && pullsState.index >= 0) {
    const row = pullsState.rows[pullsState.index];
    const link = row && findPRLink(row);
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      link.click();
      return true;
    }
  }
  return false;
}

function updatePullsHints() {
  const container = ensureHintInfra();
  // Ensure two badges exist.
  while (pullsState.hintBadges.length < 2) {
    const badge = document.createElement("span");
    badge.className = HINT_BADGE_CLASS;
    container.appendChild(badge);
    pullsState.hintBadges.push({ badge });
  }
  const [downEntry, upEntry] = pullsState.hintBadges;

  if (!isPullsListPage() || pullsState.rows.length === 0) {
    downEntry.badge.style.display = "none";
    upEntry.badge.style.display = "none";
    return;
  }

  const targetRow =
    pullsState.index >= 0
      ? pullsState.rows[pullsState.index]
      : pullsState.rows[0];
  const rect = targetRow.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    downEntry.badge.style.display = "none";
    upEntry.badge.style.display = "none";
    return;
  }

  const x = rect.right + window.scrollX - 4;
  const yMid = rect.top + window.scrollY + rect.height / 2;

  downEntry.badge.textContent = "J \u2193";
  downEntry.badge.style.display = "";
  downEntry.badge.style.left = `${x}px`;
  downEntry.badge.style.top = `${yMid + 10}px`;

  upEntry.badge.textContent = "K \u2191";
  upEntry.badge.style.display = "";
  upEntry.badge.style.left = `${x}px`;
  upEntry.badge.style.top = `${yMid - 10}px`;
}

let updateScheduled = false;
function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    updateHints();
    refreshPullsRows();
    updatePullsHints();
  });
}

const mutationObserver = new MutationObserver(scheduleUpdate);
mutationObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener("resize", scheduleUpdate);
window.addEventListener("popstate", scheduleUpdate);
document.addEventListener("turbo:render", scheduleUpdate);
document.addEventListener("turbo:load", scheduleUpdate);

scheduleUpdate();
