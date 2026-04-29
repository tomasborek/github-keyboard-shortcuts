// Shortcut config. Keys are lowercased single characters.
// Each context maps a key to a sub-path appended to /:owner/:repo
// (empty string = repo root).
const SHORTCUTS = {
  repo: {
    c: "",
    p: "pulls",
    i: "issues",
    a: "actions",
    o: { type: "owner" },
    r: { type: "readme" },
  },
  // Keys handled on the pulls list to navigate the row selection.
  pullsList: {
    next: ["j", "ArrowDown"],
    prev: ["k", "ArrowUp"],
    open: ["Enter"],
  },
};
