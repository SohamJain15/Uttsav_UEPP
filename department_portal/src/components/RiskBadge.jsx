const RISK_CLASS_MAP = {
  Low: 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30',
  Medium: 'bg-statusYellow/15 text-statusYellow border border-statusYellow/30',
  High: 'bg-statusRed/15 text-statusRed border border-statusRed/30'
};

const STATUS_CLASS_MAP = {
  Pending: 'bg-statusYellow/15 text-statusYellow border border-statusYellow/30',
  'In Review': 'bg-primary/10 text-primary border border-primary/20',
  Approved: 'bg-statusGreen/15 text-statusGreen border border-statusGreen/30',
  Rejected: 'bg-statusRed/15 text-statusRed border border-statusRed/30',
  'Query Raised': 'bg-slate-200 text-slate-700 border border-slate-300'
};

export const getStatusClassName = (status) => STATUS_CLASS_MAP[status] ?? 'bg-slate-100 text-slate-700 border border-slate-200';

const RiskBadge = ({ riskLevel, isStatus = false }) => {
  const styleClass = isStatus
    ? getStatusClassName(riskLevel)
    : RISK_CLASS_MAP[riskLevel] ?? 'bg-slate-100 text-slate-700 border border-slate-200';

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${styleClass}`}>
      {riskLevel}
    </span>
  );
};

export default RiskBadge;
