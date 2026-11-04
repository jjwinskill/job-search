---
name: update-super-resume
description: Add or correct material in the candidate's Super Resume, such as a new project, a new engagement, a story from a session, or a fix for drift seen in generated resumes. Use when the user runs /job-search:update-super-resume. Not built yet.
argument-hint: <what to add or correct>
disable-model-invocation: true
---

# update-super-resume

**Not implemented yet. Planned for Phase 2.** If this skill is invoked now, tell the user it isn't built yet and stop.

## What it will do

- Make one targeted Update per run, based on what the user names.
- Read the sources first: session transcripts, repos, email. Ask only about what can't be traced, with specific questions (what you personally built, a number, a date), a few at a time.
- Every claim must trace to Evidence. Interview prep written to show an idealized version is not Evidence. Nothing is invented.
- Show proposed changes in batches of 8 or fewer, one Employer at a time, each as Before / After / Source. The user answers each one with ok, change or drop.
- Keep each Employer, Engagement and Project's fact block current (type, dates, titles, Resume Weight, Evidence). Phase 2 defines that format.
- Respect the Do-Not-Use List without mentioning it. Never add caveats about who else did what on shared work.

## Data

Find the data folder with `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. The layout is described in `docs/data-layout.md`.

- **Reads:** `super-resume.md`, `do-not-use.md`
- **Writes:** `super-resume.md`. Git history is the only record of older versions.
