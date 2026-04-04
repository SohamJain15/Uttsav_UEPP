import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

const DRAFT_STORAGE_KEY = "uttsav_application_draft";

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
  isMovingProcession: false,
  routeOrigin: "",
  routeDestination: "",
  preferredRouteId: "",
  routeMode: "walking",
  routeAlternatives: true,
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
    eventData.isMovingProcession ||
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

  if (eventData.isMovingProcession) {
    departments.add("Police");
  }

  return Array.from(departments);
};

const normalizeCoordinate = (value) => {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) return "";
  return String(parsedValue);
};

const createMapLocationUrl = (latitude, longitude) => {
  if (latitude === "" || latitude == null || longitude === "" || longitude == null) return "";
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
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
    isMovingProcession: Boolean(values.isMovingProcession),
    routeOrigin: values.routeOrigin || "",
    routeDestination: values.routeDestination || "",
    preferredRouteId: values.preferredRouteId || "",
    routeMode: values.routeMode || "walking",
    routeAlternatives:
      values.routeAlternatives === undefined ? true : Boolean(values.routeAlternatives),
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
  address: values.address || "",
  mapLatitude: values.mapLatitude || "",
  mapLongitude: values.mapLongitude || "",
  mapLocationUrl: values.mapLocationUrl || "",
});

const loadDraftData = () => {
  try {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      return { ...DEFAULT_VALUES, ...JSON.parse(savedDraft) };
    }
  } catch (error) {
    console.warn("Failed to load form draft from local storage", error);
  }
  return DEFAULT_VALUES;
};

export const useApplicationForm = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedDocuments, setUploadedDocuments] = useState({});

  const methods = useForm({
    defaultValues: loadDraftData(),
    mode: "onBlur",
  });

  const uploadedDocumentsRef = useRef(uploadedDocuments);
  const [formData, setFormData] = useState(() =>
    createSharedFormData(methods.getValues(), uploadedDocuments)
  );

  useEffect(() => {
    uploadedDocumentsRef.current = uploadedDocuments;
    setFormData(createSharedFormData(methods.getValues(), uploadedDocuments));
  }, [uploadedDocuments, methods]);

  useEffect(() => {
    const subscription = methods.watch((values) => {
      // Actively save the user's progress to a local draft
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
      setFormData(createSharedFormData(values, uploadedDocumentsRef.current));
    });

    return () => subscription.unsubscribe();
  }, [methods]);

  const crowdSize = methods.watch("crowdSize");
  const eventSize = useMemo(() => classifyEventSize(crowdSize), [crowdSize]);

  const nextStep = () => setCurrentStep((prev) => Math.min(prev + 1, FORM_STEPS.length - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));
  const goToStep = (stepIndex) => setCurrentStep(Math.min(Math.max(stepIndex, 0), FORM_STEPS.length - 1));

  const clearDraft = () => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    methods.reset(DEFAULT_VALUES); // Reset the form UI back to default
  };

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

  const updateMapLocation = ({ lat, lng, address }) => {
    const latitude = normalizeCoordinate(lat);
    const longitude = normalizeCoordinate(lng);
    const formattedAddress = typeof address === "string" ? address.trim() : "";

    methods.setValue("mapLatitude", latitude, { shouldDirty: true, shouldValidate: false });
    methods.setValue("mapLongitude", longitude, { shouldDirty: true, shouldValidate: false });
    methods.setValue("mapLocationUrl", createMapLocationUrl(latitude, longitude), {
      shouldDirty: true,
      shouldValidate: false,
    });

    if (formattedAddress) {
      methods.setValue("address", formattedAddress, { shouldDirty: true, shouldValidate: false });
    }
  };

  const buildSubmissionPayload = (values = methods.getValues()) => {
    const sharedFormData = createSharedFormData(values, uploadedDocumentsRef.current);

    return {
      ...values,
      ...sharedFormData,
      address: sharedFormData.address,
      mapLatitude: sharedFormData.mapLatitude,
      mapLongitude: sharedFormData.mapLongitude,
      documents: uploadedDocumentsRef.current,
    };
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
    clearDraft, // Exposing clearDraft
    eventSize,
    uploadedDocuments,
    formData,
    setDocument,
    updateMapLocation,
    buildSubmissionPayload,
  };
};