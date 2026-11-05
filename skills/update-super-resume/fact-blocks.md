# Fact blocks

Every Employer, Engagement, Project and education entry in the Super Resume opens with a fact block. It's a fenced code block tagged `facts`, placed right under the entry's heading, with prose after it. Generated Resumes take dates, titles and roles **only** from fact blocks, so the prose can tell the story and the facts stay checkable. `node ${CLAUDE_PLUGIN_ROOT}/scripts/fact-blocks.mjs` parses and validates them.

````markdown
### Client A

```facts
kind: engagement
name: Client A
employer: Example Consultancy
role: Senior Full-Stack Engineer
domain: Logistics SaaS
dates: 2022-03..2022-09, 2023-01..2024-06
evidence: git history in the client repos; project chat logs
```
````

## Keys

One `key: value` per line. Unknown keys are allowed and reported as warnings.

| Key | Applies to | Meaning |
|---|---|---|
| `kind` | all | `employer`, `engagement`, `project` or `education` |
| `name` | all | The Employer, client, Project or school, exactly as a resume should print it |
| `employer` | engagement | The `name` of the employer block this Engagement belongs to |
| `title` | employer | The title the resume shows for the whole employment |
| `type` | employer | For example `full-time`, `part-time`, `contract`, `self-employed` |
| `role` | engagement | The role the candidate played on this Engagement |
| `credential` | education | The degree, certificate or program |
| `status` | project | `shipped`, `in progress` or `archived`, stated honestly |
| `link` | project (optional) | A public repo or live demo |
| `domain` | engagement (optional) | The client's field, for the `Client:` line |
| `dates` | all | One or more intervals, comma-separated: `YYYY-MM..YYYY-MM`, `YYYY-MM..present`, or `YYYY` for a single year |
| `archived` | employer, engagement, project (optional) | `yes` keeps the entry for the record but out of Generated Resumes |
| `evidence` | all (optional, expected) | Where the facts can be checked, `;`-separated |

Required keys: employer `name title type dates`; engagement `name employer role dates`; project `name status dates`; education `name credential dates`.

## Rules

- **Intervals are exact.** Intermittent or paused work is several intervals, never one span covering the gap. Overlapping Engagements are fine; experience totals count overlapping months once.
- **A fact changes in its block first.** If prose and the block disagree, the block is wrong until the prose's source says otherwise. Fix the block in the same change.
- **Relevance is decided per JD, not here.** Every entry is eligible for a Generated Resume, and the Job Thesis picks what to feature for each job. `archived: yes` is the only exception: the entry stays on record but out of resumes unless a JD asks for exactly that.
