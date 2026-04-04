import { useEffect, useState } from 'react';
import { getSlaMeta } from '../utils/sla';

const toneClassMap = {
  green: 'border-statusGreen/40 bg-statusGreen/10 text-statusGreen',
  yellow: 'border-statusYellow/40 bg-statusYellow/10 text-statusYellow',
  orange: 'border-statusYellow/40 bg-statusYellow/10 text-statusYellow',
  breached: 'border-statusRed/40 bg-statusRed/10 text-statusRed font-bold'
};

const SLAChip = ({ dueAt }) => {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const dueTime = new Date(dueAt).getTime();
    const remainingMs = Number.isFinite(dueTime) ? dueTime - Date.now() : 0;
    const refreshMs = remainingMs <= 60 * 60 * 1000 ? 15000 : 60000;

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, refreshMs);
    return () => clearInterval(intervalId);
  }, [dueAt]);

  const slaMeta = getSlaMeta(dueAt, nowMs);

  return (
    <span
      className={`inline-flex rounded-xl border px-3 py-1.5 text-sm font-semibold ${
        toneClassMap[slaMeta.tone] ?? toneClassMap.yellow
      }`}
    >
      {slaMeta.label}
    </span>
  );
};

export default SLAChip;
