const SummaryCard = ({ label, value, tone = 'default' }) => {
  const toneClassMap = {
    default: 'border-borderMain',
    pending: 'border-statusYellow/35',
    review: 'border-primary/35',
    approved: 'border-statusGreen/35',
    rejected: 'border-statusRed/35'
  };

  return (
    <div className={`rounded-2xl border bg-cardBg p-5 shadow-card ${toneClassMap[tone] ?? toneClassMap.default}`}>
      <p className="text-sm text-textSecondary">{label}</p>
      <p className="mt-2 text-3xl font-bold text-textMain">{value}</p>
    </div>
  );
};

export default SummaryCard;
