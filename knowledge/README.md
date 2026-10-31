# How to teach Hisaab about the product

This folder is preparation material, not an enabled inference engine or a new
source of verified tax rules. Editing it does not currently change model output.

1. `assistant-policy.md`: tone, language, supported tasks, privacy and refusal rules.
2. Existing `docs/TAX-RULES.md`, `src/core.ts`, `src/deadlines.ts` and `src/iris.ts`:
   authoritative application rule register. Keep amounts in deterministic tools.
3. Add reviewed help articles by tax year, with exact FBR source, effective date,
   reviewedOn/reviewedBy, scope and verification state. Drafts stay out of answers.
4. Build synthetic example conversations for English, Roman Urdu and Urdu:
   question, correct answer, expected tool, necessary question, evidence and
   actions that must be blocked. Do not copy private customer or Gmail content.
5. Run these examples as evaluations before changing model or prompts. A more
   conversational answer is not evidence of tax correctness.

User chats improve personal context through private memory and history, not
through daily changes to Qwen's model weights. Shared training is a separate,
explicitly governed future workflow requiring suitable consent and data rights.
