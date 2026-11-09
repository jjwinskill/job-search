# Data folder layout

The plugin keeps nothing personal. Everything it reads and writes lives in one private data folder that you own. A private git repo works best, because git history becomes the only store of old versions. Point the plugin at the folder with `JOB_SEARCH_DATA_DIR` or `~/.config/job-search/config.json`, as described in the [README](../README.md#setup). Words in capitals are defined in [GLOSSARY.md](../GLOSSARY.md).

```text
<data folder>/
├── super-resume.md        the Super Resume: exactly one file, no dated copies beside it
├── applications/
│   └── <yyyy-mm-dd>-<company-slug>-<role-slug>/
│       ├── application.md the record (frontmatter below) and running notes
│       ├── jd.md          the Job Description as found
│       ├── research.md    Company Research, with links
│       ├── thesis.md      the full Job Thesis, and a cover letter's plan when one was drafted
│       ├── terms.txt      the JD's must-have terms in its spelling, for the keyword check
│       ├── resume.md      the Generated Resume's source (docs/resume-format.md)
│       ├── resume.pdf     the rendered resume
│       ├── resume.txt     the PDF's extracted text: what a parser reads
│       ├── review.md      what the reviewers found and what changed
│       ├── gaps.md        Gap Note questions and answers
│       ├── cover-letter.md         a Cover Letter Draft's source, which the candidate rewrites
│       ├── cover-letter.pdf        the rendered letter, one page
│       ├── cover-letter.txt        the letter as plain text for a form's paste box, greeting to name
│       ├── cover-letter-review.md  what the letter's reviewers found and what changed
│       └── cover-letter-outline.md notes the candidate writes from, when the employer asks for their own first draft
├── applications.csv       index rebuilt by `npm run index`; never edit by hand
├── lessons.md             Lessons: standing preferences every Generated Resume follows, added to by Edits
├── criteria.md            what the candidate is looking for, used to screen Inbound
├── do-not-use.md          the Do-Not-Use List
├── sources/README.md      optional evidence map: where Evidence lives and how to search it
├── reports/YYYY-MM-DD.md  status reports from /job-search:check-status; the newest one's date starts the next mail window
├── evals/                 evaluation runs, kept apart from real Applications
└── scan-terms.txt         personal terms the pre-push scan blocks, one per line
```

## `super-resume.md`

One Markdown file. It opens with a `## Candidate Info` list (`- Name:`, `- Phone:`, `- Email:`, `- Location:`, `- LinkedIn:`, `- GitHub:`), which Generated Resumes copy into their contact lines and `check-resume.mjs` checks them against. Each Employer, Engagement, Project and education entry opens with a fact block, a fenced `facts` block with its kind, dates, title or role, Evidence, and `archived: yes` for entries kept out of resumes. Prose follows the block. The format is in [skills/update-super-resume/fact-blocks.md](../skills/update-super-resume/fact-blocks.md), and `npm run facts` validates it. Generated Resumes take dates, titles and roles only from fact blocks.

## `application.md` frontmatter

```yaml
company: Example Co
role: Senior Software Engineer
status: drafted            # see Status values below
created: 2026-01-15
applied: 2026-01-16        # empty until applied
last_contact: 2026-01-20
source_url: https://example.com/jobs/123
location: Remote (US)
pay_range: $150k–$190k     # as posted, with its source when that isn't the recruiter's message; empty if not posted
about: Example Co sells payroll software; the role owns its React front end   # optional: what the company and role are, for an Inbound
reply: 2026-01-18 (interested): asked for a call   # optional: the candidate's yes to a recruiter, from check-status
super_resume_version: 3f2a9c1   # commit of super-resume.md the resume came from
template: 0d4e8a3          # resume template hash the PDF was rendered with
skim_check: pass           # optional: pass or fail, when a skim check ran on this template
outcome: offer-declined    # optional: what a status alone can't say
origin: check-status       # optional: how a record began, when /generate-resume didn't make it
```

The body below the frontmatter holds notes: contacts, interview rounds, outcome. `/job-search:check-status` adds one dated line for each change it makes, with the email it came from.

`outcome` is optional free text for a result the status can't carry, such as `offer-declined` (status `withdrawn`) or `offer-accepted`. It becomes a column in the index like any other extra key.

Keep the frontmatter to flat `key: value` lines, and wrap a value in double quotes when it contains `:` or `#`. A key not listed above becomes an extra column in `applications.csv`. `npm run index` refuses to write the index if a record lacks `company`, `role`, `status` or `created`, and it warns about any status not listed below.

### Status values

| Status | Meaning |
|---|---|
| `inbound` | A recruiter brought it unasked, and the candidate hasn't decided yet |
| `passed` | The candidate declined an Inbound |
| `drafted` | A Generated Resume exists, but the candidate hasn't applied |
| `applied` | The application went in |
| `screening` | A recruiter or screening step is underway |
| `interviewing` | Interviews are underway |
| `offer` | An offer arrived |
| `rejected` | The employer declined |
| `withdrawn` | The candidate withdrew |
| `ghosted` | No reply 30 days after applying |

## `scan-terms.txt`

One term per line. Lines starting with `#` are comments. Matching ignores case and matches inside words, so `Smith` also matches `Smithson`. List anything that must never reach a public repo: your name and its variants, email addresses, phone numbers, employers, clients, colleagues, and pay figures. The pre-push scan refuses to run without this file.
