# Writing rules for a Generated Resume

The rules every Job Thesis, draft, revision and Edit follows. Words in capitals are defined in `<plugin>/GLOSSARY.md`, and the source shape is in `<plugin>/docs/resume-format.md`, where `<plugin>` is the plugin root the skill names. The candidate's own standing preferences are in `lessons.md` in the data folder, and they win where they're more specific than these rules.

## Truth

- **The Super Resume is the only source.** A Generated Resume chooses, reorders and rewords. It never adds a fact, metric, title, date, scope, team size or skill level. A plausible detail with no source stays out.
- **No bigger than the source.** Keep the source's ownership verb and scope: co-developed stays co-developed, a team's result stays the team's, "about 5" stays about 5. A metric is a single figure; for a range, use the lower bound.
- **Facts from fact blocks.** Employer names, titles, dates, client names and roles, project names and links, schools and credentials print exactly as their fact blocks say. Tenure figures come from the Super Resume's own tenure lines. `check-resume.mjs` enforces the fact blocks.
- **Depth as the candidate states it.** A skill the Super Resume rates as touched or rusty never reads as a strength, and anything it says the candidate hasn't done never appears.
- **Context isn't resume text.** Material that sits only under a `#### Context` subsection shapes the Job Thesis, never a bullet or a summary claim.
- **Recall notes.** A `**Recall:**` line in an entry's Context covers the work it names. That work can support a resume, but it never leads one: never a lead client, never a lead bullet. When the line names the whole entry, the entry can be a supporting client or sit on the other-clients line.
- **Archived entries** appear only when the JD asks for exactly that work.
- **The Do-Not-Use List** is applied silently.
- **No caveats.** The resume never hedges, explains a gap, notes who else worked on something, or argues for an equivalency. A JD requirement the Super Resume can't support becomes a Gap Note in `gaps.md`, never resume text.

## What earns a line

- **Impact and responsibility lead.** A bullet says what the candidate owned and what the work made possible, at what scale, with what result: what a recruiter weighs when judging whether this person can solve their problems. Implementation detail (a config value, a component or file name, an image format, lines of code, commit counts) is Evidence behind a bullet, not a bullet.
- **A strong bullet names the constraint, what was built, and what it made possible.** Weak: "Built React forms for the returns flow in TypeScript." Strong: "Rebuilt a store's returns flow so support staff approve a refund on one screen while every refund still passes finance's checks." Both could describe the same work; the second earns the screen. The domain here is invented: borrow the shape, never the words, and never claim more than the source says.
- **Specifics over slogans.** Show judgment through what was enforced, prevented, chosen or made safe. Temperament and posting adjectives ("self-starter", "results-driven", "passionate", "fast-paced") stay out, and so do trajectory and learning-speed claims ("quickly ramped", "transitioned into") and intent ("eager to", "hoping to").
- **The JD's words, when true.** Use the posting's literal terms where the Super Resume supports them, once each, in natural sentences. Never list a term only because the posting asked for it.
- **Unequal weight.** The strongest evidence for this JD gets the most bullets and the first position; weaker material gets fewer lines or none.

## Shape

- **Headline and contact lines** come from the candidate's lessons and Candidate Info.
- **Summary.** Three or four sentences, about 50–90 words, entirely about this JD and driven by the Job Thesis: the problem this employer has and the evidence that the candidate has solved it. It isn't an employment history. It never names the target employer and mentions consulting only when that helps the thesis.
- **Technical Skills.** Up to six groups, ordered by the JD's emphasis, each a plain label (Languages, Front end, …). Every item is proven by a bullet or the Super Resume at a depth that holds up in an interview. No soft skills.
- **Experience.** Employers newest first.
  - A consultancy is one Employer with its continuous range, a one-line descriptor under it, and its clients as `Client:` lines with no dates. Clients are ordered by strength for this JD, strongest first.
  - **Lead clients** (usually 2–3) get 3–5 bullets, **supporting clients** (usually 2–3) get 1–2, and every other non-archived client goes on the one `Other clients:` line. The JD and the page budget set the numbers.
  - Include at least one recent client and one with real ownership when they exist. A name the reader knows counts in a close call.
  - Earlier Employers get 1–3 bullets.
- **Selected Projects** hold self-directed work under its own dated group, after Experience. Each Project shown has a public repo or live demo, and its status reads honestly.
- **Education** from the fact blocks.

## Length

- Two pages for industry roles, measured on the rendered PDF, and use both: a thin page 2 wastes room the JD's strengths could fill. Up to three pages only where the employer expects detail, such as government roles.
- Page 1 carries the summary, the skills and the strongest client under the first Employer. `render-resume.mjs` reports where each page breaks.
- Over the limit, cut the weakest whole bullet, then the weakest supporting client's bullets, never the type size or margins. A bullet whose last line holds two or three words costs a full line: tighten it to end a line, or give it the words to fill one.

## Voice

- Bullets start with a past-tense verb and imply the first person; nothing is written in the third person.
- Plain words, short sentences, numbers where the Super Resume has them. Follow the voice Lessons in `lessons.md`.
