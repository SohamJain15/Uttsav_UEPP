import { getSlaMeta } from '../utils/sla';

const pinTone = {
  green: 'bg-statusGreen/25 border-statusGreen/40',
  yellow: 'bg-statusYellow/25 border-statusYellow/40',
  orange: 'bg-statusYellow/25 border-statusYellow/40',
  breached: 'bg-statusRed/25 border-statusRed/40'
};

const JurisdictionMapPanel = ({ applications }) => {
  const grouped = applications.reduce((acc, application) => {
    const key = application.pincode;
    const sla = getSlaMeta(application.dueAt);

    if (!acc[key]) {
      acc[key] = {
        pincode: key,
        count: 0,
        highRisk: 0,
        tone: sla.tone
      };
    }

    acc[key].count += 1;
    if (application.riskLevel === 'High') {
      acc[key].highRisk += 1;
    }

    if (sla.tone === 'breached') {
      acc[key].tone = 'breached';
    } else if (sla.tone === 'orange' && acc[key].tone !== 'breached') {
      acc[key].tone = 'orange';
    }

    return acc;
  }, {});

  const clusters = Object.values(grouped);

  return (
    <section className="rounded-2xl border border-borderMain bg-cardBg p-4 shadow-card">
      <h3 className="text-base font-semibold text-textMain">Jurisdiction Overview</h3>
      <p className="mt-1 text-sm text-textSecondary">Live cluster map for assigned event density and urgency.</p>

      <div className="mt-4 rounded-2xl border border-borderMain bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3">
          {clusters.length ? (
            clusters.map((cluster) => (
              <div
                key={cluster.pincode}
                className={`rounded-xl border px-3 py-2 ${pinTone[cluster.tone] ?? 'bg-slate-200 border-slate-300'}`}
              >
                <p className="text-xs font-semibold text-textMain">PIN {cluster.pincode}</p>
                <p className="text-sm text-textSecondary">{cluster.count} applications</p>
                <p className="text-xs text-textSecondary">High Risk: {cluster.highRisk}</p>
              </div>
            ))
          ) : (
            <div className="col-span-2 rounded-xl border border-borderMain bg-cardBg p-3 text-sm text-textSecondary">
              No jurisdiction activity available.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default JurisdictionMapPanel;
