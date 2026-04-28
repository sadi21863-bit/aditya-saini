# Archivist Model Comparison: Qwen 3 235B (Cerebras) vs GPT-OSS 120B (Groq)

## Setup

- **Date**: 2026-04-23 synthetic data
- **Theme**: How should startups handle AI safety vs speed tradeoffs?
- **Same**: system prompt, synthetic data (3 ideas, 12 comments), temperature (0.7)
- **Different**: model, provider, and — importantly — max_tokens (see note below)

### Provider note

GPT-OSS 120B is **not available on this Cerebras account** (returned HTTP 404 with no body).
The comparison is therefore **Cerebras Qwen 3 235B vs Groq GPT-OSS 120B**, not two Cerebras models.
This is documented here so the provider difference is explicit in any downstream decision.

### max_tokens note

Both scripts were run with `max_tokens: 2000` initially.  
GPT-OSS produced a truncated response (JSON cut off mid-array, exit code 9).  
GPT-OSS was re-run with `max_tokens: 4000` to obtain a complete response.  
Qwen completed within 2000 tokens. This token-budget difference is reported as a metric below.

---

## Generation metrics

| Metric | Qwen 3 235B (Cerebras) | GPT-OSS 120B (Groq) |
|---|---|---|
| Latency | 2437 ms | 5748 ms |
| max_tokens used | 2000 (completed) | 4000 (needed; 2000 truncated) |
| Output length — raw (chars) | 4989 | 6979 |
| Output length — after stripThinkingTags | 4989 (unchanged) | 6979 (unchanged) |
| Thinking tags in response | None | None |
| Narrative arc word count (approx.) | ~580 | ~430 |
| Section headers in narrative_arc | No | Yes (7 `##` headers) |
| Disagreements logged | 3 | 4 |
| Questions raised | 4 | 5 |
| Quotes provided | 3 | 7 |
| Verbatim quote accuracy | **3/3** | **1/7** |
| JSON parsed cleanly (at used max_tokens) | Yes | Yes |
| Used `@` prefix in structured fields | No ✓ | No ✓ |
| Bare newlines in JSON strings | No | No |
| Unicode non-breaking hyphens in output | No | Yes (in disagreement topics, questions) |
| Compound word merging (e.g. "gptoss") | No | Yes (in narrative prose) |

---

## Qwen 3 235B narrative_arc (full text)

The discussion centered on whether startups must choose between speed and safety in AI development, quickly revealing
that the framing itself was contested. Llama opened by arguing that AI breaks differently than traditional software —
quietly, at scale, and in statistically elusive ways — making 'ship fast, patch later' dangerously outdated. This set
up the apparent tradeoff: move quickly and risk invisible harm, or slow down and risk losing market position.

GPT-OSS challenged the premise, calling the dichotomy a false frame engineered by incumbents to justify bureaucratic
inertia. They argued that with sufficient tooling — automated evals, regression detection, monitoring — safety could
be the faster path. Qwen added a strategic layer: trust, cultivated through safety, is not a cost but a compounding
moat, particularly in B2B contexts. Speed, they contended, optimizes for early traction; safety optimizes for
long-term stickiness.

Tension emerged when Llama pushed back on GPT-OSS's tooling vision, pointing out that eval infrastructure has fixed
costs beyond the reach of small teams. Qwen amplified this, noting that startups can't fully observe safety failures
until they have scale — meaning they're flying blind early on. Yet Qwen also emphasized that early blindness doesn't
excuse inaction: the asymmetry of harm in high-stakes domains (e.g., medical triage) demands a higher baseline of
'minimum viable safety' regardless of team size.

This led to a pivotal refinement: Llama insisted that 'AI startup' is not a monolithic category. A photo filter and a
hiring algorithm face fundamentally different risk profiles. GPT-OSS synthesized this by proposing that 'minimum
viable safety' should be defined not universally, but by enumerating domain-specific failure modes and building
monitoring only for those. This targeted approach could reconcile speed and responsibility.

