# Finding job mail in Gmail

Reference for `/job-search:check-status`, from a real six-month sweep and a one-week test. Read-only, always: search, read and list labels, nothing else.

## Queries

Add the window's `query` term to each. Archived mail is searched by default.

| Looking for | Query |
|---|---|
| Confirmations | `subject:(applying OR application OR "application received") -category:promotions` |
| ATS senders | `from:(greenhouse-mail.io OR greenhouse.io OR ashbyhq.com OR myworkday.com OR myworkdayjobs.com OR smartrecruiters.com OR icims.com OR workablemail.com OR gem.com OR lever.co OR successfactors.com OR taleo.net OR jobvite.com OR amazon.jobs OR governmentjobs.com OR newtonsoftware.com OR rippling.com)` |
| Rejections | `(unfortunately OR "not moving forward" OR "move forward" OR "other candidates" OR "decided to pursue") -category:promotions -category:social` |
| Interviews | `subject:(interview OR interviews OR "next steps" OR availability OR scheduling OR scheduled OR onsite OR "phone screen" OR assessment OR "take home") -category:promotions -category:social` |
| Offers | `offer -category:promotions -category:updates -category:social -category:forums` |
| LinkedIn messages | `from:linkedin.com ("messaged you" OR InMail OR "sent you a message")` |
| Recruiters writing directly | `(role OR position OR opportunity OR hiring) ("your background" OR "your experience" OR "your profile" OR "reaching out" OR "came across" OR "a client" OR "my client" OR "our client" OR "appeal to you" OR "open to") -category:promotions -category:social -from:(linkedin.com OR indeed.com OR glassdoor.com OR ziprecruiter.com OR substack.com)` |
| Indeed | `from:indeed.com subject:"Indeed Application"` |
| The candidate's replies | `in:sent (role OR position OR opportunity OR interview OR interviews OR application OR offer OR recruiter OR resume OR hiring OR "job description")` |

Why they're shaped this way, from two months of real mail:
- **Interviews match on the subject.** The same words in the body matched 200 newsletters and prep-course mail in two months; in the subject, 63 threads.
- **Offers search the Primary tab only,** by excluding the other tabs: the connector ignores `category:primary`. `offer` anywhere else matches every sale, and narrow phrases ("offer letter") missed a real offer worded "the offer we presented".
- **Direct recruiters need a role word and an outreach phrase.** Either alone matched 200 threads in two months. Agency mail often says "we have a client" rather than naming the employer.
- **The candidate's replies find the threads they engaged in,** including ones the other queries miss: an agency's thread after a LinkedIn chat, or a friend's intro that names no role. Over six months it returned 38 threads and none of the spam reports, unsubscribes or personal mail in the sent folder.

## Reading cheaply

1. The summary view shows each thread's newest message, and that is often enough: confirmations and most rejections are clear from the sender, subject and snippet.
2. When the candidate wrote in a thread (`labelIds` has `SENT`), open it with `get_thread` in the `MINIMAL` format: each message's sender, date and snippet. Their reply can close the role or move it on, and it often explains why. When a snippet cuts their answer off, open just that message with `get_message` (`PLAIN_TEXT`). A whole interview thread as plain text can run to hundreds of KB.
3. When a recruiter thread has several messages, open it before judging the role: the first message carries the role, pay and location, and the newest is often a bare follow-up.
4. Otherwise open a body only when the snippet leaves the type open. "Thanks for letting me know" under "Update on your interview" is a rejection, and the employer's message says so.

## What the mail looks like

- **Parent and brand names differ.** A subsidiary's interviews can arrive under its parent's name ("Interview with <parent>"), from the ATS or a calendar invite. Match on the sender's domain and the role title, and give the `folder`.
- **The candidate's own mail** counts when it decides something: withdrawing, turning a role down, or saying yes to a recruiter. Their thank-yous, follow-ups and scheduling notes change nothing, though the employer messages in the same thread count.
- **Calendar invites and ATS reminders** for an interview are `interviewing` events.
- **LinkedIn message notifications** carry no message text, only the sender's name, and the body (`PLAIN_TEXT`) adds their headline. A recruiting or talent headline is outreach to screen. Anyone else (a peer engineer, a friend) is skipped. One message can send a notification a day for a week: record it once, at its first date, and count the rest as skipped. When it names no role or company, it is unmatched ("recruiter, no role named"), so the candidate can read it in LinkedIn.
- **Indeed confirmations** name the role but not the employer. The company is "Unknown (via Indeed)" unless the employer's own confirmation arrived within minutes, in which case they are one Application.
- **Noise the queries can't exclude:** interview-prep services, newsletters that happen to say "unfortunately" or "assessment", job-board community digests, government employment-program mail, account notices from sites the candidate signed into. Skip them and count them.

## Known limits

- **Spam can't be read.** The connector filters it out, so `in:spam` returns nothing even when the folder isn't empty. Every report tells the candidate to check spam by hand since the last report. A filter for known domains isn't enough, because real recruiters from new startups won't be on any list.
- **Rejections that never reach email.** Some employers reject only inside their own portal, so no email doesn't mean no outcome. The 30-day rule marks the silence `ghosted`; the candidate corrects it with `set` when they know otherwise.
- **LinkedIn replies stay in LinkedIn.** A conversation continued there never reaches Gmail, so a role the candidate declined in LinkedIn stays open until they say so.
