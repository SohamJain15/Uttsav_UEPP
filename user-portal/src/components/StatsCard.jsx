const StatsCard = ({ title, value, subtitle, className = "" }) => {
  return (
    <article className={`rounded-xl border border-slate-200 bg-cardBg p-5 shadow-card ${className}`}>
      <p className="text-[13px] font-medium text-textSecondary">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-textPrimary">{value}</p>
      {subtitle ? <p className="mt-2 text-sm text-textSecondary">{subtitle}</p> : null}
    </article>
  );
};

export default StatsCard;
