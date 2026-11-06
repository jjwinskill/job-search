---
name: generate-resume
description: Generate a two-page resume PDF for one job description from the Super Resume, with Company Research, a Job Thesis, fresh reviewers and a parse check.
argument-hint: <JD URL, pasted text, or file>
disable-model-invocation: true
model: opus
---

# generate-resume

Turn one JD and the candidate's Super Resume into a **Generated Resume**: built up from a **Job Thesis**, checked by fresh reviewers, rendered to a two-page PDF. One JD per run, and no questions before the PDF exists. The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`.

Every writing step follows [writing-rules.md](writing-rules.md). The subagent prompts are in [briefs.md](briefs.md). Throughout, `<plugin>` is `${CLAUDE_PLUGIN_ROOT}` and `<app>` is the Application folder.

## Steps

1. **Set up.** Run `node <plugin>/scripts/config.mjs` for the data folder. Read, in full, `super-resume.md`, `lessons.md` and `do-not-use.md`, and `criteria.md` if it exists. Note the Super Resume's version: `git -C <data> log -1 --format=%h -- super-resume.md`, and warn if `super-resume.md` has uncommitted changes.
   - *Done when* the Super Resume is in context in full and you have its version.

2. **Intake.** Save the JD before anything else.
   - A URL: if any `applications/*/application.md` already has this `source_url`, stop and name that Application. Otherwise run `node <plugin>/scripts/fetch-jd.mjs <url> --out <data>/applications/.intake/jd.md`. If it exits 1, read the page with the browser's page-text tool and save that verbatim with the same header lines; if that fails too, ask the user to paste the posting.
   - Pasted text or a file: save it verbatim with a `- Source:` line saying where it came from and the date.
   - Create `<app>` as `applications/<yyyy-mm-dd>-<company-slug>-<role-slug>`, move `jd.md` into it, and write `application.md` with `company`, `role`, `status: drafted`, `created`, `source_url`, `location` and `pay_range` as posted (frontmatter format in `<plugin>/docs/data-layout.md`). If an Application for the same company and role exists, stop and name it.
   - If `criteria.md` sets a pay floor and the posted range tops out below it, say so in one line and carry on.
   - *Done when* `<app>/jd.md` holds the posting as found, with its source.

3. **Company Research.** If another Application at the same company has a `research.md` under 30 days old, copy it in and have the research agent add only this role's team JDs. Otherwise send the Company Research brief.
   - *Done when* `<app>/research.md` exists and its claims carry links.

4. **Job Thesis.** Write `<app>/thesis.md` from the JD, the research and the whole Super Resume. It decides what to feature, never what is true.
   - **What the team builds**, in one concrete sentence, and the three to five problems this hire would own.
   - **Must-haves**: each JD requirement mapped to the strongest Super Resume evidence, or marked as a gap.
   - **Clients**: score every eligible Engagement for this JD on relevance to the must-haves, ownership, strength of evidence and recency, then pick the lead and supporting clients that cover the most must-haves with the strongest evidence (see writing-rules.md, Experience). Give each pick a reason, and name its first bullet: the work nearest this team's problem.
   - **Lead with**: the one accomplishment the reader should meet first.
   - **Likely objection** and the evidence that quietly answers it, never argued in prose.
   - **Summary plan**: what each of its two or three sentences covers (the candidate's identity, the team's problem and why the candidate solves it, the AI practice when the lessons call for it, the pointer to work a reader can open), and the JD nouns it uses. None of it repeats a bullet's specifics.
   - **Gap Notes**: up to five questions, each a JD requirement the Super Resume doesn't settle.
   - **In three lines**: the thesis, for the run summary.
   - *Done when* every JD must-have is mapped to evidence or listed as a gap, and every Engagement has a score.

5. **Draft.** Write `<app>/resume.md` in the shape of `<plugin>/docs/resume-format.md`, following the thesis, the writing rules and every Lesson. Then:
   - `node <plugin>/scripts/check-resume.mjs <app>/resume.md`: fix every error, and every warning the thesis doesn't justify.
   - `node <plugin>/scripts/render-resume.mjs <app>/resume.md --png <tmp>/page1.png` (`<tmp>` is a fresh `mktemp -d`): cut or add until it fits the page limit and the last page is well used.
   - *Done when* both scripts exit 0.

6. **Review.** Send the Hiring manager and Evidence checker briefs in parallel, as two fresh subagents.
   - Weigh every finding. Apply what improves the resume, pulling better material from the Super Resume where the hiring manager found a gap the Super Resume can fill. Fix every evidence flag except an archived entry the JD asks for.
   - Write `<app>/review.md`: each reviewer's findings in a line each, what changed, and what was left and why.
   - Re-run both scripts.
   - *Done when* every finding is applied or listed as left with a reason, and both scripts exit 0.

7. **Skim check.** Count the Applications whose frontmatter has this `template` hash and `skim_check: pass` (the hash is in the render report). Under five, send the Skim check brief with `<tmp>/page1.png`, and record `skim_check: pass` or `fail` in `application.md`. A fail is a template problem: report it, don't work around it in this resume.
   - *Done when* the check ran, or five passes on this template made it unnecessary.

8. **Parse check.** Render with `--text <app>/resume.txt`, send the Parse check brief, then run `check-resume.mjs` with `--form`. Fix each mismatch in the source and re-render; if one can't be fixed in the source, report it.
   - *Done when* the form matches the fact blocks, or the remaining mismatch is in the report.

9. **Record.** Final render: `node <plugin>/scripts/render-resume.mjs <app>/resume.md --text <app>/resume.txt` must exit 0. Add `super_resume_version` and `template` to `application.md`, and one body line: the date and that `/generate-resume` made it. Write `<app>/gaps.md` with the Gap Note questions. Rebuild the index with `node <plugin>/scripts/build-index.mjs`. If the data folder is a git repo, commit the Application folder and the index as `Generate resume: <company>, <role>`.
   - *Done when* the commit exists (or the files are written, outside git).

10. **Hand back**, in this order:
    - the PDF path
    - the thesis in three lines
    - what the reviewers changed, and what they flagged that was left
    - the Gap Note questions, numbered, marked skippable. Answers go in `gaps.md`; one that adds a fact to the Super Resume is offered as an Update (`/job-search:update-super-resume`).

## Data

- **Reads:** `super-resume.md`, `lessons.md`, `do-not-use.md`, `criteria.md`, `applications/`
- **Writes:** `applications/<folder>/` (`application.md`, `jd.md`, `research.md`, `thesis.md`, `resume.md`, `resume.pdf`, `resume.txt`, `review.md`, `gaps.md`) and `applications.csv`
