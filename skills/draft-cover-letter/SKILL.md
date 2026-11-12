---
name: draft-cover-letter
description: Write a one-page Cover Letter Draft for one Application from its Company Research, Job Thesis and the Super Resume, checked by fresh reviewers and rendered to PDF, for the candidate to rewrite in their own voice.
argument-hint: [application]
disable-model-invocation: true
model: opus
---

# draft-cover-letter

Write a **Cover Letter Draft** for one Application: a short letter carrying the candidate's motivation and the story behind their strongest claim, built on the material `/job-search:generate-resume` left in the Application folder. The candidate rewrites it in their own voice; it is never sent as-is. One question comes before the draft, and it can be skipped. The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`.

Every writing step follows [letter-rules.md](letter-rules.md). The subagent prompts are in [briefs.md](briefs.md). Throughout, `<plugin>` is `${CLAUDE_PLUGIN_ROOT}` and `<app>` is the Application folder.

## Steps

1. **Locate.** Run `node <plugin>/scripts/config.mjs` for the data folder. Find the Application the user named by folder, company or role; with none named, take the newest Application that has a `resume.md`. If two match, ask which.
   - Read its `jd.md`, `research.md`, `thesis.md`, `resume.md`, `gaps.md` and `application.md`. Then read `lessons.md` (with any letters it names as voice models), `do-not-use.md`, and the whole `super-resume.md`.
   - **The letter reuses the resume's research.** `/job-search:generate-resume` leaves `research.md` and `thesis.md` in the Application folder, and the letter builds on both; it runs no research of its own. If `research.md` is over 30 days old, say so in one line and carry on.
   - **A letter without a resume** is the exception. Say plainly that no Generated Resume exists, and offer to run `/job-search:generate-resume` first. If the candidate wants only the letter: with no Application yet, run generate-resume's Intake (its step 2); then send its Company Research brief (`<plugin>/skills/generate-resume/briefs.md`) to write `<app>/research.md`, so a later resume reuses it. Without a `thesis.md`, step 3's plan maps the JD's top problems to the Super Resume itself.
   - **The employer's guidance for candidates on using AI** comes from `research.md`. Research written before the brief asked for it lacks the section: say so in one line, search the company's careers site once, and append what you find (or "nothing found"), with its link, to `research.md` under `## Guidance for candidates on using AI`.
   - If `<app>/cover-letter.md` exists, ask before replacing it. Git keeps the old one.
   - *Done when* one Application is chosen, its research and thesis (or the candidate's choice of a letter-only run) are settled, its files, the Lessons and the whole Super Resume are in context, and the AI guidance is known or recorded as absent.

2. **The motivation question.** Ask the candidate one question, and wait for the answer: what's their real reason for wanting this company or role? A product they use, a referral, a problem the company solves that they care about. Say they can skip it.
   - The answer is the letter's motivation, used under letter-rules.md, Truth. It isn't career material, so it stays out of the Super Resume.
   - A skip leaves a marked spot (letter-rules.md, Shape).
   - *Done when* there's an answer or a skip.

3. **Plan.** Add `## Cover letter plan` to `<app>/thesis.md`, replacing any earlier one:
   - **Motivation:** the candidate's answer, and any reframing letter-rules.md calls for; or the marked spot's questions.
   - **Story:** the strongest evidence for the team's top problem: the context, the candidate's decision, the result, its checkable detail, and the Super Resume lines it rests on (the entry and the accomplishment, note or Context). Say what it adds that the resume's bullet can't. Add the second example, if any, the same way.
   - **The company:** one specific reference from `research.md`, with its link, and the candidate's experience it ties to.
   - **Close:** the last line, what the candidate wants to bring to the team's work, tied to the motivation; or none, ending on the story. Never an offer to talk anything through (letter-rules.md, Shape).
   - **Words to use:** the JD's terms for its top one or two requirements, where the Super Resume supports them.
   - *Done when* every claim in the plan names its Super Resume lines and the company reference has a link.

4. **Draft, or outline.**
   - **Outline** when the employer's guidance asks for the candidate's own first draft, or the candidate asks for one: write `<app>/cover-letter-outline.md` from the plan, as notes the candidate writes from (the motivation questions, the story's facts and sources, the company reference, the close, the length), then go to step 6. When the candidate's own `cover-letter.md` exists, a later run reviews it with step 4's script and step 5's reviewers, without rewriting it.
   - **Draft** otherwise: write `<app>/cover-letter.md` from the plan, following letter-rules.md and every Lesson, each sentence from its plan line. Run `node <plugin>/scripts/render-cover-letter.mjs <app>/cover-letter.md --text <app>/cover-letter.txt`. Fix every error, and every warning except the marked spot a skip left.
   - *Done when* the outline is written, or the script exits 0 on one page with 200-300 words.

5. **Review.** Send the Hiring manager and Evidence checker briefs in parallel, as two fresh subagents.
   - Weigh every finding. Apply what improves the letter; fix every evidence flag.
   - Write `<app>/cover-letter-review.md`: each reviewer's findings in a line each, what changed, and what was left and why.
   - Re-run the render.
   - *Done when* every finding is applied or listed as left with a reason, and the script exits 0.

6. **Record.** Add one body line to `application.md`: the date, that `/draft-cover-letter` made a draft or an outline, the employer's AI guidance in a few words, and the motivation answer when there was one, so later application answers can reuse it. If the data folder is a git repo, commit the Application folder as `Draft cover letter: <company>, <role>`. The commit keeps the draft, so the candidate's rewrite later shows as a diff.
   - *Done when* the commit exists (or the files are written, outside git).

7. **Hand back**, in this order:
   - the PDF path, and the `.txt` path for a form's paste box (or the outline's path)
   - the word count, and whether the opening is the candidate's motivation or a marked spot to fill; any reframing of their answer, and why
   - the story it tells, in a line
   - what the reviewers changed, and what they flagged that was left
   - the employer's AI guidance, when it asks anything of the candidate
   - how to rewrite: in their own words, starting from the motivation and the story, since an edited draft keeps the drafter's style; then re-render with `--draft` (see below) to see which sentences survived

## Rewrites teach

When the candidate has rewritten the letter, render it against the draft: save the draft from the `Draft cover letter` commit (`git -C <data> show <commit>:<app path>/cover-letter.md > <tmp>/draft.md`), then run `node <plugin>/scripts/render-cover-letter.mjs <app>/cover-letter.md --text <app>/cover-letter.txt --draft <tmp>/draft.md`. Show the candidate the runs their rewrite kept from the draft. Offer each lasting preference the rewrite shows, such as a way they always open or a phrase they always cut, as a Lesson under `## Cover letters` in `lessons.md`, the way `/job-search:edit-resume` does for resumes. A choice that only fits this company isn't a Lesson. A fact the rewrite adds that the Super Resume lacks is offered as an Update (`/job-search:update-super-resume`).

## Data

- **Reads:** `applications/<folder>/` (`jd.md`, `research.md`, `thesis.md`, `resume.md`, `gaps.md`, `application.md`), `super-resume.md`, `lessons.md`, `do-not-use.md`
- **Writes:** `applications/<folder>/` (`cover-letter.md`, `cover-letter.pdf`, `cover-letter.txt`, `cover-letter-review.md` or `cover-letter-outline.md`, the plan in `thesis.md`, a line in `application.md`)
