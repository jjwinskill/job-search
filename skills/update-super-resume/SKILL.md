---
name: update-super-resume
description: Update the candidate's Super Resume, adding or correcting material in small batches the candidate approves, every claim traced to Evidence. Use for a new project or engagement, a story or fact from a session, a correction, drift spotted in Generated Resumes, or Gap Note answers that add facts.
argument-hint: <what to add or correct>
---

# update-super-resume

An **Update** changes the Super Resume, the candidate's single source of truth. Every claim in it must trace to **Evidence**, and the candidate approves every change. The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`.

## Steps

1. **Locate.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs` to find the data folder. Read `super-resume.md` and `do-not-use.md` there.
   - If the data folder is a git repo, make sure it's clean and work on a branch named `update/<slug>`. A large Update, such as a first baseline, may use a branch the user names.
   - *Done when* you're on a clean branch with both files read.

2. **Scope.** Restate what the user asked for in one line: the entries it touches, and whether each is new or a correction.
   - *Done when* the user hasn't objected to the scope line.

3. **Gather Evidence before asking.** Read the sources first:
   - the user's own words in session transcripts (`~/.claude/projects/**/*.jsonl`, the user's messages), the strongest source
   - repositories (`git log --author`, the code itself)
   - email (read-only)
   - any files the user points to

   For wide digging, send a subagent and point it at the glossary and `fact-blocks.md` instead of restating them. Have it return claims with their sources, not prose.
   - *Done when* every candidate claim has a source, or is on the question list for step 4.

4. **Ask** only what the sources can't answer. Ask specific questions, three at most per round: what the candidate personally built, a number, a date, a status.
   - Never ask an open "tell me about X."
   - Never ask who else did what, unless a claim would put the candidate's name on work they didn't touch.
   - *Done when* the question list is empty, or the user has said to skip what remains.

5. **Draft** each change as a numbered item with **Before / After / Source**, one or two sentences each. Never paste whole sections.
   - A new entry's first item is its fact block: see [fact-blocks.md](fact-blocks.md).
   - A change to a date, title or role changes the fact block first.
   - Follow the rules below.
   - *Done when* every claim in an After has its Source.

6. **Review in batches.** Show at most 8 items at a time, one Employer per batch (Projects count as one Employer). The user answers each item: `ok`, `change: …` or `drop`.
   - Apply only what's approved, re-showing any item marked `change`.
   - Commit after each batch, naming the entry and the gist.
   - *Done when* every item has an answer and the approved ones are committed.

7. **Validate.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/fact-blocks.mjs`.
   - *Done when* it exits 0.

8. **Finish.** Report what changed in a few lines, with the commits. If you worked on a branch, ask whether to merge it.

## Rules

- **Precedence.**
  - The candidate's own words beat the current Super Resume.
  - When the candidate's words and a repo disagree, use the candidate's words and flag the conflict in the Source.
  - Newer beats older.
- **Nothing is invented.** No number, date, title, scope, team size or skill level appears without a source. A plausible detail with no source is a question, not a claim.
- **Interview prep isn't Evidence** when it describes an idealized "best version" of the work. What the candidate said about the real work, in any session, is Evidence.
- **Ownership.** Describe what the candidate did. Keep other people's contributions out of the wording unless they're needed to keep a claim true.
- **The Do-Not-Use List** in `do-not-use.md` is applied silently. Listed material is left out, and nothing mentions that it was.
- **Context, not bullets.** Some material is true but isn't resume material: working style, philosophy, how a decision felt, lessons learned. Put it under a `#### Context (for cover letters and interviews, not resume bullets)` subsection of the entry it belongs to. Generated Resumes never turn Context into bullets. Cover Letter Drafts and the Job Thesis may draw on it.
- **Every entry is eligible for resumes by default**, because relevance is judged per JD. Mark `archived: yes` only for work the candidate wants on record but out of resumes.
- **Would it go on a resume?** Propose only material a resume could use. Anything true but not resume material goes under Context without asking.
