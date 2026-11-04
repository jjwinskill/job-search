---
name: generate-resume
description: Generate a two-page resume PDF for one job description from the candidate's Super Resume. Use when the user runs /job-search:generate-resume or asks for a resume for a job posting URL, pasted job description or file. Not built yet.
argument-hint: <JD URL, pasted text, or file>
disable-model-invocation: true
---

# generate-resume

**Not implemented yet. Planned for Phase 3.** If this skill is invoked now, tell the user it isn't built yet and stop.

## What it will do

One JD per run. It asks no questions before the PDF exists.

1. **Intake.** Fetch the JD and save its text. If the role is already an Application, stop and say which one.
2. **Company Research.** Cover mission, values, leadership principles, history, the last year of news, and the company's other JDs, especially from the same team.
3. **Job Thesis.** Decide why this candidate, for this job, and pick the Engagements to lead with.
4. **Draft.** Write it with the Super Resume in context.
5. **Review.** Two fresh readers check the draft:
   - a hiring manager, who sees the JD, the research and the draft
   - an evidence checker, who sees the draft and the Super Resume but not the JD

   The writer applies both critiques. Review never blocks the PDF.
6. **Parse check.** An agent reads only the PDF's extracted text, and that text is compared with the Super Resume's fact blocks.
7. **PDF.** Render it at two pages and always deliver it.
8. **Record.** Create or update the Application as `drafted`.

The run hands back:
- the PDF
- the thesis in three lines
- what the reviewers changed and what they flagged
- up to 5 skippable Gap Note questions

## Data

Find the data folder with `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs`. The layout is described in `docs/data-layout.md`.

- **Reads:** `super-resume.md`, `lessons.md`, `do-not-use.md`, `criteria.md`, `applications/`
- **Writes:** `applications/<folder>/` (`application.md`, `jd.md`, `research.md`, `thesis.md`, `resume.md`, `resume.pdf`, `review.md`, `gaps.md`) and `applications.csv`
