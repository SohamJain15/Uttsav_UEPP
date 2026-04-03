import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

const DEFAULT_VALUES = {
  eventName: "",
  eventType: "",
  crowdSize: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  venueName: "",
  venueType: "",
  address: "",
  city: "",
  wardNumber: "",
  venueOwnership: "Organizer Owned",
  stageRequired: false,
  soundSystem: false,
  temporaryStructures: false,
  foodStalls: false,
  fireworks: false,
  securityPersonnelCount: "",
  medicalFacilityAvailable: false,
  firstAidTeam: false,
  ambulanceRequired: false,
  roadClosureRequired: false,
  parkingCapacity: "",
  trafficImpact: "Low",
  publicAnnouncementSystem: false,
  wasteDisposalPlan: "",
  cleaningContractor: "",
  numberOfDustbins: "",
};

export const FORM_STEPS = [
  "Event Details",
  "Venue Details",
  "Infrastructure",
  "Safety",
  "Traffic Impact",
  "Waste Management",
  "Document Upload",
  "Review & Submit",
];

export const classifyEventSize = (crowd) => {
  const crowdCount = Number(crowd || 0);
  if (crowdCount < 100) return "SMALL";
  if (crowdCount >= 1000) return "LARGE";
  return "MEDIUM";
};

export const determineDepartments = (eventData = {}) => {
  const departments = new Set();
  const crowd = Number(eventData.crowdSize || 0);
  const eventType = (eventData.eventType || "").trim();
  const venueType = (eventData.venueType || "").trim();
  const trafficImpact = (eventData.trafficImpact || "").trim();

  if (
    crowd > 200 ||
    eventType === "Religious Event" ||
    eventType === "Public Festival" ||
    eventType === "Concert"
  ) {
    departments.add("Police");
  }

  if (eventData.fireworks || eventData.temporaryStructures || eventData.stageRequired) {
    departments.add("Fire");
  }

  if (
    eventData.roadClosureRequired ||
    crowd > 500 ||
    venueType === "Street / Road" ||
    trafficImpact === "Medium" ||
    trafficImpact === "High"
  ) {
    departments.add("Traffic");
  }

  if (venueType === "Public Ground" || eventData.foodStalls) {
    departments.add("Municipality");
  }

  return Array.from(departments);
};

export const useApplicationForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedDocuments, setUploadedDocuments] = useState({});

  const methods = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const crowdSize = methods.watch("crowdSize");
  const eventSize = useMemo(() => classifyEventSize(crowdSize), [crowdSize]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
  const goToStep = (stepIndex) => setCurrentStep(Math.min(Math.max(stepIndex, 0), FORM_STEPS.length - 1));

  const setDocument = (key, fileName) => {
    setUploadedDocuments((prev) => ({
      ...prev,
      [key]: fileName,
    }));
  };

  return {
    methods,
    currentStep,
    steps: FORM_STEPS,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === FORM_STEPS.length - 1,
    nextStep,
    prevStep,
    goToStep,
    eventSize,
    uploadedDocuments,
    setDocument,
  };
};
