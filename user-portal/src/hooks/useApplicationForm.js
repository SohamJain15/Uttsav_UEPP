import { useEffect, useMemo, useRef, useState } from "react";
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
  mapLatitude: "",
  mapLongitude: "",
  mapLocationUrl: "",
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

const createSharedFormData = (values = {}, documents = {}) => ({
  eventDetails: {
    eventName: values.eventName || "",
    eventType: values.eventType || "",
    crowdSize: values.crowdSize || "",
    startDate: values.startDate || "",
    endDate: values.endDate || "",
    startTime: values.startTime || "",
    endTime: values.endTime || "",
  },
  venueDetails: {
    venueName: values.venueName || "",
    venueType: values.venueType || "",
    address: values.address || "",
    city: values.city || "",
    wardNumber: values.wardNumber || "",
    venueOwnership: values.venueOwnership || "",
    mapLatitude: values.mapLatitude || "",
    mapLongitude: values.mapLongitude || "",
    mapLocationUrl: values.mapLocationUrl || "",
  },
  infrastructure: {
    stageRequired: Boolean(values.stageRequired),
    soundSystem: Boolean(values.soundSystem),
    temporaryStructures: Boolean(values.temporaryStructures),
    foodStalls: Boolean(values.foodStalls),
    fireworks: Boolean(values.fireworks),
  },
  safety: {
    securityPersonnelCount: values.securityPersonnelCount || "",
    medicalFacilityAvailable: Boolean(values.medicalFacilityAvailable),
    firstAidTeam: Boolean(values.firstAidTeam),
    ambulanceRequired: Boolean(values.ambulanceRequired),
  },
  traffic: {
    roadClosureRequired: Boolean(values.roadClosureRequired),
    parkingCapacity: values.parkingCapacity || "",
    trafficImpact: values.trafficImpact || "",
    publicAnnouncementSystem: Boolean(values.publicAnnouncementSystem),
  },
  waste: {
    wasteDisposalPlan: values.wasteDisposalPlan || "",
    cleaningContractor: values.cleaningContractor || "",
    numberOfDustbins: values.numberOfDustbins || "",
  },
  documents,
  mapLocationUrl: values.mapLocationUrl || "",
});

export const useApplicationForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedDocuments, setUploadedDocuments] = useState({});

  const methods = useForm({
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const uploadedDocumentsRef = useRef(uploadedDocuments);
  const [formData, setFormData] = useState(() =>
    createSharedFormData(DEFAULT_VALUES, uploadedDocuments)
  );

  useEffect(() => {
    uploadedDocumentsRef.current = uploadedDocuments;
    setFormData(createSharedFormData(methods.getValues(), uploadedDocuments));
  }, [uploadedDocuments, methods]);

  useEffect(() => {
    const subscription = methods.watch((values) => {
      setFormData(createSharedFormData(values, uploadedDocumentsRef.current));
    });

    return () => subscription.unsubscribe();
  }, [methods]);

  const crowdSize = methods.watch("crowdSize");
  const eventSize = useMemo(() => classifyEventSize(crowdSize), [crowdSize]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
  const goToStep = (stepIndex) => setCurrentStep(Math.min(Math.max(stepIndex, 0), FORM_STEPS.length - 1));

  const setDocument = (key, fileName, fileObject) => {
    const normalizedName =
      typeof fileName === "string" ? fileName : fileObject?.name || fileName?.name || "";
    const normalizedFile = fileObject || (fileName instanceof File ? fileName : null);

    setUploadedDocuments((prev) => ({
      ...prev,
      [key]: {
        name: normalizedName,
        file: normalizedFile,
      },
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
    formData,
    setDocument,
  };
};
