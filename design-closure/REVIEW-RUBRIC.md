# Review rubric — comparing multi-model Wave-1 runs

Pre-committed so the comparison is fair and not back-fitted to whichever run reads best. The reviewer
applies this to the collected runs (e.g. `outputs/wave-1/runs/{claude,codex,gemini}/`).

## Per-task scoring (T1–T4, each run)

For each task in each run:

1. **AC coverage** — how many of the task's acceptance criteria are actually met, with the cited
   evidence (n / total). An AC asserted but not evidenced does not count.
2. **Evidence quality** — are claims cited to real corpus paths + sections, or asserted from memory?
   Flag any misread of the corpus.
3. **Constraint adherence** — did the run stay read-only on `docs/**` and write only under its outputs?
   (Confirm via the run's diff/`git status`.) A corpus edit is a hard fail for that run regardless of
   content quality.
4. **Decision quality** (T1, T2 only) — is the recommendation sound, are alternatives genuinely weighed,
   and is downstream impact correctly identified (T1 → core-02/03/05; T2 → core-03/04)? A confident
   wrong call scores below an honest "here's the tradeoff, here's my pick, here's the risk."
5. **Corpus-impact completeness** — is the list of `docs/**` files+sections to amend later accurate and
   complete enough to apply?

## Cross-run analysis (the actual value)

The point of three runs is signal, not a beauty contest:

- **Convergence** — where all three independently land on the same answer → high confidence; treat as
  likely-correct, low-risk to apply.
- **Divergence** — where they differ → these are the genuinely open calls. Surface each divergence
  explicitly; it is what the architect must rule on. Do not average them away.
- **Complementary strengths** — note where one run is strongest per task; a synthesized answer may take
  T1 from one run and T2 from another.
- **Misreads / hallucinations** — anything a run asserted that the corpus contradicts. One run catching
  what two missed is also signal.

## Reviewer output

Produce, per task:
- a short matrix: run × (AC coverage, evidence, constraint-ok, decision quality);
- the **convergent answer** (if any) and why it's trustworthy;
- the **divergences** that need an architect ruling, stated as concrete either/or choices;
- a **recommended synthesized proposal** (which run's answer to take, or a merge), with rationale.

End with: which Wave-1 decisions are now safe to freeze (convergent + sound), and which remain open
pending an architect call — i.e., is Wave 1 ready to gate into Wave 2.
