# Subagent briefs

Each brief is the whole prompt for a fresh subagent, so it inherits nothing from the run. Fill in the `<angle-bracket>` paths with absolute paths before sending, and send nothing else: the reviewers' value is that they haven't seen the thesis or the reasoning.

## Company Research

Model: sonnet. Agent type: one with web search and web fetch.

> Research <company> for a candidate applying to the role in <jd.md>. Read the JD first. Gather, with a link for every item:
>
> 1. **The company's own words:** mission, values or leadership principles, history, and engineering blog posts or talks that show how the team works.
> 2. **The last twelve months of news:** launches, funding, acquisitions, layoffs, leadership changes.
> 3. **Other JDs from the same company, above all the same team or org.** They flesh out a thin JD: the team's problems, stack, stage and seniority bar. Fetch a posting with `node <plugin>/scripts/fetch-jd.mjs <url>` (it prints the posting); use web search to find them.
> 4. **The product this team builds:** who uses it, its main surfaces, its scale, and what goes wrong when it's built badly.
> 5. **Guidance for candidates on using AI** in applications or interviews, if the company publishes any: what it allows and asks for.
>
> Fetch at most ten pages in all; search results don't count. Choose the pages that answer the most items, and let a thin section stay thin.
>
> Write `<research.md>` with one section per item, then `## What this means for the hire`: three to five lines on the problems this hire would own. Keep it under about 1,200 words. State facts plainly, mark inference as inference, and write "nothing found" for an empty section rather than padding it. *Done when* every claim has a link or is marked as inference. Reply with one line saying what you found.

## Hiring manager

Model: opus. No web.

> You'll read a candidate's resume twice, in this order, for the role in <jd.md>. You know nothing about the candidate beyond the resume.
>
> **Pass 1, as the recruiter.** Read only the JD's title and its first paragraph, then look at <page1.png>, page 1 as rendered, for about thirty seconds. You screen for this team but you aren't an engineer. Write down, before reading anything else:
> - what this person does and why they might fit, in two sentences
> - every term on page 1 you couldn't explain to the hiring manager
> - every bullet whose point you couldn't say back in your own words
>
> **Pass 2, as the engineering manager.** Now read the whole JD, the company research in <research.md> and the resume in <resume.md>.
>
> Report, as a numbered list:
> 1. **Screen or not**, in two sentences, and why.
> 2. **The recruiter's pass**: your two sentences, the terms and the bullets you couldn't follow.
> 3. **Must-haves the resume doesn't show convincingly**, each with the kind of evidence that would convince you.
> 4. **Strengths this JD wants that the resume could show more strongly or earlier**, including anything the summary should lead with.
> 5. **Bullets a stranger can't follow**: vague about what was owned or achieved, or needing context the reader doesn't have (an internal name, a story's backstory).
> 6. **Trivia**: bullets about implementation detail (a config value, a component name, a line count, a version) instead of impact and responsibility. A count that sizes the work (screens, teams, users) is scope, not trivia.
> 7. **Run-ons**: a sentence that tries to say too much, or that you had to read twice.
> 8. **Hedges and weak ownership**: "most of", "helped", "contributed to", "co-developed", or "led" before a thing.
> 9. **Repetition** across the summary, the skills and the bullets: the same number, artifact or claim in two places.
> 10. **Skills you'd doubt in an interview**: an item no bullet or project shows in use, or a term too narrow for the role.
> 11. **Lines that read badly to a hiring manager**: siloing or friction ("without asking", "pushed back"), self-praise, buzzwords, temperament claims, anything that reads machine-written.
> 12. **Page 1**: whether it carries the strongest matches for this JD.
> 13. **Misreads**: anything that makes a client look like the employer, or makes dates or titles confusing.
>
> Quote the resume text each finding is about. Suggest a direction, not a rewrite, and never suggest a specific fact the resume doesn't contain. Under 900 words.

## Evidence checker

Model: opus. No web.

> Check a resume against the candidate's Super Resume, the single record every claim must trace to. The resume is <resume.md>; the Super Resume is <super-resume.md>; material the candidate has ruled out is in <do-not-use.md>. You haven't seen the job description, and fit and style aren't your concern.
>
> For every summary sentence, bullet and skills item, find the Super Resume text that supports it. Flag each one that is:
> - **unsupported:** no source in the Super Resume
> - **inflated:** bigger than its source: a stronger ownership verb ("led" for "co-led"), a larger scope or number, a team result presented as the candidate's own, or a skill shown deeper than the Super Resume's self-assessment and skills inventory allow
> - **Context as a claim:** supported only by a `#### Context` subsection, which is never resume text
> - **Recall work leading:** work named by a `**Recall:**` line in an entry's Context, shown as one of the first two clients under its Employer or as a client's first bullet (a supporting client whose whole entry the line names is fine)
> - **archived:** an entry whose fact block says `archived: yes` (report it; the writer decides whether the JD asks for exactly that work)
> - **a fact-block mismatch:** a name, title, role or date that differs from its fact block (a role may drop a trailing parenthetical)
> - **a caveat:** a hedge, an explanation of a gap, or a note about who else worked on something
> - **on the Do-Not-Use List**
>
> For each flag give the resume text, the problem, and the closest Super Resume text (quoted, under 25 words, with its heading). End with one line: how many claims you checked and how many were supported. *Done when* every claim is either supported or flagged.

## Skim check

Model: sonnet. No web.

> <page1.png> is page 1 of a resume. Look at it the way a recruiter does in eight seconds, then answer in four short lines:
> 1. Who employed this person from <first year> to <last year>?
> 2. What is their current or most recent title?
> 3. Each company named on the page, and whether it was an employer or a client.
> 4. Anything confusing about who they worked for, or when.

It passes when line 1 names the Employer and line 3 calls no client an employer.

## Parse check

Model: sonnet. No web. Sent only while the template is unproven (step 8).

> You are the resume parser in an applicant tracking system. Read only <resume.txt>, the text extracted from a resume PDF, and fill in the application form an auto-fill would produce. Take every value from the text alone, and leave a field empty when the text doesn't give it. Write this JSON to <form.json>:
>
> ```json
> {
>   "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "github": "",
>   "current_title": "",
>   "work_history": [{ "employer": "", "title": "", "start": "Mon YYYY", "end": "Mon YYYY or Present" }],
>   "education": [{ "school": "", "credential": "", "year": "" }]
> }
> ```
>
> `work_history` lists each job the way the form's employment section would, most recent first. Reply with one line saying how many jobs you found.

Then run `node <plugin>/scripts/check-resume.mjs <resume.md> --form <form.json> --terms <terms.txt> --text <resume.txt>`.
