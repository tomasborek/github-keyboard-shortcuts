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

document.addEventListener(
  "keydown",
  (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;
    if (isTypingTarget(event.target)) return;

    const key = event.key.toLowerCase();
    const subPath = SHORTCUTS.repo[key];
    if (subPath === undefined) return;

    const ctx = getRepoContext();
    if (!ctx) return;

    event.preventDefault();
    event.stopPropagation();

    window.location.assign(repoPath(ctx, subPath));
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
    }
  `;
  document.head.appendChild(style);

  container = document.createElement("div");
  container.id = HINT_CONTAINER_ID;
  document.body.appendChild(container);
  return container;
}

function findAnchor(ctx, subPath) {
  const target = repoPath(ctx, subPath);
  const nav = document.querySelector('nav[aria-label="Repository"]');
  const scope = nav || document;
  return (
    scope.querySelector(`a[href="${target}"]`) ||
    scope.querySelector(`a[href="${target}/"]`)
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

  for (const [key, subPath] of Object.entries(SHORTCUTS.repo)) {
    const anchor = findAnchor(ctx, subPath);
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

let updateScheduled = false;
function scheduleUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;
  requestAnimationFrame(() => {
    updateScheduled = false;
    updateHints();
  });
}

const mutationObserver = new MutationObserver(scheduleUpdate);
mutationObserver.observe(document.body, { childList: true, subtree: true });

window.addEventListener("resize", scheduleUpdate);
window.addEventListener("popstate", scheduleUpdate);
document.addEventListener("turbo:render", scheduleUpdate);
document.addEventListener("turbo:load", scheduleUpdate);

scheduleUpdate();