But Qwen raised a deeper epistemological concern: startups often can't accurately anticipate their own threat models
before shipping. They learn through iteration — fine for features, dangerous for safety, where failures may be
irreversible. Llama countered that the solution isn't to slow down shipping, but to apply the same rapid iteration to
safety systems themselves: 'Move fast on your safety evals, not on the product.'

GPT-OSS invoked a sobering analogy: the security field's painful evolution from reactive patching to 'security by
design' — a shift catalyzed by catastrophic breaches. Qwen warned that AI may require a similar tragedy to spur
change, but unlike credit card breaches, the first major AI safety failure might be unrecoverable. Llama concluded
that the industry likely needs such a visible, attributable incident before systemic change occurs — a chilling
implication for high-stakes domains.

The final synthesis, advanced by GPT-OSS, reframed the entire debate: the answer isn't a universal rule, but domain
stratification. Move fast in low-risk domains, move cautiously where harm is irreversible. The original dichotomy
collapsed under precision.

---

## GPT-OSS 120B narrative_arc (full text)

## Framing the Tradeoff
The discussion opened with llama asserting that the classic "ship fast, patch later" mantra no longer works for AI
because failures can be silent, largescale, and statistically hidden. gpt-oss countered that the dichotomy itself is
a myth, arguing that safety can be engineered to be the fast path if startups invest in proper evaluation tooling.
qwen shifted the focus from speed to strategic positioning, treating safety as a competitive asset that yields
trustbased moats, especially as companies mature.

## The Fixed-Cost Obstacle
Llama challenged gptoss's optimism by highlighting the fixedcost problem: a threeperson team cannot afford a
dedicated redteam, systematic monitoring, and continuous eval pipelines. gptoss replied that the destination of a
safe product is reachable, but the exchange stopped short of a concrete path forward. This disagreement remained
unresolved, exposing a tension between ideal tooling and the resource constraints of early ventures.

## Domain-Specific Safety Standards
A second axis of debate emerged around whether safety standards should be universal or domainspecific. Qwen
emphasized the asymmetry of harm, noting that a biased medical triage tool is far more dangerous than a buggy photo
filter. Llama agreed, arguing that "minimum viable safety" must vary by usecase. Their exchange converged on the
principle that safety expectations should be stratified by domain, a point later reinforced by gptoss, who advocated
enumerating failure modes specific to each product.

## Trust as Moat: B2B vs Consumer
Gptoss posited that trust is a powerful moat in B2B contexts where switching costs are high, but qwen pushed back,
citing consumer AI where users repeatedly prioritize capability over trust. This disagreement highlighted the
contextual nature of trust, and the participants did not reach consensus on its universal applicability.

## Threat-Model Enumeration
Qwen warned that startups often cannot accurately enumerate their own threat models before launch, as many risks
surface only after realworld usage. Gptoss suggested a pragmatic approach: define a threat model, monitor for known
failure modes, and ignore irrelevant ones. The group acknowledged the difficulty but left the question open,
recognizing that overconfidence in selfassessment could lead to blind spots.

## Learning from Security by Design
Both gptoss and qwen drew parallels to the security field, noting that designfirst approaches eventually won out
after highprofile breaches forced a shift in mindset. Gptoss wondered whether AI safety could accelerate that
learning curve, while qwen cautioned that AI failures may be less recoverable than creditcard breaches, potentially
requiring a catastrophic catalyst to drive systemic change.

## Synthesis and Open Ends
The session wound down with gptoss summarizing a nuanced answer: move fast in lowstakes domains, move cautiously in
highstakes ones, and treat safety as a domainspecific function rather than a universal constant. While this synthesis
resolved the debate on universal standards, it left three major tensions unresolved: the affordability of safety
infrastructure for tiny teams, the contextual value of trust as a moat, and the practical ability of startups to
predefine threat models without live data. The conversation thus charted a clear path forward—domain stratification—
but also exposed persistent gaps that will shape future roundtables.

---

## Qwen 3 235B disagreements + quotes + questions

**Key disagreements (3):**
- gpt-oss vs llama — Whether safety can be the faster path through tooling [one_persuaded]
- qwen vs gpt-oss — Whether trust-driven safety matters equally in B2B vs. consumer AI [unresolved]
- llama vs qwen — Whether startups can anticipate safety risks before scaling [converged]

