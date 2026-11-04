# job-search

A Claude Code plugin for a job search. You keep one exhaustive record of your career, called the Super Resume. The plugin turns it into a resume for a specific job description, tracks your applications, and reads your inbox for replies and recruiter outreach.

**Status:** pre-v1, under construction. The commands below are planned, not working yet.

| Command | What it does |
|---|---|
| `/job-search:generate-resume <JD URL, text or file>` | Researches the company, writes a Job Thesis, drafts a resume from your Super Resume, has fresh reviewers check it, and renders a PDF. |
| `/job-search:edit-resume` | Applies the changes you describe in plain words and re-renders. |
| `/job-search:update-super-resume <what>` | Adds or corrects material in your Super Resume. Every claim needs evidence, and you approve changes in small batches. |
| `/job-search:check-status` | Reads your email (read-only), updates application statuses, and screens recruiter outreach against your criteria. |

The plugin holds no personal data. It reads and writes a private data folder that you point it at.

The vocabulary is defined in [GLOSSARY.md](GLOSSARY.md). More docs, including how to build a Super Resume and how this plugin grew out of an earlier n8n workflow, will be added before v1.

## License

MIT. See [LICENSE](LICENSE).
