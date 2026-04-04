const HOUR_MS = 1000 * 60 * 60;
const MINUTE_MS = 1000 * 60;

const formatRemainingLabel = (remainingMinutes) => {
  if (remainingMinutes <= 0) {
    return 'SLA Breached';
  }

  const totalHours = Math.floor(remainingMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }

  if (totalHours >= 1) {
    return `${totalHours}h left`;
  }

  return `${Math.max(1, remainingMinutes)}m left`;
};

export const getSlaMeta = (dueAt) => {
  const dueTime = new Date(dueAt).getTime();
  if (!Number.isFinite(dueTime)) {
    return {
      tone: 'yellow',
      label: 'SLA pending',
      className: 'text-statusYellow',
      priority: 'Medium',
      priorityRank: 3,
      remainingHours: null,
      remainingMinutes: null,
    };
  }

  const now = Date.now();
  const remainingMs = dueTime - now;
  const remainingMinutes = Math.floor(remainingMs / MINUTE_MS);
  const remainingHours = remainingMs / HOUR_MS;

  if (remainingMs <= 0) {
    return {
      tone: 'breached',
      label: 'SLA Breached',
      className: 'text-statusRed font-bold',
      priority: 'Critical',
      priorityRank: 1,
      remainingHours,
      remainingMinutes,
    };
  }

  if (remainingHours <= 12) {
    return {
      tone: 'orange',
      label: formatRemainingLabel(remainingMinutes),
      className: 'text-statusOrange',
      priority: 'High',
      priorityRank: 2,
      remainingHours,
      remainingMinutes,
    };
  }

  if (remainingHours <= 24) {
    return {
      tone: 'yellow',
      label: formatRemainingLabel(remainingMinutes),
      className: 'text-statusYellow',
      priority: 'Medium',
      priorityRank: 3,
      remainingHours,
      remainingMinutes,
    };
  }

  return {
    tone: 'green',
    label: formatRemainingLabel(remainingMinutes),
    className: 'text-statusGreen',
    priority: 'Low',
    priorityRank: 4,
    remainingHours,
    remainingMinutes,
  };
};
