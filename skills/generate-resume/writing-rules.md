# Writing rules for a Generated Resume

The rules every Job Thesis, draft, revision and Edit follows. Words in capitals are defined in `<plugin>/GLOSSARY.md`, and the source shape is in `<plugin>/docs/resume-format.md`, where `<plugin>` is the plugin root the skill names. The candidate's own standing preferences are in `lessons.md` in the data folder, and they win where they're more specific than these rules.

## Three readers

Every line is read three times, in this order:
1. **The ATS** parses the PDF's text, and recruiters search it literally. The JD's exact terms matter, in its spelling.
2. **A recruiter** skims for about thirty seconds and isn't an engineer. They need to tell what the candidate did, and why it fits, without the context the candidate has.
3. **The engineering manager** looks for ownership, a mechanism worth asking about, and judgment.

A line that fails the recruiter fails, however well it reads to an engineer.

## Truth

- **The Super Resume is the only source.** A Generated Resume chooses, reorders and rewords. It never adds a fact, metric, title, date, scope, team size or skill level. A plausible detail with no source stays out.
- **Exactly the source's size.** Never claim more than the source does: no sole ownership of shared work, no bigger number or scope, and no team result presented as the candidate's own. A metric is a single figure; for a range, use the lower bound. Never claim less, either: no hedge on what the candidate did. A share appears only when it raises the claim ("as its sole front-end engineer").
- **Facts from fact blocks.** Employer names, titles, dates, client names and roles, project names and links, schools and credentials print exactly as their fact blocks say. Tenure figures come from the Super Resume's own tenure lines. `check-resume.mjs` enforces the fact blocks.
- **Depth follows production use.** The Super Resume's skills inventory and self-assessment say how much production work stands behind each skill. A skill with real production work can read as a strength even when it's rusty from disuse; brushing up is interview prep. A skill with little production work behind it (touched, study-only, a lab) appears only when the JD names it, and never as a strength: not in the summary, not at the front of a skills group, not as a bullet's point. Anything the Super Resume says the candidate hasn't done never appears.
- **Convert, don't copy.** Each entry has three layers, and each plays a different part:
  - **Accomplishments** are the claims a bullet is built around. Re-derive the bullet from the claim through these rules; never paste the line.
  - **Evidence notes** supply the one mechanism, the numbers and the names a bullet needs.
  - **Context** shapes the Job Thesis, never a bullet or a summary claim.
- **Recall notes.** A `**Recall:**` line in an entry's Context covers the work it names. That work can support a resume, but it never leads one: never a lead client, never a lead bullet. When the line names the whole entry, the entry can be a supporting client or sit on the other-clients line.
- **Archived entries** appear only when the JD asks for exactly that work.
- **The Do-Not-Use List** is applied silently.
- **No caveats.** The resume never explains a gap, notes who else worked on something, or argues for an equivalency. A JD requirement the Super Resume can't support becomes a Gap Note in `gaps.md`, never resume text.

## What earns a bullet