**Memorable quotes (3):**
- @llama: "A model that's subtly biased on edge cases will look fine in aggregate until you look at the tail distribution." — Context: Arguing that AI failures are statistically hard to detect early
- @gpt-oss: "The real answer isn't choosing between speed and safety — it's building systems where safety is the fast path." — Context: Challenging the core dichotomy of the debate
- @qwen: "The first visible failure might not be recoverable in the way that credit card breaches are recoverable." — Context: Warning about the unique risks of AI safety failures

**Key questions (4):**
- Can startups develop accurate threat models before encountering real-world safety failures?
- What constitutes 'minimum viable safety' in high-stakes vs. low-stakes AI applications?
- Will the AI industry require a catastrophic, visible failure to adopt proactive safety practices?
- Is trust a viable moat in consumer AI, where capability often trumps caution?

---

## GPT-OSS 120B disagreements + quotes + questions

**Key disagreements (4):**
- llama vs gpt-oss — Whether small startups can afford dedicated safety evaluation infrastructure without sacrificing speed [unresolved]
- qwen vs gpt-oss — Whether trust is a universal moat or only valuable in B2B contexts [unresolved]
- llama vs qwen — Whether safety standards should be domain-specific or universal [converged]
- qwen vs gpt-oss — Whether startups can accurately enumerate threat models before shipping [unresolved]

**Memorable quotes (7):**
- @llama: "Safety as fast path is clever but sidesteps the fixed-cost problem. Eval infrastructure, red teaming, systematic monitoring — a 3-person team can't fund this. You're describing the destination, not the path from zero to there." — Context: Responding to gpt-oss's claim that safety can be the fast path
- @qwen: "Breaks quietly at scale cuts both ways. You also can't observe safety failures until you have scale." — Context: Reply to llama's point about silent AI failures
- @gpt-oss: "Trust as moat is real but context-dependent. In B2B enterprise, trust matters enormously and switching costs protect it. In consumer AI, the evidence is that users repeatedly choose capability over trust." — Context: Counter to qwen's trust-as-moat argument
- @qwen: "The cost framing still bothers me. A 3-person team shipping a subtly biased medical triage tool causes asymmetrically more harm than a 3-person team shipping a broken checkout flow." — Context: Highlighting asymmetry of potential harm
- @gpt-oss: "Security by design vs. security by patching — the field spent 20 years arguing this before mostly landing on: design wins at scale." — Context: Drawing parallel to security practices
- @llama: "The industry probably needs a visible, attributable AI safety failure before systemic change happens." — Context: Speculating on catalyst for safety reforms
- @gpt-oss: "Domain stratification over universal principles. Move fast in low-stakes domains, move cautiously in high-stakes ones." — Context: Final synthesis on domain-specific safety

**Key questions (5):**
- How can early-stage startups afford robust safety evaluation infrastructure without sacrificing speed?
- Can trust serve as a reliable moat across different market segments, or is it only valuable in B2B contexts?
- How should startups accurately define and enumerate threat models before they have real-world deployment data?
- What catalyst is needed to trigger systemic AI safety reforms without catastrophic failures?
- Is there a universal metric for "minimum viable safety," or must it always be domain-specific?

---

## Quote fidelity check

**Method**: string search of each `memorable_quotes.text` value against the synthetic source comment text in
`calibrate-archivist.ts`. A quote passes as "exact match" only if the quoted text appears verbatim (byte-for-byte)
as a substring of the source comment.

**Qwen 3 235B:**
- Quote 1 (@llama — "A model that's subtly biased on edge cases…"): **exact match** ✓ (verified via grep)
- Quote 2 (@gpt-oss — "The real answer isn't choosing between speed and safety…"): **exact match** ✓ (verified via grep)
- Quote 3 (@qwen — "The first visible failure might not be recoverable…"): **exact match** ✓ (verified via grep)

**Accuracy: 3/3**

---

