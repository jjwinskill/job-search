---
name: update-super-resume
description: Update the candidate's Super Resume from Evidence, applying sourced changes and reporting them for the candidate to veto. Use for a new project or engagement, a story or fact from a session, a correction, drift spotted in Generated Resumes, or Gap Note answers that add facts.
argument-hint: <what to add or correct>
---

# update-super-resume

An **Update** changes the Super Resume, the candidate's single source of truth. Every claim in it must trace to **Evidence**. The candidate rarely remembers the detail you can reach, so you decide from the sources and the candidate reviews a short report of what changed. The vocabulary is in `${CLAUDE_PLUGIN_ROOT}/GLOSSARY.md`.

## Steps

1. **Locate.** Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs` to find the data folder. Read `super-resume.md` and `do-not-use.md` there, and `sources/README.md` when it exists: the map of where this candidate's Evidence lives and how to search each source.
   - If the data folder is a git repo, make sure it's clean and work on a branch named `update/<slug>`. A large Update, such as a first baseline, may use a branch the user names.
   - *Done when* you're on a clean branch with those files read.

2. **Scope.** Restate what the user asked for in one line: the entries it touches, and whether each is new or a correction.
   - *Done when* the user hasn't objected to the scope line.

3. **Gather Evidence.** Search every source the evidence map lists. Without a map, read:
   - the user's own words in session transcripts (`~/.claude/projects/**/*.jsonl`, the user's messages), the strongest source
   - repositories (`git log --author`, the code itself)
   - email (read-only)
   - any files the user points to

   For wide digging, send a subagent and point it at the glossary, `fact-blocks.md` and the evidence map instead of restating them. Have it return claims with their sources, not prose.
   - *Done when* every candidate claim has a source, or is on the question list for step 4.

4. **Ask** only what no source settles *and* would change a resume: what the candidate personally built, a number, a date, a status. Three questions at most per round.
   - Each question stands on its own in plain words: name the entry, quote what the Super Resume says now, and say what the answer would change. Spell out abbreviations.
   - Never ask who else did what, unless a claim would put the candidate's name on work they didn't touch.
   - Never ask about format. Headings, fact-block placement and field names follow [fact-blocks.md](fact-blocks.md).
   - *Done when* the question list is empty, or the user has said to skip what remains.

5. **Draft** each change as **Before / After / Source**, one or two sentences each. Never paste whole sections.
   - A new entry's first change is its fact block: see [fact-blocks.md](fact-blocks.md).
   - A change to a date, title or role changes the fact block first.
   - Follow the rules below.
   - *Done when* every claim in an After has its Source.

6. **Apply and report.** Apply the drafted changes, one commit per Employer (Projects count as one Employer), naming the entry and the gist. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/fact-blocks.mjs` after each commit and fix anything it reports. Then report each commit as a short list, one line per change: what changed and its source, in plain words. The user can veto or change any line; revert or fix exactly what they name.
   - *Done when* every change is committed and reported, the validator exits 0, and the user's vetoes are applied.

7. **Finish.** Report what changed in a few lines, with the commits. If you worked on a branch, ask whether to merge it.

## Rules

- **Precedence.**
  - The candidate's own words beat the current Super Resume.
  - When the candidate's words and a repo disagree, use the candidate's words and flag the conflict in the Source.
  - Newer beats older.
- **Nothing is invented.** No number, date, title, scope, team size or skill level appears without a source. A plausible detail with no source is a question, not a claim.
- **Impact, not trivia.** Ask "would this go on a resume?" Keep what a recruiter weighs when judging whether the candidate can solve their problems: impact, responsibilities, ownership, scale and results. Implementation detail (a config value, an image format, a component's name) is Evidence behind a claim, not a claim: cite it in a Source or leave it out.
- **Interview prep isn't Evidence** when it describes an idealized "best version" of the work. What the candidate said about the real work, in any session, is Evidence.
- **Ownership.** Describe what the candidate did. Keep other people's contributions out of the wording unless they're needed to keep a claim true.
- **The Do-Not-Use List** in `do-not-use.md` is applied silently. Listed material is left out, and nothing mentions that it was.
- **Context, not bullets.** Some material is true but isn't resume material: working style, philosophy, how a decision felt, lessons learned. Put it under a `#### Context (for cover letters and interviews, not resume bullets)` subsection of the entry it belongs to. Generated Resumes never turn Context into bullets. Cover Letter Drafts and the Job Thesis may draw on it.
- **Recall notes.** When the candidate says they remember little of an entry, add one line to its Context starting `**Recall:**`. A low-recall entry can support a resume with what the Evidence shows, but it never carries a lead client or a story the candidate would be asked to tell in an interview.
- **Every entry is eligible for resumes by default**, because relevance is judged per JD. Mark `archived: yes` only for work the candidate wants on record but out of resumes unless a JD asks for exactly that.
