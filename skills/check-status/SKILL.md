---
name: check-status
description: Read the candidate's email to update Application statuses and screen recruiter outreach, then write a status report in a fixed format. Use when the user runs /job-search:check-status or asks for a job-search status report. Not built yet.
disable-model-invocation: true
---

# check-status

**Not implemented yet. Planned for Phase 4.** If this skill is invoked now, tell the user it isn't built yet and stop.

## What it will do

- **Read email.** Read-only, including spam, and only mail since the last report. Never send, label or delete anything.
- **Update Applications.** Match replies, rejections and interview invites to Applications, and update their Status and notes.
- **Screen Inbound.** Find recruiter outreach, sent directly or through job-network notifications, and screen it against `criteria.md`:
  - **Legitimacy:** the role appears on the employer's own careers page, or the sender's domain matches a real company.
  - **Fit:** level, focus, location and type.
  - **Pay floor:** reject when the top of the posted range is below it.

  Each one that passes becomes an `inbound` Application, and the user is asked whether to generate a resume for it.
- **Report** to `reports/YYYY-MM-DD.md` and in chat, always with these sections:
  1. Needs you
  2. Changed
  3. Pipeline table
  4. Going quiet
  5. Screened out
  6. Unmatched

## Data

Find the data folder with `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. The layout is described in `docs/data-layout.md`.

- **Reads:** `applications/`, `criteria.md`, `reports/` (to find the last report)
- **Writes:** `applications/<folder>/application.md`, `applications.csv`, `reports/YYYY-MM-DD.md`
