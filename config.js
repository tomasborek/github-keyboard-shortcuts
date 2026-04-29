// Shortcut config. Keys are lowercased single characters.
// Each context maps a key to a sub-path appended to /:owner/:repo
// (empty string = repo root).
const SHORTCUTS = {
  repo: {
    c: "",
    p: "pulls",
    i: "issues",
    a: "actions",
  },
};
