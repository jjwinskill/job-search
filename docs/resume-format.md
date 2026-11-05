# Resume source format

A Generated Resume is written as Markdown with a fixed shape, `resume.md`, and printed through `templates/resume.css`. The writer owns the words; the template owns the layout, so nothing in the source sets fonts, sizes or spacing.

```bash
node scripts/render-resume.mjs <resume.md> [--text resume.txt] [--png page1.png]   # PDF, page count, breaks, text layer
node scripts/check-resume.mjs <resume.md>                                         # names, titles and dates against the fact blocks
```

## Shape

```markdown
# Jane Doe
Senior Full-Stack Engineer
Springfield, OR | (555) 010-0199 | jane@example.com
[linkedin.com/in/jane](https://www.linkedin.com/in/jane/) | [github.com/jane](https://github.com/jane)

## Professional Summary

One paragraph.

## Technical Skills

- **AI-native development:** Claude Code (skills, plugins, subagents), multi-agent workflows
- **Languages:** TypeScript, SQL

## Professional Experience

### Example Consultancy | Senior Software Engineer (Consultant) | Apr 2016 - Apr 2026

Software consultancy — full-time, embedded on client product teams.

#### Client: Client A — Senior Front-End Engineer | Developer tools

- Bullet.

Other clients: Client C, Client D

### Studio | Software Engineer | Feb 2015 - Feb 2016

- Bullet.

## Selected Projects

### Self-directed projects | Apr 2026 - Present

#### idea-tool | [github.com/jane/idea-tool](https://github.com/jane/idea-tool)

- Bullet.

## Education

- **Example Bootcamp** — Web Development Program | Portland, OR | 2014
```

| Line | Means |
|---|---|
| `# Name` | First line. The next line without ` \| ` is the headline; lines with ` \| ` are contact lines, printed in the page body where parsers read them. |
| `## Section` | A section. Skills and Education items print as lines, not bullets. |
| `### Name \| Title \| Dates` | An Employer (or a group such as the self-directed projects). The trailing date range prints on the right. |
| `#### Client: Name — Role \| Domain` | One Engagement inside the Employer above it, in body-size text with no dates, so the Employer's range owns the timeline. |
| `#### Name \| [link](url)` | One Project inside its group. |
| `Other clients: A, B` | The Engagements not detailed, on one line after the last client. |
| `- ` | A bullet. Indent a continuation line. |

Only links, `**bold**` and `*italic*` are inline Markdown; anything else prints as written.

## What the checks enforce

`check-resume.mjs` compares the source with the Super Resume:
- Each `###` under Experience is an Employer fact block, with its `title` and its `dates` as `Mon YYYY - Mon YYYY` (or `Present`).
- Each `Client:` line and each name on the other-clients line is an Engagement of that Employer; the role is the block's `role` (a trailing parenthetical may be dropped) and the domain is its `domain`.
- Each project is a Project block, with its `link`. Each school is an education block, with its `credential` and year.
- The name and contact lines match the Super Resume's `## Candidate Info`.
- Warnings: an `archived` entry in use, and a non-archived Engagement shown nowhere.

`--form <form.json>` checks a parse-check form instead: what an agent read from the PDF's text alone. A client read as an employer, a missed employer, or a wrong title or date range is a mismatch.

`render-resume.mjs` fails when the PDF runs past `--max-pages` (default 2) or when a source line is missing from its text layer. It warns when page 1 doesn't reach the first Employer and its first client, and when the last page is thin. Its `template` hash changes whenever the template does, so a skim check can say which layout it saw.

Rendering needs Chrome, Chromium, Edge or Brave (or `CHROME_PATH`), and Ghostscript (`gs`) for the page-break, text-layer and page-image checks.
