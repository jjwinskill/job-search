# Finding job mail in Gmail

Reference for `/job-search:check-status`. These query patterns worked on a real six-month sweep. Statuses and their meanings are in `GLOSSARY.md`, and the record fields are in `docs/data-layout.md`. Use those, not your own words.

## Window

- **No history yet** (no `reports/` in the data folder): sweep the last 6 months.
- **History exists:** fetch only mail since the date of the newest report. Re-sweeping old mail costs hundreds of thousands of tokens and finds nothing new.

## Cheapest first

1. Search with `THREAD_VIEW_SUMMARY` and read the subject, sender and snippet. Most confirmations and rejections can be decided from those three.
2. Open a full thread (`get_thread`) only when the status depends on the body. For example, a subject like "Update on your application" can mean an interview or a rejection.
3. Read-only, always: never send, draft, label, archive or delete.

## Queries

Add `after:YYYY/MM/DD` for the window. `in:anywhere` includes archived mail.

| Looking for | Query |
|---|---|
| Confirmations | `subject:(applying OR application OR "application received") -category:promotions` |
| ATS senders | `from:(greenhouse-mail.io OR ashbyhq.com OR myworkday.com OR myworkdayjobs.com OR smartrecruiters.com OR icims.com OR workablemail.com OR gem.com OR lever.co OR successfactors.com OR taleo.net OR jobvite.com OR amazon.jobs OR governmentjobs.com OR newtonsoftware.com)` |
| Rejections | `(unfortunately OR "not moving forward" OR "other candidates" OR "decided to pursue")` |
| Interviews | `(interview OR schedule OR calendly OR goodtime OR "next steps")` |
| Offers | `(offer OR "offer letter")` |
| Recruiter outreach | `from:linkedin.com ("messaged you" OR InMail OR "sent you a message")`, plus direct mail from people with recruiting titles |
| Indeed | `from:indeed.com subject:"Indeed Application"`. These confirmations name the role but not the employer. |

## Known limits

- **Spam can't be read.** The connector filters it out, so `in:spam` returns nothing even when the folder isn't empty. Every report reminds the user to check spam by hand for recruiter outreach since the last report. A filter for known domains isn't enough, because real recruiters from new startups won't be on any list.
- **Rejections that went elsewhere.** Some employers reject only inside their own portal. No email doesn't mean no outcome, so ask the user before calling a long silence `ghosted` when they remember otherwise.
- **LinkedIn notifications show only part of a message.** Replies sent inside LinkedIn never reach Gmail.
