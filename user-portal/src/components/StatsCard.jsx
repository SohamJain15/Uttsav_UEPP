const ACCENT_STYLES = {
  neutral: {
    card: "border-slate-200",
    rail: "bg-slate-300",
    value: "text-textPrimary",
    dot: "bg-slate-400",
  },
  success: {
    card: "border-[#86EFAC] bg-[#F0FDF4]",
    rail: "bg-[#16A34A]",
    value: "text-[#166534]",
    dot: "bg-[#16A34A]",
  },
  warning: {
    card: "border-[#FCD34D] bg-[#FFFBEB]",
    rail: "bg-[#F59E0B]",
    value: "text-[#92400E]",
    dot: "bg-[#F59E0B]",
  },
  danger: {
    card: "border-[#FCA5A5] bg-[#FEF2F2]",
    rail: "bg-[#DC2626]",
    value: "text-[#991B1B]",
    dot: "bg-[#DC2626]",
  },
};

const StatsCard = ({ title, value, subtitle, accent = "neutral", className = "" }) => {
  const tone = ACCENT_STYLES[accent] || ACCENT_STYLES.neutral;

  return (
    <article className={`rounded-xl border p-5 shadow-card ${tone.card} ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-textSecondary">{title}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
      </div>
      <div className={`h-1 w-16 rounded-full ${tone.rail}`} />
      <p className={`mt-3 text-3xl font-semibold ${tone.value}`}>{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-textSecondary">{subtitle}</p> : null}
    </article>
  );
};

export default StatsCard;
