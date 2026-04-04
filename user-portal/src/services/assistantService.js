import axios from "axios";

const ASSISTANT_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_ASSISTANT_TIMEOUT_MS || 45000);

const buildAssistantApiCandidates = () => {
  const explicitOrigin = (import.meta.env.VITE_BACKEND_ORIGIN || "").trim().replace(/\/$/, "");
  const candidates = [];

  if (explicitOrigin) {
    candidates.push(`${explicitOrigin}/api/user/assistant/query`);
  }

  candidates.push("http://127.0.0.1:8000/api/user/assistant/query");
  candidates.push("/api/user/assistant/query");

  return Array.from(new Set(candidates));
};

const normalizeAssistantResponse = (data = {}) => ({
  answer:
    data.answer ||
    "I could not retrieve enough verified rulebook information. Please provide more event details.",
  citations: Array.isArray(data.citations) ? data.citations : [],
  matchedRules: Array.isArray(data.matched_rules) ? data.matched_rules : [],
  confidence: typeof data.confidence === "number" ? data.confidence : null,
  guardrailTriggered: Boolean(data.guardrail_triggered),
  rulebookVersion: data.rulebook_version || "",
});

export const assistantService = {
  async ask({ question, currentStep, stepName, formContext }) {
    const payload = {
      question: String(question || "").trim(),
      current_step: Number.isInteger(currentStep) ? currentStep : undefined,
      step_name: stepName || undefined,
      form_context: formContext || {},
    };

    if (!payload.question) {
      return normalizeAssistantResponse({
        answer: "Please enter a question so I can help with compliance guidance.",
      });
    }

    const candidates = buildAssistantApiCandidates();
    for (const endpoint of candidates) {
      try {
        const response = await axios.post(endpoint, payload, {
          headers: { "Content-Type": "application/json" },
          timeout: ASSISTANT_REQUEST_TIMEOUT_MS,
        });
        return normalizeAssistantResponse(response.data);
      } catch (error) {
        // Try next candidate.
      }
    }

    return normalizeAssistantResponse({
      answer:
        "Assistant service is currently unreachable. Please continue with the form and verify approvals with your local Police/DM/Fire/Traffic/Municipality authorities.",
      citations: [],
      matched_rules: [],
      confidence: null,
      guardrail_triggered: false,
    });
  },
};

