import { useNavigate } from 'react-router-dom';
import RiskBadge from './RiskBadge';
import SLAChip from './SLAChip';

const ApplicationCard = ({ application, status }) => {
  const navigate = useNavigate();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/application/${application.id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          navigate(`/application/${application.id}`);
        }
      }}
      className="rounded-2xl border border-borderMain bg-cardBg p-5 shadow-card transition hover:border-primary/45"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-textSecondary">{application.id}</p>
          <h3 className="mt-1 text-lg font-semibold text-textMain">{application.eventName}</h3>
          <p className="mt-1 text-sm text-textSecondary">{application.venue}</p>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge riskLevel={application.riskLevel} />
          <RiskBadge riskLevel={status} isStatus />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-textSecondary">
        <span>Crowd Size: {application.crowdSize.toLocaleString()}</span>
        <SLAChip dueAt={application.dueAt} />
      </div>
    </div>
  );
};

export default ApplicationCard;
