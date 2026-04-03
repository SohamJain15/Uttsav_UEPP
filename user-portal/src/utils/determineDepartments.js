const toTitle = (value) => (value || "").toString().trim().toLowerCase();

export const determineDepartments = (eventData) => {
  const departments = [];
  const reasonsByDepartment = new Map();

  const crowd = Number(eventData.crowdSize || 0);
  const eventType = toTitle(eventData.eventType);
  const venueType = toTitle(eventData.venueType);
  const trafficImpact = toTitle(eventData.trafficImpact);

  const addDepartment = (name, reason) => {
    if (!reasonsByDepartment.has(name)) {
      reasonsByDepartment.set(name, []);
      departments.push({ name, reasons: reasonsByDepartment.get(name) });
    }
    reasonsByDepartment.get(name).push(reason);
  };

  if (crowd > 200 || eventType === "religious" || eventType === "concert") {
    if (crowd > 200) addDepartment("Police Department", "Crowd exceeds 200");
    if (eventType === "religious" || eventType === "concert") {
      addDepartment("Police Department", "Event type requires crowd and security monitoring");
    }
  }

  if (eventData.fireworks || eventData.temporaryStructures || (eventData.indoorVenue && crowd > 300)) {
    if (eventData.fireworks) addDepartment("Fire Department", "Fireworks are planned");
    if (eventData.temporaryStructures) {
      addDepartment("Fire Department", "Temporary structures require fire compliance");
    }
    if (eventData.indoorVenue && crowd > 300) {
      addDepartment("Fire Department", "Indoor venue crowd exceeds 300");
    }
  }

  if (
    eventData.roadClosure ||
    crowd > 500 ||
    venueType === "street venue" ||
    trafficImpact === "medium" ||
    trafficImpact === "high"
  ) {
    if (eventData.roadClosure) addDepartment("Traffic Department", "Road closure requested");
    if (crowd > 500) addDepartment("Traffic Department", "Crowd exceeds 500");
    if (venueType === "street venue") {
      addDepartment("Traffic Department", "Street venue requires traffic diversion");
    }
    if (trafficImpact === "medium" || trafficImpact === "high") {
      addDepartment("Traffic Department", `Traffic impact marked as ${trafficImpact}`);
    }
  }

  if (venueType === "public ground" || eventData.foodStalls || eventData.wasteDisposalPlan) {
    if (venueType === "public ground") addDepartment("Municipality", "Public ground utilization");
    if (eventData.foodStalls) addDepartment("Municipality", "Food stalls are included");
    if (eventData.wasteDisposalPlan) addDepartment("Municipality", "Waste disposal plan needed");
  }

  return departments.map((department) => ({
    name: department.name,
    reason: department.reasons[0],
    allReasons: department.reasons,
  }));
};
