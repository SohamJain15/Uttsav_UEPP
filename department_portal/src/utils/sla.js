const HOUR_MS = 1000 * 60 * 60;
const MINUTE_MS = 1000 * 60;

const formatRemainingLabel = (remainingMs) => {
  if (remainingMs <= 0) {
    return 'SLA Breached';
  }

  const totalMinutes = Math.max(1, Math.floor(remainingMs / MINUTE_MS));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m left`;
  }

  if (hours >= 1) {
    return `${hours}h ${minutes}m left`;
  }

  return `${minutes}m left`;
};

export const getSlaMeta = (dueAt, nowMs = Date.now()) => {
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

  const remainingMs = dueTime - nowMs;
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
      label: formatRemainingLabel(remainingMs),
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
      label: formatRemainingLabel(remainingMs),
      className: 'text-statusYellow',
      priority: 'Medium',
      priorityRank: 3,
      remainingHours,
      remainingMinutes,
    };
  }

  return {
    tone: 'green',
    label: formatRemainingLabel(remainingMs),
    className: 'text-statusGreen',
    priority: 'Low',
    priorityRank: 4,
    remainingHours,
    remainingMinutes,
  };
};
