# Job Search

A Claude Code plugin that turns one person's exhaustive career record into a resume for a specific job, keeps track of their applications, and watches their inbox for replies. This file is the plugin's vocabulary. Skills, docs and code use these words and avoid the alternatives.

## Language

**Super Resume**:
The single, exhaustive record of the candidate's career: every employer, engagement, project and claim, with the evidence behind each. Every other document is drawn from it.
_Avoid_: master resume, career doc, base resume

**Update** (the Super Resume):
Add or correct Super Resume material after the candidate approves it.
_Avoid_: canonize, ingest, sync

**Job Description (JD)**:
The employer's text for one role, saved as found.
_Avoid_: posting, listing, req

**Generated Resume**:
The resume produced for one JD from the Super Resume. It may choose, reorder and reword Super Resume material, but it never adds to it.
_Avoid_: tailored resume, per-job resume, job resume

**Company Research**:
What an agent learns about the employer before the Job Thesis: mission, values, leadership principles, history, recent news, and the company's other JDs.
_Avoid_: flavor

**Job Thesis**:
Why this employer should hire this candidate for this role: the problems the JD and Company Research reveal, and what in the candidate's history uniquely solves them. It builds a Generated Resume up instead of paring the Super Resume down.
_Avoid_: angle, pitch

**Review** (of a Generated Resume):
A critique of a draft by fresh readers who inherit nothing from the run. It guides revision but never blocks the PDF.
_Avoid_: QA gate, audit

**Edit** (a Generated Resume):
A change the candidate asks for in one Generated Resume after it is produced, described in plain words or made by hand.
_Avoid_: tailor, refine

**Lesson**:
A standing preference learned from the candidate's Edits, such as their voice or what not to emphasize. Later Generated Resumes follow it.

**Gap Note**:
A JD requirement the Super Resume can't support. It is raised with the candidate as a question after the first PDF and never appears in the resume.
_Avoid_: stretch claim

**Evidence**:
The source a Super Resume claim traces to: the candidate's own words, a repo, an email. Interview prep material written to show an idealized version is not Evidence.
_Avoid_: proof, citation

**Do-Not-Use List**:
Material the candidate has ruled off-limits. Every document respects it silently and never mentions it as a warning or caveat.

**Employer**:
Whoever employed the candidate, including "Independent" for self-employment. An Employer owns a continuous date range.
_Avoid_: client, company (when you mean the employer)

**Engagement**:
One client placement during an employment, such as a consultancy's client or a freelancer's customer. It is not a separate job, and its dates never stand in for the Employer's.
_Avoid_: job, gig, role, position

**Project**:
Something the candidate built on their own initiative, with no client and no pay. It is a first-class Super Resume entry with an honest status and is never presented as paid work.
_Avoid_: side project, hobby, engagement

**Resume Weight**:
How readily a Generated Resume may use a Super Resume entry: lead, support or archive. Archive entries are kept for the record and used only when a JD asks for exactly that.
_Avoid_: priority, rank

**Application**:
One role the candidate is pursuing, from the first Generated Resume (or a recruiter's first message) to the outcome, including its JD, documents, status and history.
_Avoid_: job, opportunity, lead

**Inbound**:
An opportunity a recruiter brought to the candidate unasked. It is screened for legitimacy and fit before the candidate is asked whether to pursue it.
_Avoid_: lead, cold outreach

**Status**:
Where an Application stands: inbound, passed, drafted, applied, screening, interviewing, offer, rejected, withdrawn, or ghosted (no reply 30 days after applying).

**Prep**:
Interviews and interview preparation. Prep isn't work history. Only work stories told during Prep can become Super Resume material.

**Cover Letter Draft**:
An outline or first draft of a cover letter for one Application, written for the candidate to rewrite in their own voice. It is never sent as-is.
_Avoid_: cover letter (for the generated output)
