---
name: edit-resume
description: Change one Generated Resume from plain-word instructions and re-render it, or re-render after a hand edit. Lasting preferences become Lessons.
argument-hint: [application] <what to change>
disable-model-invocation: true
model: opus
---

# edit-resume

Apply the candidate's **Edits** to one Generated Resume, re-render it, and keep any lasting preference as a **Lesson** so later resumes follow it. An Edit changes this resume, not the Super Resume. Typical requests: "that's not my voice", "don't emphasize that", "you left something out". The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`; `<plugin>` is `${CLAUDE_PLUGIN_ROOT}` and `<app>` is the Application folder.

## Steps

1. **Locate.** Run `node <plugin>/scripts/config.mjs` for the data folder. Find the Application the user named by folder, company or role; with none named, take the newest Application that has a `resume.md`. If two match, ask which. Read its `resume.md`, `jd.md` and `thesis.md` (when present), then `lessons.md`, `<plugin>/skills/generate-resume/writing-rules.md` and the whole `super-resume.md`.
   - *Done when* one Application is chosen and its files are read.

2. **Sort the requests.** With no instructions, the user edited `resume.md` by hand: go to step 4. Otherwise sort each requested change:
   - **Wording, voice, emphasis or order**, or **material the Super Resume already has**: apply it under the writing rules.
   - **A fact the Super Resume doesn't have** (a new number, project, title or date): leave it out of the resume and offer an Update, `/job-search:update-super-resume`, with the user's words as its Evidence. Apply it here once the Update has landed.
   - *Done when* every request is applied or waiting on an offered Update.

3. **Apply.** Edit `<app>/resume.md`. Keep each claim no bigger than its Super Resume source, even when the request is to make something sound stronger.
   - *Done when* `node <plugin>/scripts/check-resume.mjs <app>/resume.md` exits 0.

4. **Re-render.** `node <plugin>/scripts/render-resume.mjs <app>/resume.md --text <app>/resume.txt`. Over the page limit, cut the weakest material and say what went. If an Employer line, title, date or school changed, run the Parse check from `<plugin>/skills/generate-resume/briefs.md`.
   - *Done when* the render exits 0, and the parse check passes when it ran.

5. **Lessons.** For each Edit, ask whether the candidate would want it in every resume: a voice preference, something to always or never emphasize, a phrasing they dislike. Tailoring for this one JD isn't a Lesson. Add each new Lesson to `lessons.md` under `## From Edits` as one line ending `(Edit, <app folder>, <date>)`; refine an existing Lesson instead of adding a near-duplicate.
   - *Done when* every Edit is either a Lesson or judged specific to this JD.

6. **Record.** Add one body line to `application.md`: the date and the gist of the Edit. Update its `template` value if the render reported a new one. If the data folder is a git repo, commit the Application folder and `lessons.md` as `Edit resume: <company>, <role>`.

7. **Hand back**: the PDF path and page count, each change in one line, each new Lesson in one line (the user can veto any), and any Update offered.

## Data

- **Reads:** `applications/<folder>/` (`resume.md`, `jd.md`, `thesis.md`), `super-resume.md`, `lessons.md`
- **Writes:** `applications/<folder>/` (`resume.md`, `resume.pdf`, `resume.txt`, `application.md`) and `lessons.md`
