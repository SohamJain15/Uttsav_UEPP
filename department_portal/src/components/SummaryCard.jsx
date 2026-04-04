const SummaryCard = ({ label, value, tone = 'default' }) => {
  const toneClassMap = {
    default: {
      card: 'border-borderMain bg-cardBg',
      rail: 'bg-borderMain',
      dot: 'bg-borderMain',
      value: 'text-textMain'
    },
    pending: {
      card: 'border-statusYellow/35 bg-statusYellow/10',
      rail: 'bg-statusYellow',
      dot: 'bg-statusYellow',
      value: 'text-statusYellow'
    },
    review: {
      card: 'border-primary/30 bg-primary/5',
      rail: 'bg-primary',
      dot: 'bg-primary',
      value: 'text-primary'
    },
    approved: {
      card: 'border-statusGreen/35 bg-statusGreen/10',
      rail: 'bg-statusGreen',
      dot: 'bg-statusGreen',
      value: 'text-statusGreen'
    },
    rejected: {
      card: 'border-statusRed/35 bg-statusRed/10',
      rail: 'bg-statusRed',
      dot: 'bg-statusRed',
      value: 'text-statusRed'
    }
  };
  const toneClasses = toneClassMap[tone] ?? toneClassMap.default;

  return (
    <div className={`rounded-2xl border p-5 shadow-card ${toneClasses.card}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-textSecondary">{label}</p>
        <span className={`h-2.5 w-2.5 rounded-full ${toneClasses.dot}`} />
      </div>
      <div className={`h-1 w-14 rounded-full ${toneClasses.rail}`} />
      <p className={`mt-3 text-3xl font-bold ${toneClasses.value}`}>{value}</p>
    </div>
  );
};

export default SummaryCard;
