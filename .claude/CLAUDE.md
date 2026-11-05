# job-search

A public Claude Code plugin. Never commit personal data: no names other than the author's in `LICENSE` and the plugin manifest, no employers, clients, contact details or pay figures. That material lives in the user's private data folder.

- Vocabulary: `GLOSSARY.md`. Use its terms, and avoid the words it lists under _Avoid_.
- Plugin commands: `skills/<name>/SKILL.md`.
- Dev-only skills (not shipped with the plugin): `.claude/skills/`.
- Guardrails: run `scripts/install-hooks.sh` once per clone.
  - Pre-commit runs the tests and the personal-data scan.
  - Pre-push scans what is being pushed, history included.
  - Only the repo owner adds lines to `.scan-allow`.
- Tests cover the scripts with real logic. Skills have no tests: end-to-end runs judge their quality.
- Before merging a PR that changes `scripts/`, run `/code-review`.
- For Claude Code questions (plugins, skills, cloud sessions), ask the `claude-code-guide` agent rather than fetching docs.
- If `gh pr merge` says "not mergeable" right after a push, GitHub is still computing mergeability. Wait a few seconds and retry.
