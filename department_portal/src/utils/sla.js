export const getSlaMeta = (dueAt) => {
  const dueTime = new Date(dueAt).getTime();
  const now = Date.now();
  const remainingHours = Math.round((dueTime - now) / (1000 * 60 * 60));

  if (remainingHours <= 0) {
    return {
      tone: 'breached',
      label: 'SLA Breached',
      className: 'text-statusRed font-bold'
    };
  }

  if (remainingHours > 48) {
    return {
      tone: 'green',
      label: `${remainingHours}h remaining`,
      className: 'text-statusGreen'
    };
  }

  if (remainingHours >= 24) {
    return {
      tone: 'yellow',
      label: `${remainingHours}h remaining`,
      className: 'text-statusYellow'
    };
  }

  return {
    tone: 'orange',
    label: `${remainingHours}h left`,
    className: 'text-statusOrange'
  };
};