- **Impact and responsibility lead.** A bullet says what the candidate owned and what the work made possible, for users, the business or other engineers: what a recruiter weighs when judging whether this person can solve their problems. A reader can answer "so what?" from the bullet alone. A concrete outcome without a number passes (replaced, adopted by, launched, made X possible). Implementation detail (a config value, a component or file name, lines of code, commit counts) is Evidence behind a bullet, not a bullet.
- **The stranger test.** The bullet makes sense read cold, by someone who knows nothing of the client, the other bullets or the story behind it. Every proper noun and acronym is widely recognized (GitHub, AWS, React), named in the JD, or replaced by its category ("a document-parsing service"). Internal and vendor product names fail unless the JD names them.
- **One accomplishment.** The bullet's point fits in one clause of about twelve words. Two results joined by "and", or a colon or semicolon introducing a list of deeds, are two bullets or one too many. A lead client's bullets show the range of work done there; more detail about one piece of work stays in its single bullet, or behind it as Evidence.
- **Outcome first.** The verb and an object a recruiter understands come in the first five words. The mechanism and technology follow.
- **Judgment through a lasting change.** A story of noticing, proposing or catching something earns a bullet only through the lasting change it led to (a practice adopted, a tool replaced, a standard set) that answers a JD requirement. The bullet opens with that change. A one-off catch stays in Context, as an interview answer.
- **Numbers an outsider can read.** Each number comes with a scale, a baseline or a comparison a stranger can judge: users, teams, time, money, before and after. Version and release numbers mean something only to insiders: say what a range stands for ("four major versions in a year") or drop it.
- **Few technologies.** At most three named technologies per bullet, each named in the JD or essential to the point, after the outcome. A technology can repeat across clients when it says how each thing was built. No version numbers unless the JD names the version. UI kits, utility libraries, dev-environment tools and protocol terms appear only when the JD names them.
- **Collaboration reads well.** A hiring manager reads every line for how the candidate works with others. Work is described by what it made possible, never by what others didn't have to do or by friction: no "without asking", "despite", "had to convince", "pushed back".
- **Specifics over slogans.** Show judgment through what was enforced, prevented, chosen or made safe. Buzzwords ("spearheaded", "leveraged", "utilized", "robust", "seamless", "cutting-edge"), temperament and posting adjectives ("self-starter", "results-driven", "passionate"), trajectory and learning-speed claims ("quickly ramped", "transitioned into") and intent ("eager to") stay out.
- **The JD's words, when true.** Use the posting's literal terms where the Super Resume supports them, once each, in natural sentences. Never list a term only because the posting asked for it.
- **Each fact once.** A figure or claim appears in one place on the page.
- **Unequal weight.** The strongest evidence for this JD gets the most bullets and the first position; weaker material gets fewer lines or none. Relevance beats recency: an older engagement that best proves a must-have can be a lead client. Within each client, the first bullet is the work nearest the problem this team has, so one engagement leads differently for different JDs.

**Weak and strong.** The domains here are invented: borrow the shape, never the words, and never claim more than the source says.
- Weak: "Built React forms for the returns flow in TypeScript." Strong: "Rebuilt a store's returns flow so support staff approve a refund on one screen while every refund still passes finance's checks." Both describe the same work; the second says what it made possible.
- Weak: "Noticed the nightly report job kept failing, raised it with the lead and proposed a fix." Strong: "Replaced a failing nightly report job with an event-driven export that finance now uses for month-end close."

## Verbs

- **The verb fits its object.** People and efforts take led or managed. Things take built, created, designed, developed or delivered. A standing responsibility takes owned. Change across teams takes drove or established. "Led" followed by a thing (a library, an app) fails.
- **Plain ownership.** State what the candidate did at full size: "built", not "built most of", "largely built", "co-developed", "helped build" or "contributed to".
- **Active and finite.** Each bullet starts with a past-tense verb and implies the first person. No "-ing" openers, passive voice, "responsible for", "duties included" or "in order to".
- **Varied openers.** No two consecutive bullets under one heading start with the same verb.

## Shape

- **Headline and contact lines** come from the candidate's lessons and Candidate Info.
- **Summary.** Two or three sentences, 35–60 words, none over 25 words. It states the Job Thesis directly: the team's problem as the JD states it and the research infers it, and the evidence that this candidate is the one to solve it. Every sentence serves that case.
  - It opens with the candidate's identity: role, years and at most three core technologies, chosen from the JD.
  - **Different altitude.** The summary states patterns across roles; bullets hold the instances. No number, named artifact (a library, an app, a pipeline, a component count), client name or technical mechanism in the summary appears in any bullet.
  - **The AI practice**, when the candidate's lessons make it part of the positioning, gets its own sentence, worded toward the team's problem. It names a practice with its verification step (what agent output passes before it ships), never a tool list, a start date or a productivity multiplier.
  - It points to work a reader can open: the Selected Projects, or the candidate's site.
  - It uses the JD's literal nouns for its top one or two requirements where the Super Resume supports them, at most one requirement per sentence, and at most two tool or product names.
  - Evidence makes the case. No self-praise ("uniquely qualified"), temperament, passion, intent, trajectory claims, first-person pronouns, domains in place of company names, or acronyms the JD doesn't use. No colon introducing a list, and no sentence listing more than three items.
  - It never names the target employer, and mentions consulting only when that helps the thesis.
