# Writing rules for a Cover Letter Draft

The rules every Cover Letter Draft follows. Words in capitals are defined in `<plugin>/GLOSSARY.md`. The resume's writing rules (`<plugin>/skills/generate-resume/writing-rules.md`) still govern truth, verbs and collaboration; this file says where a letter differs. The candidate's standing preferences are in `lessons.md` in the data folder, and they win where they're more specific.

The rules rest on research into how hiring readers use letters and what changed once AI could write them. The strongest evidence is field experiments outside US engineering hiring, plus surveys and practitioner accounts, so treat the rules as a house style to test.

## What a letter is for

A person reads it, most often the hiring manager, and a third of them spend under 30 seconds: about the first 120 words. Panel interviewers can read it later. No applicant-tracking system scores it.

AI made tailoring and polish cheap, so they no longer tell a reader anything. Three things still do:
- **Motivation** only the candidate can supply: why this company, in their words.
- **Clarity:** short, plain sentences a reader follows at speed.
- **Checkable detail:** a named system, a scope, a result, the constraint behind a decision.

The letter adds the why, the context and the judgment the resume can't hold.

## Truth

- **The Super Resume is the only source of career facts,** as in the resume's writing rules: every claim at exactly its source's size, and every claim one that holds up in a technical interview.
- **Context may supply the story's background:** what was hard, what the candidate decided, how they work. Work named by a `**Recall:**` line stays out of the story.
- **The motivation is the candidate's.** It comes from their answer to the motivation question, or from a first-hand connection the Super Resume records. Keep their reason and their feeling, in their phrasing where it reads cleanly. When the answer criticizes a named competitor or past employer, state the problem itself (the fees, the broken flows) and let the company stand as the one solving it; the hand-back says what changed.
- **Voice models show rhythm and register.** Their facts may predate corrections to the Super Resume, so facts come only from the Super Resume.
- **The letter covers what the candidate did and wants.** Gaps, layoffs, salary, visa status, reasons for leaving and who else worked on something stay out.
- **Archived entries and the Do-Not-Use List** follow the resume's rules, and every claim agrees with `resume.md`: the same titles, numbers and scope.

## Shape

One page. A body of 200-300 words in three or four paragraphs, each under 90 words; the candidate's rewrite may run longer.

1. **Opening:** the candidate's motivation, the company or role, and the strongest match claim, tied together, all inside the first 110 words. After a skip, the opening is a marked spot: `[Your opening: …]` holding two or three questions that prompt the candidate's real reason, the research facts that relate, and the career items that connect to them.
2. **One story:** the strongest evidence for the team's top problem. The context, the candidate's decision, the result, with at least one checkable detail the resume lacks (the constraint, the trade-off, who it helped). A second example earns two sentences at most, and only when it's a different kind of evidence. For a consultancy background, one of them shows long-term ownership: years on one product, maintenance, a decision revisited.
3. **The company, tied to the candidate:** one specific, checkable reference (a product, a technical choice, a post from the research) joined in the same or the next sentence to something the candidate did or would do. It often belongs in the opening.
4. **Close:** one or two sentences offering to talk through a named problem or story.

The greeting is "Dear <Company> Hiring Team," or "Dear Hiring Manager,", with a person's name only when the posting or the candidate supplies it. The sign-off is "Best," and the candidate's name. A date line is optional.

## Voice

- **First person, plain words, sentences of 25 words or fewer,** varied in length. Contractions are fine. Follow the voice models and voice Lessons in `lessons.md`.
- **Facts carry the praise.** Back every claim with what happened; use at most two words that describe the candidate. One accurate, specific remark about the company is the most appreciation a letter needs.
- **Plain declarative sentences.** State each point directly, end the sentence where its point ends, and join clauses with a comma, a colon or a period. The script flags common template and AI tells; treat each warning as a prompt to say the thing more plainly.
- **Show how the candidate works** once, inside the story: writing a decision down, partnering with design, raising a trade-off early.
- **AI claims** name what was built, the check the candidate ran on the AI's work, and a measured outcome. A speed claim needs a measurement in the Super Resume.
- **The JD's words, once.** Use the posting's terms for its top one or two requirements where the Super Resume supports them. The ATS reads the resume, so the letter reads as a person writing to a person.
- **Collaboration reads well:** say who started something when it was the candidate, and describe work by what it made possible.

## Employer guidance on AI

Follow the company's published guidance for candidates on using AI:
- When it asks for the candidate's own first draft, the run produces an outline and leaves the prose to the candidate.
- When it asks candidates to say how they used AI, the hand-back says so. Any note about process in the letter is the candidate's to write.

## Source format

`cover-letter.md`, printed by `render-cover-letter.mjs`:

```markdown
# Jane Doe
Springfield, OR | (555) 010-0199 | jane@example.com
[linkedin.com/in/jane](https://www.linkedin.com/in/jane/) | [github.com/jane](https://github.com/jane)

March 3, 2026

Dear Example Co Hiring Team,

One paragraph per line.

Another paragraph.

Best,
Jane Doe
```

- The name and contact lines are the resume's, from Candidate Info. An optional headline may follow the name.
- Paragraphs are prose. Only links, `**bold**` and `*italic*` are inline Markdown.
- The `.txt` copy runs from the greeting to the name, since a paste box's form already holds the contact details.

The script checks the contact lines, the word, paragraph and sentence lengths, an unfilled marked spot, template and AI tells, runs of eight or more words shared with the Super Resume, the resume or the JD, and that the PDF fits one page.
