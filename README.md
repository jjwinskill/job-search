# job-search

A Claude Code plugin for a job search. You keep one exhaustive record of your career, called the Super Resume. The plugin turns it into a resume for a specific job description, tracks your applications, and reads your inbox for replies and recruiter outreach.

**Status:** pre-v1, under construction. The commands below are stubs that say they aren't built yet.

| Command | What it does |
|---|---|
| `/job-search:generate-resume <JD URL, text or file>` | Researches the company, writes a Job Thesis, drafts a resume from your Super Resume, has fresh reviewers check it, and renders a PDF. |
| `/job-search:edit-resume` | Applies the changes you describe in plain words and re-renders. |
| `/job-search:update-super-resume <what>` | Adds or corrects material in your Super Resume. Every claim needs Evidence, and you approve changes in small batches. |
| `/job-search:check-status` | Reads your email (read-only), updates application statuses, and screens recruiter outreach against your criteria. |

The plugin holds no personal data. It reads and writes a private data folder that you point it at. The folder's layout is described in [docs/data-layout.md](docs/data-layout.md).

The vocabulary is defined in [GLOSSARY.md](GLOSSARY.md). More docs, including how to build a Super Resume and how this plugin grew out of an earlier n8n workflow, will be added before v1.

## Setup

Requires Node 20 or later and the Claude Code CLI.

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

## Contributing: the personal-data scan

This repo is public, so a pre-push hook blocks any push that would publish personal data, including data that was added and later removed in history. It reads the terms to block from `scan-terms.txt` in your data folder, and it fails closed if that file is missing.

```bash
scripts/install-hooks.sh   # once per clone
npm run scan               # check the working tree any time
npm test
```

Intentionally public text, such as the author's name in `LICENSE`, goes in `.scan-allow` as `path:text`.

## License

MIT. See [LICENSE](LICENSE).