- **AI claims anywhere on the page** name a practice (a gate, a review, an evaluation, a test, a plan) and, where the Super Resume has one, an outcome. A speed claim needs a measurement in the source. At least one AI claim points to work a reader can open. Tool inventories belong in Technical Skills.
- **Technical Skills.** Four to six groups, each fitting on one rendered line, ordered by the JD's emphasis. Label each plainly (Languages, Front end, …), or with the JD's own theme when the items under it prove that theme: a posting that asks for engineering standards can get an "Architecture and standards" group. Within a group, the JD's items come first, in its spelling.
  - Each item is named by the JD, or is an anchor technology for the role the candidate has real production depth in.
  - Every skill the JD requires also appears in a bullet or project line.
  - No version numbers, proficiency labels or ratings, and no soft skills.
  - Spell out once, somewhere on the page, an acronym the JD spells out.
- **Experience.** Employers newest first.
  - A consultancy is one Employer with its continuous range and its clients as `Client:` lines with no dates, strongest first for this JD. A one-line descriptor under the Employer is optional: add one only when the title and the `Client:` lines leave the arrangement unclear, and only when it's true of every client shown.
  - **Lead clients** (usually 2–3) get 2 bullets each. A third or fourth bullet earns its place only by proving a JD must-have that no other bullet on the page proves, and the thesis names that must-have. **Supporting clients** (usually 2–3) get 1–2 bullets, and every other non-archived client goes on the one `Other clients:` line. When the pages run short, the room goes to another client or a project, never to padding a client.
  - Include at least one recent client and one with real ownership when they exist. A name the reader knows counts in a close call.
  - Earlier Employers get 1–3 bullets.
- **Selected Projects** hold self-directed work in its own dated group, after Experience. Each Project shown has a public repo or live demo, linked with the URL visible as text.
  - The first clause says what the project does and for whom, in plain words. Start from the Project's approved description in the Super Resume.
  - 1–2 bullets each: the method that makes it trustworthy (evaluations, tests, comparisons, guardrails) and its honest status. Users, adoption or scale appear only when the Super Resume states them.
- **Education** from the fact blocks.

## ATS

- **Keyword coverage.** Every JD must-have the Super Resume supports appears in the JD's literal form at least once in an Experience or Projects bullet, not only in Skills or the summary. Tool and technology must-haves also appear in Skills. No term appears more than three times. A must-have the Super Resume doesn't support goes to `gaps.md`.
- **What parsers read.** Every word is visible text: no hidden text and no stand-alone keyword blocks. The template supplies the conventional headings and single column, and `render-resume.mjs` checks the text layer.
- **The form agrees.** The resume's dates and claims match the honest answers to the application form's screening questions (work authorization, location, years with a skill, degree).

## Length

- Two pages for industry roles, measured on the rendered PDF, and use both: a thin page 2 wastes room the JD's strengths could fill. Up to three pages only where the employer expects detail, such as government roles.
- Page 1 carries the summary, the skills and the strongest client under the first Employer. `render-resume.mjs` reports where each page breaks.
- Each bullet renders in two lines or fewer, and no sentence runs past 25 words.
- Over the limit, cut the weakest whole bullet, then the weakest supporting client's bullets, never the type size or margins. A bullet whose last line holds two or three words costs a full line: tighten it to end a line, or give it the words to fill one.

## Voice

- Plain words a recruiter knows, short sentences, numbers where the Super Resume has them. Nothing is written in the third person. Follow the voice Lessons in `lessons.md`.
