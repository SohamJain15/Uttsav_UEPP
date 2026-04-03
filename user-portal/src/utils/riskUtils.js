const safeNumber = (value) => Number(value || 0);

export const classifyEventSize = (crowdSize) => {
  const crowd = safeNumber(crowdSize);
  if (crowd < 100) return "Small";
  if (crowd <= 1000) return "Medium";
  return "Large";
};

export const calculateRiskFromEvent = (eventData = {}) => {
  let score = 0;
  const crowd = safeNumber(eventData.crowdSize);
  const trafficImpact = (eventData.trafficImpact || "low").toLowerCase();

  if (crowd > 1000) score += 3;
  else if (crowd >= 100) score += 2;
  else score += 1;

  if (eventData.fireworks) score += 2;
  if (eventData.temporaryStructures) score += 1;
  if (eventData.foodStalls) score += 1;
  if (eventData.roadClosure) score += 2;
  if (trafficImpact === "high") score += 2;
  if (trafficImpact === "medium") score += 1;

  if (score <= 4) return "Low";
  if (score <= 7) return "Medium";
  return "High";
};
