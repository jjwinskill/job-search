---
name: edit-resume
description: Change one Generated Resume from plain-word instructions, or re-render it after a hand edit. Use when the user runs /job-search:edit-resume or asks to change wording, emphasis or content in a resume already generated for an Application. Not built yet.
argument-hint: <application> <what to change>
disable-model-invocation: true
---

# edit-resume

**Not implemented yet. Planned for Phase 3.** If this skill is invoked now, tell the user it isn't built yet and stop.

## What it will do

- Apply the changes the user describes to one Application's `resume.md`, then re-render the PDF and report the page count. Typical requests:
  - "that's not my voice"
  - "don't emphasize that"
  - "you left something out"
- With no instructions, just re-render after a hand edit.
- Edits change the Generated Resume, not the Super Resume. If an edit brings in a fact the Super Resume doesn't have, offer it as an Update.
- Record a lasting preference as a Lesson, so later Generated Resumes follow it.

## Data

Find the data folder with `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. The layout is described in `docs/data-layout.md`.

- **Reads:** `applications/<folder>/resume.md`, `super-resume.md`, `lessons.md`
- **Writes:** `applications/<folder>/resume.md`, `applications/<folder>/resume.pdf`, `lessons.md`