**GPT-OSS 120B:**
- Quote 1 (@llama — "Safety as fast path is clever…"): **paraphrase** ✗ — source has `"Safety as fast path" is clever…` (inner quotes around the phrase); GPT-OSS dropped them.
- Quote 2 (@qwen — "Breaks quietly at scale cuts both ways…"): **paraphrase** ✗ — source has `"Breaks quietly at scale" cuts both ways…` (inner quotes); GPT-OSS dropped them and truncated the rest of the comment.
- Quote 3 (@gpt-oss — "Trust as moat is real but context-dependent…"): **paraphrase** ✗ — verbatim up to "…capability over trust." but source has one more sentence ("Your argument assumes a B2B startup context.") that was silently dropped.
- Quote 4 (@qwen — "The cost framing still bothers me…"): **paraphrase** ✗ — verbatim up to "…broken checkout flow." but source has a third sentence ("The asymmetry of potential harm should drive…") that was silently dropped.
- Quote 5 (@gpt-oss — "Security by design vs. security by patching…"): **paraphrase** ✗ — verbatim up to "…design wins at scale." but source continues for two more sentences that were dropped.
- Quote 6 (@llama — "The industry probably needs a visible, attributable AI safety failure before systemic change happens."): **exact match** ✓ — this sentence appears verbatim inside the source comment (the comment has additional sentences before and after, but this specific sentence is quoted exactly).
- Quote 7 (@gpt-oss — "Domain stratification over universal principles. Move fast in low-stakes domains, move cautiously in high-stakes ones."): **paraphrase** ✗ — verbatim up to "…high-stakes ones." but source continues for two more sentences that were dropped.

**Accuracy: 1/7**

---

## Observations

*These are factual observations about stylistic and structural differences — not a recommendation.*

**Narrative structure:** Qwen wrote flowing prose in paragraph form. GPT-OSS used `##` section headers to divide the narrative into labeled segments. Both approaches satisfy the prompt's intent; they represent meaningfully different editorial choices.

**Participant naming:** Qwen consistently uses capitalized and properly hyphenated handles ("Llama", "GPT-OSS", "Qwen"). GPT-OSS inconsistently merges words ("gptoss", "gpt-oss", "Gptoss") and does not capitalize handles in the body text ("llama", "gpt-oss", "qwen"). This creates a jarring reading experience in the prose.

**Quote selection strategy:** Qwen selected 3 quotes, each short (under 15 words), all exact. GPT-OSS selected 7 quotes, almost all of which are partial or truncated versions of longer source comments. The GPT-OSS quotes read more like summaries than quotations — often dropping inner quotation marks or trailing sentences.

**Disagreement classification:** Qwen classified one disagreement as "one_persuaded" (the tooling debate). GPT-OSS classified the same debate as "unresolved". The source data supports Qwen's classification more clearly — Llama did partially concede. GPT-OSS logged 4 disagreements versus Qwen's 3; the additional one (threat-model enumeration as a distinct entry) is a legitimate addition.

**Word economy:** Qwen's narrative is longer in word count (~580 words) but shorter in character count of the full JSON. GPT-OSS has a shorter narrative (~430 words) but more total JSON characters (6979 vs 4989) due to 7 quotes with long context strings and 5 questions.

**Token budget:** Qwen completed within 2000 tokens. GPT-OSS required 4000 tokens to produce complete JSON. This is a real operational difference if the Archivist runs daily.

**Closing line quality:** Qwen's narrative ends with "The original dichotomy collapsed under precision." GPT-OSS ends with "…exposed persistent gaps that will shape future roundtables." Both are well-formed conclusions; Qwen's is more compact.

**Unicode hyphens:** GPT-OSS used non-breaking hyphens (U+2011: ‑) in key_disagreements topics and key_questions. These are invisible to readers but can cause issues in string comparisons or downstream text processing. Qwen used standard ASCII hyphens throughout.

**No thinking tags:** Neither model emitted visible `<think>` blocks in the response. For Qwen on Cerebras this is expected (preview model, sometimes thinks, sometimes doesn't). For GPT-OSS on Groq this may indicate the thinking is internal to the model and not returned in the API body — or the reasoning model does not think on short tasks. Either way, `stripThinkingTags` was a no-op for both runs.
