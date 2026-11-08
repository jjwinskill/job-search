---
name: check-status
description: Read the candidate's email (read-only) to update Application statuses and screen recruiter outreach, then write a status report in a fixed format.
disable-model-invocation: true
model: sonnet
---

# check-status

Read the candidate's job mail since the last report, bring every Application's **Status** up to date, screen **Inbound** against the criteria file, and write one report in the same six sections every time. The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`, and the record format in `${CLAUDE_PLUGIN_ROOT}/docs/data-layout.md`.

The judgment is yours: what each email is, which Application it belongs to, whether an Inbound fits. Every rule belongs to `<plugin>/scripts/check-status.mjs`: the mail window, matching, Status changes (never backward), the 30-day ghosted rule, the pay floor and the report. Hand it your judgments and let it decide. Throughout, `<plugin>` is `${CLAUDE_PLUGIN_ROOT}`, `<data>` is the data folder, and `<tmp>` is a fresh `mktemp -d`.

**Gmail is read-only.** Use only the connector's search, read and list-labels tools: never draft, send, label, archive, trash or mark anything.

## Steps

1. **Set up.** A run belongs in a fresh session, because every call carries the whole conversation. If this one already holds other work, say so in one line and carry on. Run `node <plugin>/scripts/config.mjs` for `<data>`, then:
   - `node <plugin>/scripts/check-status.mjs window`: the mail window. `query` is the term every search adds, and `firstRun` means a 6-month sweep.
   - `node <plugin>/scripts/check-status.mjs apps`: one line per Application (folder, company, role, status, applied, last contact).
   - Read `<data>/criteria.md`.
   - *Done when* you hold the window, the Application list and the criteria.

2. **Search.** Run every query in [gmail-queries.md](gmail-queries.md) with the window's `query` term added, in the summary view at 50 threads a page, following each page token to the end. A thread found by several queries counts once.
   - *Done when* every query has run to its last page.

3. **Place each thread** in exactly one bucket, in the shape of [run-input.md](run-input.md):
   - **event**: mail from an employer about one of the candidate's applications, or the candidate's own withdrawal.
   - **inbound**: a recruiter bringing a role that isn't on the Application list.
   - **unmatched**: job mail you can't place, with the reason.
   - **skipped**: job alerts, newsletters, marketing, and the candidate's own mail other than a withdrawal. Count these.

   Decide from the sender, subject and snippet. Open a thread (`get_thread`, plain text) only when its type turns on the body: "Update on your application" can be an interview or a rejection. Give an event's `folder` when the mail plainly belongs to a listed Application; otherwise its company and role as the mail names them.
   - *Done when* every thread is in one bucket and every event has a type, a date and evidence.

4. **Screen Inbound** against the criteria file. Judge `level`, `focus`, `location` and `type` from the message and any linked posting.
   - **Legitimacy:** `pass` when the sender's domain belongs to the company or a real recruiting agency. Otherwise search the web once for the role on the company's own careers page or job board: found is `pass`, not found is `unverified`.
   - Put the posted range in `pay_range` as written; the script applies the floor.
   - *Done when* every Inbound carries all five checks, with a reason for each `fail`.

5. **Apply.** Write the input to `<tmp>/input.json` and dry-run it: `node <plugin>/scripts/check-status.mjs run <tmp>/input.json --dry-run`.
   - Read every **Changed** line against its mail: a misread email shows up here as a wrong move. Fix the input and dry-run again.
   - For each line the script added to **Unmatched** that the mail lets you place (it names which of two roles), add the `folder` and dry-run again.
   - Then run it for real, without `--dry-run`. It writes `reports/<date>.md`, updates the Applications and rebuilds the index.
   - *Done when* the real run exits 0.

6. **Report.** If `<data>` is a git repo, commit `applications/`, `applications.csv` and `reports/` as `Status report: <date>`. Show the report in chat exactly as the script printed it.
   - *Done when* the commit exists and the report is in chat.

7. **Follow up** on the candidate's answers. `set` writes the Status and a dated note, and rebuilds the index; commit after each.
   - **An Inbound to pursue:** they run `/job-search:generate-resume <source_url>` in a fresh session, which takes over the `inbound` record.
   - **An Inbound to pass on:** `node <plugin>/scripts/check-status.mjs set <folder> passed --note "<their reason>"`.
   - **A correction**, such as "I applied on the 9th" or "they turned me down in their portal": `set <folder> <status> --date <date> --note "<what they said>"`.

## Data

- **Reads:** `applications/`, `criteria.md`, `reports/` (for the window)
- **Writes:** `applications/<folder>/application.md` (Status, dates, a dated note per change), new Application folders, `applications.csv`, `reports/<date>.md`
