# The run input

What `/job-search:check-status` hands to `scripts/check-status.mjs run`: one JSON object holding every job thread the search found, each placed in one of three lists. The script refuses input that breaks this shape and lists every problem. Statuses are in `GLOSSARY.md`.

Dates are `YYYY-MM-DD` in the candidate's local time. Gmail's dates are UTC, so evening mail in the Americas carries the next day's date: convert it. One event per email: a second confirmation or rejection for the same Application is harmless, because the script ignores mail it already reflects.

```json
{
  "threads": 41,
  "skipped": 12,
  "events": [
    { "folder": "2026-03-02-example-co-senior-engineer", "type": "rejected", "date": "2026-03-20",
      "evidence": "example.com, \"Update on your application\"" },
    { "company": "Globex", "role": "Staff Engineer", "type": "applied", "date": "2026-03-21",
      "evidence": "greenhouse-mail.io, \"Thanks for applying to Globex\"", "source_url": "", "location": "", "pay_range": "" },
    { "folder": "2026-03-02-initech-frontend", "type": "interviewing", "date": "2026-03-22",
      "evidence": "initech.com, \"Next steps\"", "action": "Pick a time for the panel" }
  ],
  "inbound": [
    { "company": "Vandelay", "role": "Senior Full-Stack Engineer", "date": "2026-03-22",
      "from": "a recruiter at vandelay.com", "evidence": "linkedin.com, \"Pat messaged you\"",
      "source_url": "", "location": "Remote (US)", "pay_range": "$180k-$230k",
      "checks": { "level": "pass", "focus": "pass", "location": "pass", "type": "full-time", "legitimacy": "pass" },
      "reasons": {} }
  ],
  "unmatched": [
    { "date": "2026-03-23", "evidence": "indeed.com, \"Indeed Application: Lead Engineer\"", "why": "the confirmation names no employer" }
  ]
}
```

## Top level

- `threads`: how many job threads the search returned, skipped ones included. `skipped`: how many were job alerts, newsletters or other mail that isn't about an Application. Both are counts for the report's first line and may be left out.
- `since`: only when the mail was searched from a date other than the one `window` printed.

## `events`: mail about an Application

- `type` is what the mail shows: `applied` (a confirmation), `screening` (a recruiter screen, or an assessment invitation before the team interviews), `interviewing` (interviews with the team, a take-home, an onsite), `offer`, `rejected` (declined, filled or closed), `withdrawn` (the candidate's own withdrawal), or `contact` (any other mail from the employer about it: a reschedule, "still reviewing", a reminder, a referral notice, "keep track of your application").
- `folder`: the Application, when the mail plainly belongs to one in the `apps` list. Otherwise give `company` and `role` as the mail names them: the script matches them, or creates a new Application when nothing matches.
- `evidence`: the sender's domain and the subject, quoted. It goes into the Application's notes and the report.
- `action`: only when the mail asks the candidate to do something (pick a time, take an assessment, answer an offer), in one short line.
- `source_url`, `location`, `pay_range`: only for mail about an Application not on the list, and only when the mail states them.

## `inbound`: a recruiter bringing a role the candidate hasn't applied to

Fields as in `events`, plus `from` (who wrote, in a few words: "a recruiter at Acme Staffing, by InMail") and the five judgments against the criteria file. `company` is the employer; when an agency writes for a client it doesn't name, it is the agency's name and "client" ("Acme Staffing client"), because it becomes a folder name.

| Check | Values |
|---|---|
| `level` | `pass`, `fail`, `unknown` |
| `focus` | `pass`, `fail`, `unknown` |
| `location` | `pass`, `fail`, `unknown` |
| `type` | `full-time`, `contract`, `fail` (part-time, internship), `unknown` |
| `legitimacy` | `pass`, `unverified`, `fail` (asks for money, bank details or an ID before any interview) |

`reasons` gives a few words for each `fail`, keyed by check: `{ "focus": "electrical engineering" }`. Leave pay to the script: put the posted range in `pay_range` as written, and it applies the floor from the criteria file. A role already on the `apps` list is an event, not an Inbound.

## `unmatched`: job mail that fits nowhere

`evidence`, `date`, and `why` in a few words: a recruiter who names no role or company, or a confirmation that fits two Applications equally. The script adds the events it can't place itself.
