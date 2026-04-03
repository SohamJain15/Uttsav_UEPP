import { useMemo, useState } from "react";
import { assistantService } from "../services/assistantService";

const buildSuggestedQuestions = (currentStep, stepName) => {
  const defaults = [
    "Which permissions are usually required for this event type?",
    "What can cause rejection at this stage?",
    "What documents should I prepare before submission?",
  ];

  const stepSpecific = {
    0: [
      "How does crowd size affect required approvals?",
      "Does event type change police or traffic clearance needs?",
    ],
    1: [
      "Is map pin mandatory for processing?",
      "If venue is booked, what owner documents are expected?",
    ],
    2: [
      "What extra approvals do fireworks and temporary structures require?",
      "Do food stalls need separate compliance?",
    ],
    3: [
      "When is a crowd management plan required?",
      "What minimum emergency readiness should be documented?",
    ],
    4: [
      "What should I prepare for road closure permission?",
      "How do I reduce traffic-related rejection risk?",
    ],
    5: [
      "What should be included in a waste disposal plan?",
      "What proof is useful for cleanup responsibility?",
    ],
    6: [
      "Which uploads are mandatory for my current selections?",
      "How do I verify if my documents are complete?",
    ],
    7: [
      "Before final submit, what compliance checks should I re-verify?",
      "Which authority-specific approvals should I confirm?",
    ],
  };

  const fromStep = stepSpecific[currentStep] || [];
  const withStepName = stepName ? [`For "${stepName}", what are the top compliance checks?`] : [];
  return [...withStepName, ...fromStep, ...defaults].slice(0, 4);
};

const ComplianceAssistant = ({ currentStep, stepName, formContext }) => {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "assistant-welcome",
      role: "assistant",
      text:
        "I can help you with step-wise compliance guidance using the portal rulebook and government references. Ask about permissions, documents, loudspeakers, fireworks, food stalls, traffic, or rejection risks.",
      citations: [],
      confidence: null,
    },
  ]);

  const suggestions = useMemo(
    () => buildSuggestedQuestions(currentStep, stepName),
    [currentStep, stepName]
  );

  const sendQuery = async (nextQuestion) => {
    const trimmed = String(nextQuestion || "").trim();
    if (!trimmed || isLoading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
      citations: [],
      confidence: null,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsLoading(true);

    try {
      const response = await assistantService.ask({
        question: trimmed,
        currentStep,
        stepName,
        formContext,
      });

      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: response.answer,
        citations: response.citations,
        confidence: response.confidence,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text:
            "I could not fetch guidance right now. You can continue filling the form and verify final legal requirements with the local authority.",
          citations: [],
          confidence: null,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-[#BFDBFE] bg-[#F8FAFF] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-[#1E3A8A]">AI Compliance Assistant</h4>
          <p className="text-xs text-[#475569]">
            Grounded guidance based on portal flow + official references.
          </p>
        </div>
        {stepName ? (
          <span className="rounded-full bg-[#DBEAFE] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
            {stepName}
          </span>
        ) : null}
      </div>

      <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-[#DBEAFE] bg-white p-3">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg px-3 py-2 ${
              message.role === "user"
                ? "ml-8 bg-[#1E40AF] text-white"
                : "mr-8 border border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
            }`}
          >
            <p className="whitespace-pre-line text-sm">{message.text}</p>

            {message.role === "assistant" && message.confidence !== null ? (
              <p className="mt-1 text-[11px] font-medium text-[#64748B]">
                Retrieval confidence: {Math.round(message.confidence * 100)}%
              </p>
            ) : null}

            {message.role === "assistant" && Array.isArray(message.citations) && message.citations.length > 0 ? (
              <div className="mt-2 space-y-1">
                {message.citations.slice(0, 3).map((citation) => (
                  <a
                    key={`${message.id}-${citation.url}`}
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[11px] font-medium text-[#1D4ED8] hover:underline"
                  >
                    Source: {citation.label}
                  </a>
                ))}
              </div>
            ) : null}
          </article>
        ))}

        {isLoading ? (
          <div className="mr-8 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#64748B]">
            Checking rulebook...
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => sendQuery(item)}
            className="rounded-full border border-[#BFDBFE] bg-white px-3 py-1 text-xs text-[#1E40AF] hover:bg-[#EFF6FF]"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              sendQuery(question);
            }
          }}
          placeholder="Ask compliance or permission question..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:border-[#1E40AF] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => sendQuery(question)}
          disabled={isLoading}
          className="rounded-lg bg-[#1E40AF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
        >
          Ask
        </button>
      </div>
    </section>
  );
};

export default ComplianceAssistant;

