# job-search

A Claude Code plugin for a job search. You keep one exhaustive record of your career, called the Super Resume. The plugin turns it into a resume for a specific job description, tracks your applications, and reads your inbox for replies and recruiter outreach.

**Status:** pre-v1. `generate-resume`, `edit-resume`, `update-super-resume` and `check-status` work. `draft-cover-letter` comes next.

| Command | What it does |
|---|---|
| `/job-search:generate-resume <JD URL, text or file>` | Researches the company, writes a Job Thesis, drafts a resume from your Super Resume, has fresh reviewers check it, and renders a PDF. |
| `/job-search:edit-resume` | Applies the changes you describe in plain words and re-renders. Lasting preferences become Lessons that later resumes follow. |
| `/job-search:update-super-resume <what>` | Adds or corrects material in your Super Resume from Evidence, then reports each change for you to veto. It asks only what no source can settle. |
| `/job-search:check-status` | Reads your email (read-only), updates application statuses, and screens recruiter outreach against your criteria. |

The plugin holds no personal data. It reads and writes a private data folder that you point it at. The folder's layout is in [docs/data-layout.md](docs/data-layout.md), and a Generated Resume's source format is in [docs/resume-format.md](docs/resume-format.md).

## How a resume gets made

`/job-search:generate-resume` takes one job description and asks no questions until the PDF exists.

1. **Intake.** It saves the JD as found and creates an Application folder for it.
2. **Company Research.** A subagent reads the company's mission, recent news and its other JDs for the same team.
3. **Job Thesis.** It names the problems this hire would own and maps every requirement to the strongest evidence in your Super Resume, or marks it as a gap. The thesis decides what to feature, never what is true.
4. **Draft.** Each bullet is written from the thesis's plan, not copied from the Super Resume. Scripts check the draft's facts, dates and length.
5. **Review.** Two fresh subagents, a hiring manager and an evidence checker, read the draft with no memory of the run. Their findings guide revision but never block the PDF.
6. **Checks.** A skim check looks at the first page the way a recruiter does. A parse check reads the PDF's text, as an applicant tracking system would.
7. **Record.** The PDF lands in the Application folder with the Super Resume version it came from. Requirements your Super Resume couldn't support come back as Gap Notes: questions for you, never claims in the resume.

## Setup

Requires Node 20 or later, the Claude Code CLI, a Chromium-based browser (Chrome, Chromium, Edge or Brave) to print resumes, and Ghostscript (`brew install ghostscript`) to check their pages and text.

1. Clone the repo and install the plugin from it. A plugin installed from a local marketplace runs straight from the clone, so pulling updates the plugin.

   ```bash
   git clone https://github.com/jjwinskill/job-search.git
   claude plugin marketplace add ./job-search
   claude plugin install job-search@job-search
   ```

2. Point the plugin at your private data folder:

   ```bash
   mkdir -p ~/.config/job-search
   echo '{ "dataDir": "~/path/to/your/data" }' > ~/.config/job-search/config.json
   node job-search/scripts/config.mjs   # prints the resolved paths, or explains what's missing
   ```

   `JOB_SEARCH_DATA_DIR` overrides the config file.

3. Keep the data folder in a private git repo. Git history is where old versions of your Super Resume live, so there's never a second copy to drift.

## Vocabulary

The plugin's words are defined once, in [GLOSSARY.md](GLOSSARY.md), and every skill, doc and script uses them. The ones you'll meet first: **Super Resume**, **Evidence**, **Job Thesis**, **Generated Resume**, **Review**, **Gap Note**, **Lesson** and **Application**.

## Building a Super Resume

The Super Resume is the single, exhaustive record of your career: every employer, engagement, project and claim, with the Evidence behind each. A Generated Resume may choose, reorder and reword its material, but never adds to it. So the resumes are only as good as this file, and it's worth more time than any one resume.

v1 has no command that builds one from scratch. These methods work:

- **Mine your code.** Send an agent through every code base you can still access, with your git author name, to extract what you built, when, and how it fit the larger system.
- **Get grilled for stories.** Have an agent interview you one employer at a time, one question at a time: what you were hired to do, what you actually did, the problems you solved, and which part was yours rather than a teammate's.
- **Answer the common interview questions** out loud or in writing, and keep the answers. Work stories told in interview prep can become Super Resume material, as long as they're true rather than idealized.
- **Research the impact** of each project with hard numbers: users, revenue, traffic, time saved, team size. Link the source.

Then write it in the format in [docs/data-layout.md](docs/data-layout.md): one Markdown file, with a fact block at the top of each entry giving its dates, title and Evidence. `npm run facts` validates the blocks. Once the file exists, `/job-search:update-super-resume` keeps it current, one new project, engagement or correction at a time.

Two habits keep it honest:
- **Every claim traces to Evidence:** your own words, a repo, an email. If an agent wrote it and you can't point to a source, it doesn't belong.
- **State what you did, not what the team did.** Inflated ownership is the most common fault in an AI-drafted career record, and a reviewer can only catch it if the Super Resume is exact.

## How it was built

This plugin replaces [n8n-resume-builder](https://github.com/jjwinskill/n8n-resume-builder), an n8n workflow that did the same job from a web form: normalize the JD, write a Job Thesis, generate a resume, run a QA review, gate it, and render a PDF through Gotenberg. It made the resumes for more than a dozen applications. Reading it back closely showed why it had to change:

- **A gate that never closed.** The QA gate's condition had been hard-wired to `true`, so the refine step was unreachable and every resume shipped as first drafted. Nothing reported it.
- **Rules that probably never reached the model.** The shared house rules sat in system messages that n8n never evaluated as expressions, so the model most likely received the placeholder text instead of the rules.
- **Hand edits that all went one way.** The final resumes were corrected by hand back toward what the source record supported: smaller ownership claims, concrete specifics instead of slogans, shorter summaries.
- **No way to run unattended.** Form triggers only, no run history, and a failure mode of silent shipping.

So the rebuild moved the work into Claude Code skills, which run on a subscription with current models, subagents and web fetching, and leave nothing to host. Each rule that can be checked in code lives in a small tested script, and judgment stays in plain-English skills. Fresh reviewers replace the gate: they inherit nothing from the run, so they read the draft the way a stranger would. Edits feed Lessons, so a correction made once isn't made again.

It was built in phases, each ending in a retro whose fixes landed before the next phase began. Model choices were settled by blind comparison on past job descriptions, with the old n8n resume for the same JD as a control. The plugin is public, and the candidate's data stays in a separate private repo, kept apart by the scan below.

## Contributing: the personal-data scan

This repo is public, so two hooks guard it:
- **Pre-commit** runs the tests and scans the working tree, including untracked files.
- **Pre-push** blocks any push that would publish personal data, including data that was added and later removed in history.

Both read the terms to block from `scan-terms.txt` in your data folder, and both fail closed if that file is missing.

```bash
scripts/install-hooks.sh   # once per clone
npm run scan               # check the working tree any time
npm test
```

Intentionally public text, such as the author's name in `LICENSE`, goes in `.scan-allow` as `path:text`. Only the repo owner adds lines there.

## License

MIT. See [LICENSE](LICENSE).
