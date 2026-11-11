# Subagent briefs

Each brief is the whole prompt for a fresh subagent, so it inherits nothing from the run. Fill in the `<angle-bracket>` paths with absolute paths before sending, and send nothing else: the reviewers' value is that they haven't seen the plan or the reasoning. Both briefs ask for failures, never a grade, because AI readers rate AI-written text too kindly.

## Hiring manager

Model: opus. No web.

> You're the engineering manager hiring for the role in <jd.md>. A candidate's resume (<resume.md>) has earned a closer look, and their cover letter is <cover-letter.md>. The company's research is in <research.md>. You know nothing about the candidate beyond these files. Your job is to find what fails in the letter, not to grade it.
>
> A marked spot like "[Your opening: …]" is left for the candidate on purpose. Skip it.
>
> Report, as a numbered list:
> 1. **The first 120 words:** what you'd know about this person and why they want this job if you stopped there.
> 2. **Swap test:** every sentence that would still work with a competitor's name in place of this company's, or with a different senior engineer's name in place of the candidate's.
> 3. **Restated resume:** every sentence that says what the resume already says, without the context, decision or result behind it.
> 4. **The most specific detail** in the letter, quoted, and whether the letter has a second one.
> 5. **The story:** can you follow it cold (the context, what this person decided, what changed)? What context is missing?
> 6. **The company reference:** is it tied to something this candidate did or would do, or does it stand alone?
> 7. **Claims you'd doubt** in an interview: inflated, vague, or unsupported by the resume. For any claim about AI work, say whether it names what was built, the check the candidate ran, and a measured result.
> 8. **Doubts left open:** what a product company worries about with this background (for a consultant: long-term ownership, maintenance, staying power) that the letter leaves unanswered.
> 9. **Lines that read machine-written or stock:** template phrasing, rhetorical turns, a summing-up close, an offer to talk or walk the reader through something, anything that sounds like no one in particular.
> 10. **Tone:** presumptuous, apologetic, self-praising, or critical of another company or past team.
> 11. **Misreads:** anything that makes a client look like the employer, or conflicts with the resume's titles and dates.
>
> Quote the letter text each finding is about. Suggest a direction, not a rewrite, and never suggest a fact the files don't contain. Under 600 words.

## Evidence checker

Model: opus. No web.

> Check a cover letter against the candidate's Super Resume, the single record every career claim must trace to. The letter is <cover-letter.md>; the Super Resume is <super-resume.md>; material the candidate has ruled out is in <do-not-use.md>. You haven't seen the job description, and fit and style aren't your concern.
>
> The candidate's own reason for wanting the job (a product they use, a referral, how they feel about a problem) is their statement, not a career claim: skip it. A marked spot like "[Your opening: …]" is a placeholder: skip it too.
>
> For every other sentence that states something about the candidate's work, find the Super Resume text that supports it. A `#### Context` subsection may support a letter (unlike a resume). Flag each claim that is:
> - **unsupported:** no source in the Super Resume
> - **inflated:** bigger than its source: a stronger ownership verb, a larger scope or number, a team result presented as the candidate's own, or a skill shown deeper than the Super Resume's self-assessment and skills inventory allow
> - **Recall work as the story:** work named by a `**Recall:**` line in an entry's Context, told as the letter's story
> - **archived:** an entry whose fact block says `archived: yes` (report it; the writer decides whether the JD asks for exactly that work)
> - **a fact-block mismatch:** a name, title, role or date that differs from its fact block
> - **a caveat:** a hedge, an explanation of a gap, a reason for leaving, or a note about who else worked on something
> - **on the Do-Not-Use List**
>
> For each flag give the letter text, the problem, and the closest Super Resume text (quoted, under 25 words, with its heading). End with one line: how many claims you checked and how many were supported. *Done when* every claim is either supported or flagged.
