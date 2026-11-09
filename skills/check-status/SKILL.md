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
   - **On a first run** (`firstRun`), split the six months in two and hand each half to a subagent on Sonnet. Each runs steps 1 to 4 with its own `after:` and `before:` dates in place of the window's `query`, writes its placements to its own file in `<tmp>` as it goes, in the shape of [run-input.md](run-input.md), and stops there. Merge the two files, counting a thread both found once. Six months of mail in one context grows past 400k tokens, and every later call re-reads it.
   - *Done when* every query has run to its last page.

3. **Place each thread** in exactly one bucket, in the shape of [run-input.md](run-input.md):
   - **event**: mail from an employer about one of the candidate's applications, or the candidate's own reply that withdraws from one or turns down a role on record.
   - **inbound**: a recruiter, referrer or friend bringing a role that isn't on the Application list, one per role the thread names.
   - **unmatched**: job mail you can't place, with the reason.
   - **skipped**: job alerts, newsletters, marketing. Count these.

   Decide from the sender, subject and snippet, and open a thread (`get_thread`, plain text) when its meaning turns on the body: "Update on your application" can be an interview or a rejection.
   - **The candidate's replies are part of the conversation.** Whenever they wrote in a thread, read their messages, cheaply, as [gmail-queries.md](gmail-queries.md) says: their no closes a role, their yes keeps it open with its next step, and their questions can bring out the role an intro left unnamed. Record it as the Inbound's `reply`, or as a `passed` or `withdrawn` event on a role already on record. Thank-yous and scheduling notes change nothing.
   - **Recruiter threads keep their details in the first message.** The summary view shows the newest one, often a "last check-in", so open the thread before calling the role vague.

   Give an event's `folder` when the mail plainly belongs to a listed Application; otherwise its company and role as the mail names them.
   - *Done when* every thread is in one bucket, every event has a type, a date and evidence, and the candidate's own messages in every thread have been read.

4. **Describe and screen each Inbound.** The candidate decides from the report alone, so every Inbound that passes screening gets an `about`: what the company does and what the role owns, in one or two sentences. The script refuses an Inbound without one.
   - **Read the JD** when the message links one: `node <plugin>/scripts/fetch-jd.mjs <url> --out <tmp>/jd-<n>.md`. When it names the role without a link, find the posting on the company's careers page or a job board.
   - **Pay:** when the message has no range, take the JD's. When the JD has none, search the web for another copy of the same posting (`<company> "<title>" salary`): job boards often repost it with the range. `pay_range` holds only this posting's own range, with where it came from ("$146k–$241k (Built In's copy of the posting)"). When no copy posts one, say so in `about`, with a sibling or comparable role's range and its source.
   - **Checks:** judge `level`, `focus`, `location` and `type` against the criteria file from the message and the JD.
   - **Legitimacy:** `pass` when the sender's domain belongs to the company or a real recruiting agency or hiring platform, or the role is on the company's own careers page or job board. Otherwise `unverified`. A LinkedIn InMail has no sender domain, and one for an unnamed client is `unverified`.
   - The script applies the pay floor, and it skips screening for an Inbound the candidate has already declined.
   - *Done when* every Inbound carries all five checks, a reason for each `fail`, and an `about` unless it fails screening or was declined.

5. **Apply.** Write the input to `<tmp>/input.json` and dry-run it: `node <plugin>/scripts/check-status.mjs run <tmp>/input.json --dry-run`.
   - Read every **Changed** line against its mail: a misread email shows up here as a wrong move. Fix the input and dry-run again.
   - For each line the script added to **Unmatched** that the mail lets you place (it names which of two roles), add the `folder` and dry-run again.
   - Then run it for real, without `--dry-run`. It writes `reports/<date>.md` (`<date>-2.md` for a second run that day), updates the Applications and rebuilds the index.
   - *Done when* the real run exits 0.

6. **Report.** If `<data>` is a git repo, commit `applications/`, `applications.csv` and `reports/` as `Status report: <date>`. Show the report in chat exactly as the script printed it.
   - *Done when* the commit exists and the report is in chat.

7. **Follow up** on the candidate's answers. `set` writes the Status and a dated note, and rebuilds the index; commit after each.
   - **An Inbound to pursue:** they run `/job-search:generate-resume <source_url>` in a fresh session, which takes over the `inbound` record.
   - **An Inbound to pass on:** `node <plugin>/scripts/check-status.mjs set <folder> passed --note "<their reason>"`. Inbound last heard over 21 days ago is stale, and the report asks about it as a group.
   - **A correction**, such as "I applied on the 9th" or "they turned me down in their portal": `set <folder> <status> --date <date> --note "<what they said>"`.

## Data

- **Reads:** `applications/`, `criteria.md`, `reports/` (for the window)
- **Writes:** `applications/<folder>/application.md` (Status, dates, a dated note per change), new Application folders, `applications.csv`, `reports/<date>.md`
