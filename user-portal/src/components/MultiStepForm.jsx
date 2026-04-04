import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import DepartmentBadge from "./DepartmentBadge";
import FileUploadCard from "./FileUploadCard";
import FormInput from "./FormInput";
import GoogleMapPicker from "./GoogleMapPicker";
import ComplianceAssistant from "./ComplianceAssistant";
import ProgressStepper from "./ProgressStepper";
import ReviewCard from "./ReviewCard";
import ToggleSwitch from "./ToggleSwitch";
import { determineDepartments, useApplicationForm } from "../hooks/useApplicationForm";
import { applicationService } from "../services/applicationService";

const EVENT_TYPE_OPTIONS = [
  { value: "", label: "Select event type" },
  { value: "Private Event", label: "Private Event" },
  { value: "Religious Event", label: "Religious Event" },
  { value: "Public Festival", label: "Public Festival" },
  { value: "Concert", label: "Concert" },
  { value: "Sports Event", label: "Sports Event" },
  { value: "Exhibition", label: "Exhibition" },
];

const VENUE_TYPE_OPTIONS = [
  { value: "", label: "Select venue type" },
  { value: "Private Hall", label: "Private Hall" },
  { value: "Public Ground", label: "Public Ground" },
  { value: "Street / Road", label: "Street / Road" },
  { value: "Auditorium", label: "Auditorium" },
];

const OWNERSHIP_OPTIONS = [
  { value: "Organizer Owned", label: "Organizer Owned" },
  { value: "Venue Booking", label: "Venue Booking" },
  { value: "Public Space", label: "Public Space" },
];

const TRAFFIC_OPTIONS = [
  { value: "Low", label: "Low" },
  { value: "Medium", label: "Medium" },
  { value: "High", label: "High" },
];

const ROUTE_MODE_OPTIONS = [
  { value: "walking", label: "Walking Procession" },
  { value: "driving", label: "Vehicle Rally" },
];

const DOCUMENT_FIELDS = [
  { key: "organizerIdProof", title: "Organizer ID Proof" },
  { key: "venueOwnerConsent", title: "Venue Owner Consent" },
  { key: "crowdManagementPlan", title: "Crowd Management Plan" },
  { key: "eventLayoutPlan", title: "Event Layout Plan" },
  { key: "safetyPlan", title: "Safety Plan" },
  { key: "insuranceCertificate", title: "Insurance Certificate" },
];

const STEP_VALIDATION_FIELDS = {
  0: ["eventName", "eventType", "crowdSize", "startDate", "endDate", "startTime", "endTime"],
  1: ["venueName", "venueType", "address", "city", "wardNumber", "venueOwnership"],
  3: ["securityPersonnelCount"],
  4: ["parkingCapacity", "trafficImpact"],
};

const StepHeader = ({ title, subtitle }) => (
  <div className="mb-5">
    <h3 className="text-[22px] font-semibold text-[#0F172A]">{title}</h3>
    <p className="text-sm text-[#64748B]">{subtitle}</p>
  </div>
);

const MultiStepForm = () => {
  const navigate = useNavigate();
  const [documentError, setDocumentError] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [uploadWarning, setUploadWarning] = useState("");
  const [submittedApplication, setSubmittedApplication] = useState(null);
  const [riskAnalysis, setRiskAnalysis] = useState(null);
  const [isRiskLoading, setIsRiskLoading] = useState(false);
  const [approvalPrediction, setApprovalPrediction] = useState(null);
  const [isApprovalLoading, setIsApprovalLoading] = useState(false);
  const [routeCollision, setRouteCollision] = useState(null);
  const [isCollisionLoading, setIsCollisionLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    methods,
    currentStep,
    steps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    goToStep,
    eventSize,
    uploadedDocuments,
    setDocument,
    formData,
    updateMapLocation,
    buildSubmissionPayload,
    clearDraft, // UPDATED: Extracted clearDraft from the hook
  } = useApplicationForm();

  const venueOwnership = methods.watch("venueOwnership");
  const selectedMapLatitude = methods.watch("mapLatitude");
  const selectedMapLongitude = methods.watch("mapLongitude");
  const isMovingProcession = Boolean(methods.watch("isMovingProcession"));
  const preferredRouteId = methods.watch("preferredRouteId");
  const crowdSize = Number(methods.watch("crowdSize") || 0);
  const isLargeEvent = eventSize === "LARGE";
  const approvalWatchValues = methods.watch([
    "eventType",
    "crowdSize",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "venueType",
    "mapLatitude",
    "mapLongitude",
    "roadClosureRequired",
    "trafficImpact",
    "fireworks",
    "foodStalls",
  ]);
  const collisionWatchValues = methods.watch([
    "isMovingProcession",
    "routeOrigin",
    "routeDestination",
    "startDate",
    "endDate",
    "startTime",
    "endTime",
    "routeMode",
    "routeAlternatives",
    "preferredRouteId",
    "mapLatitude",
    "mapLongitude",
  ]);

  useEffect(() => {
    const [eventType, expectedCrowd, startDate] = approvalWatchValues;
    const shouldRunForecast = Boolean(eventType) && Boolean(startDate) && Number(expectedCrowd || 0) > 0;

    if (!shouldRunForecast) {
      setApprovalPrediction(null);
      setIsApprovalLoading(false);
      return undefined;
    }

    let isCancelled = false;
    const timerId = setTimeout(async () => {
      setIsApprovalLoading(true);
      try {
        const forecast = await applicationService.predictApprovalProbability(methods.getValues());
        if (!isCancelled) {
          setApprovalPrediction(forecast);
        }
      } finally {
        if (!isCancelled) {
          setIsApprovalLoading(false);
        }
      }
    }, 900);

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
    };
  }, [currentStep, methods, ...approvalWatchValues]);

  useEffect(() => {
    const [moving, routeOrigin, routeDestination, startDate] = collisionWatchValues;
    const hasRoute = Boolean(String(routeOrigin || "").trim()) && Boolean(String(routeDestination || "").trim());
    const shouldRunCollision = Boolean(moving) && hasRoute && Boolean(startDate);

    if (!moving) {
      setRouteCollision(null);
      setIsCollisionLoading(false);
      return undefined;
    }

    if (!shouldRunCollision) {
      setRouteCollision({
        collisionStatus: "INPUT_REQUIRED",
        recommendations: ["Provide route origin, destination, and start date to run 4D collision checks."],
      });
      setIsCollisionLoading(false);
      return undefined;
    }

    let isCancelled = false;
    const timerId = setTimeout(async () => {
      setIsCollisionLoading(true);
      try {
        const collisionResult = await applicationService.checkRouteCollision(methods.getValues());
        if (!isCancelled) {
          setRouteCollision(collisionResult);
          if (collisionResult?.recommendedRouteId && !methods.getValues("preferredRouteId")) {
            methods.setValue("preferredRouteId", collisionResult.recommendedRouteId, {
              shouldDirty: true,
              shouldValidate: false,
            });
          }
        }
      } finally {
        if (!isCancelled) {
          setIsCollisionLoading(false);
        }
      }
    }, 1100);

    return () => {
      isCancelled = true;
      clearTimeout(timerId);
    };
  }, [currentStep, methods, ...collisionWatchValues]);

  const isDocumentRequired = (documentKey) => {
    switch (documentKey) {
      case "organizerIdProof":
        return true;
      case "venueOwnerConsent":
        return venueOwnership === "Venue Booking";
      case "crowdManagementPlan":
        return crowdSize > 500;
      case "insuranceCertificate":
        return isLargeEvent;
      default:
        return false;
    }
  };

  const getRequiredDocumentKeys = () =>
    DOCUMENT_FIELDS.filter((field) => isDocumentRequired(field.key)).map((field) => field.key);

  const onToggleChange = (fieldName) => (event) => {
    methods.setValue(fieldName, event.target.checked, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleMapLocationSelect = ({ lat, lng, address }) => {
    updateMapLocation({ lat, lng, address });
  };

  const handleNext = async () => {
    setDocumentError("");

    let fieldsToValidate = STEP_VALIDATION_FIELDS[currentStep] || [];
    if (currentStep === 4 && isMovingProcession) {
      fieldsToValidate = [...new Set([...fieldsToValidate, "routeOrigin", "routeDestination"])];
    }
    if (currentStep === 5 && isLargeEvent) {
      fieldsToValidate = ["wasteDisposalPlan", "cleaningContractor", "numberOfDustbins"];
    }

    if (fieldsToValidate.length > 0) {
      const valid = await methods.trigger(fieldsToValidate);
      if (!valid) return;
    }

    if (currentStep === 6) {
      const requiredDocumentKeys = getRequiredDocumentKeys();

      const allPresent = requiredDocumentKeys.every((key) => Boolean(uploadedDocuments[key]?.name));
      if (!allPresent) {
        setDocumentError("Please upload all required documents to continue.");
        return;
      }

      setIsRiskLoading(true);
      try {
        const riskResult = await applicationService.calculateRisk(methods.getValues());
        setRiskAnalysis(riskResult);
      } finally {
        setIsRiskLoading(false);
      }
    }

    nextStep();
  };

  const submitWizard = methods.handleSubmit(async (values) => {
    const requiredDocumentKeys = getRequiredDocumentKeys();
    const allRequiredPresent = requiredDocumentKeys.every((key) => Boolean(uploadedDocuments[key]?.name));
    if (!allRequiredPresent) {
      setDocumentError("Please upload all required documents before submission.");
      goToStep(6);
      return;
    }

    setSubmissionError("");
    setUploadWarning("");
    setIsSubmitting(true);

    try {
      const latestRiskResult = riskAnalysis || (await applicationService.calculateRisk(values));
      const normalizedRiskLevel = `${String(latestRiskResult?.level || "Medium").toUpperCase()} RISK`;
      const basePayload = buildSubmissionPayload(values);

      const createdApplication = await applicationService.createApplication({
        ...basePayload,
        eventSize,
        aiRiskAnalysis: latestRiskResult,
        approvalForecast: approvalPrediction,
        routeCollisionForecast: routeCollision,
      });

      const createdApplicationId = createdApplication?.id;
      if (!createdApplicationId) {
        throw new Error("Application was created, but tracking id is unavailable.");
      }

      const uploadQueue = Object.entries(uploadedDocuments)
        .map(([key, value]) => ({ key, file: value?.file, name: value?.name }))
        .filter((entry) => entry.file instanceof File);

      if (uploadQueue.length > 0) {
        const uploadResults = await Promise.allSettled(
          uploadQueue.map((entry) => {
            const formData = new FormData();
            formData.append("app_id", createdApplicationId);
            formData.append("file", entry.file, entry.name || entry.file.name);
            return applicationService.uploadDocument(formData);
          })
        );

        const failedUploads = uploadResults.filter((result) => result.status === "rejected");
        if (failedUploads.length > 0) {
          setUploadWarning(
            `Application submitted, but ${failedUploads.length} document upload(s) failed. You can re-upload them from Documents.`
          );
        }
      }

      const departmentsRequired =
        Array.isArray(createdApplication?.requiredDepartments) &&
        createdApplication.requiredDepartments.length > 0
          ? createdApplication.requiredDepartments
          : determineDepartments(values);

      // UPDATED: Wipe the draft from local storage because submission succeeded
      clearDraft();

      setRiskAnalysis(latestRiskResult);
      setSubmittedApplication({
        id: createdApplicationId,
        riskLevel: normalizedRiskLevel,
        departmentsRequired,
      });
    } catch (error) {
      setSubmissionError(
        applicationService.getErrorMessage(
          error,
          "Failed to submit the application. Please verify backend connectivity and try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  });

  if (submittedApplication) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF3]">
            <CheckCircle2 size={28} className="text-[#16A34A]" />
          </div>
          <h3 className="text-[26px] font-semibold text-[#0F172A]">Application Submitted</h3>
          <p className="mt-2 text-[#64748B]">Your smart event application has been submitted successfully.</p>

          <article className="mt-6 rounded-xl border border-gray-200 bg-[#F8FAFC] p-5 text-left">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#64748B]">Application ID</p>
                <p className="text-lg font-semibold text-[#0F172A]">{submittedApplication.id}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[#64748B]">Risk Level</p>
                <span className="inline-flex rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
                  {submittedApplication.riskLevel}
                </span>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs uppercase tracking-wide text-[#64748B]">Departments Required</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(submittedApplication.departmentsRequired || []).map((department) => (
                  <DepartmentBadge key={department} label={department} />
                ))}
              </div>
            </div>
          </article>

          {uploadWarning ? (
            <p className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
              {uploadWarning}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => navigate(`/applications/${submittedApplication.id}`)}
            className="mt-6 rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1D4ED8]"
          >
            View Application Tracking
          </button>
        </div>
      </section>
    );
  }

  const renderStepOne = () => (
    <>
      <StepHeader title="Event Details" subtitle="Provide key details of your event." />
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          label="Event Name"
          placeholder="Enter event name"
          error={methods.formState.errors.eventName?.message}
          helperText="Use the official event title."
          {...methods.register("eventName", { required: "This field is required" })}
        />

        <FormInput
          as="select"
          label="Event Type"
          options={EVENT_TYPE_OPTIONS}
          error={methods.formState.errors.eventType?.message}
          {...methods.register("eventType", { required: "This field is required" })}
        />

        <div>
          <FormInput
            type="number"
            label="Expected Crowd"
            min={1}
            placeholder="Enter expected attendees"
            error={methods.formState.errors.crowdSize?.message}
            helperText="Used for event-size and approval routing."
            {...methods.register("crowdSize", {
              required: "This field is required",
              min: { value: 1, message: "This field is required" },
            })}
          />
          <div className="mt-2 inline-flex items-center rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
            Event Size: {eventSize}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            type="date"
            label="Start Date"
            error={methods.formState.errors.startDate?.message}
            {...methods.register("startDate", { required: "This field is required" })}
          />
          <FormInput
            type="date"
            label="End Date"
            error={methods.formState.errors.endDate?.message}
            {...methods.register("endDate", { required: "This field is required" })}
          />
        </div>

        <FormInput
          type="time"
          label="Start Time"
          error={methods.formState.errors.startTime?.message}
          {...methods.register("startTime", { required: "This field is required" })}
        />

        <FormInput
          type="time"
          label="End Time"
          error={methods.formState.errors.endTime?.message}
          {...methods.register("endTime", { required: "This field is required" })}
        />
      </div>
    </>
  );

  const renderStepTwo = () => (
    <>
      <StepHeader title="Venue Details" subtitle="Add location details for venue approvals." />
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          label="Venue Name"
          placeholder="Enter venue name"
          error={methods.formState.errors.venueName?.message}
          {...methods.register("venueName", { required: "This field is required" })}
        />

        <FormInput
          as="select"
          label="Venue Type"
          options={VENUE_TYPE_OPTIONS}
          error={methods.formState.errors.venueType?.message}
          {...methods.register("venueType", { required: "This field is required" })}
        />

        <FormInput
          label="Address"
          placeholder="Enter complete venue address"
          error={methods.formState.errors.address?.message}
          {...methods.register("address", { required: "This field is required" })}
        />

        <FormInput
          label="City"
          placeholder="Enter city"
          error={methods.formState.errors.city?.message}
          {...methods.register("city", { required: "This field is required" })}
        />

        <FormInput
          label="Ward Number"
          placeholder="Enter ward number"
          error={methods.formState.errors.wardNumber?.message}
          {...methods.register("wardNumber", { required: "This field is required" })}
        />

        <FormInput
          as="select"
          label="Venue Ownership"
          options={OWNERSHIP_OPTIONS}
          error={methods.formState.errors.venueOwnership?.message}
          {...methods.register("venueOwnership", { required: "This field is required" })}
        />
      </div>

      <div className="mt-6">
        <GoogleMapPicker
          latitude={selectedMapLatitude}
          longitude={selectedMapLongitude}
          onLocationSelect={handleMapLocationSelect}
        />
      </div>

      {venueOwnership === "Venue Booking" ? (
        <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <p className="text-sm font-semibold text-[#92400E]">Additional Document Required: Venue Owner Consent</p>
          <p className="mt-1 text-sm text-[#B45309]">Examples: Hall booking receipt, owner authorization letter</p>
          <div className="mt-4">
            <FileUploadCard
              title="Venue Owner Consent"
              required
              uploadedFile={uploadedDocuments.venueOwnerConsent}
              onFileSelected={(name, file) => setDocument("venueOwnerConsent", name, file)}
            />
          </div>
        </div>
      ) : null}
    </>
  );

  const renderStepThree = () => (
    <>
      <StepHeader title="Infrastructure" subtitle="Enable infrastructure options required for the event." />
      <div className="grid gap-6 md:grid-cols-2">
        <ToggleSwitch
          label="Stage Required"
          checked={methods.watch("stageRequired")}
          onChange={onToggleChange("stageRequired")}
        />
        <ToggleSwitch
          label="Sound System"
          checked={methods.watch("soundSystem")}
          onChange={onToggleChange("soundSystem")}
        />
        <ToggleSwitch
          label="Temporary Structures"
          checked={methods.watch("temporaryStructures")}
          onChange={onToggleChange("temporaryStructures")}
        />
        <ToggleSwitch
          label="Food Stalls"
          checked={methods.watch("foodStalls")}
          onChange={onToggleChange("foodStalls")}
        />
        <ToggleSwitch
          label="Fireworks"
          checked={methods.watch("fireworks")}
          onChange={onToggleChange("fireworks")}
        />
      </div>
    </>
  );

  const renderStepFour = () => (
    <>
      <StepHeader title="Safety" subtitle="Capture event safety and emergency preparedness details." />
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          type="number"
          label="Security Personnel Count"
          min={0}
          error={methods.formState.errors.securityPersonnelCount?.message}
          {...methods.register("securityPersonnelCount", {
            required: "This field is required",
            min: { value: 0, message: "This field is required" },
          })}
        />

        <ToggleSwitch
          label="Medical Facility Available"
          checked={methods.watch("medicalFacilityAvailable")}
          onChange={onToggleChange("medicalFacilityAvailable")}
        />

        <ToggleSwitch
          label="First Aid Team"
          checked={methods.watch("firstAidTeam")}
          onChange={onToggleChange("firstAidTeam")}
        />

        <ToggleSwitch
          label="Ambulance Required"
          checked={methods.watch("ambulanceRequired")}
          onChange={onToggleChange("ambulanceRequired")}
        />
      </div>

      <div className="mt-6">
        <FileUploadCard
          title="Crowd Management Plan"
          required={isDocumentRequired("crowdManagementPlan")}
          helperText={isDocumentRequired("crowdManagementPlan") ? "Required for crowd above 500" : "Optional upload"}
          uploadedFile={uploadedDocuments.crowdManagementPlan}
          onFileSelected={(name, file) => setDocument("crowdManagementPlan", name, file)}
        />
      </div>
    </>
  );

  const renderStepFive = () => (
    <>
      <StepHeader title="Traffic Impact" subtitle="Provide traffic management and road impact details." />
      <div className="grid gap-6 md:grid-cols-2">
        <ToggleSwitch
          label="Road Closure Required"
          checked={methods.watch("roadClosureRequired")}
          onChange={onToggleChange("roadClosureRequired")}
        />

        <ToggleSwitch
          label="Moving Procession / Rally"
          checked={methods.watch("isMovingProcession")}
          onChange={onToggleChange("isMovingProcession")}
        />

        <FormInput
          type="number"
          label="Parking Capacity"
          min={0}
          error={methods.formState.errors.parkingCapacity?.message}
          {...methods.register("parkingCapacity", {
            required: "This field is required",
            min: { value: 0, message: "This field is required" },
          })}
        />

        <FormInput
          as="select"
          label="Expected Traffic Impact"
          options={TRAFFIC_OPTIONS}
          error={methods.formState.errors.trafficImpact?.message}
          {...methods.register("trafficImpact", { required: "This field is required" })}
        />

        <ToggleSwitch
          label="Public Announcement System"
          checked={methods.watch("publicAnnouncementSystem")}
          onChange={onToggleChange("publicAnnouncementSystem")}
        />
      </div>

      {isMovingProcession ? (
        <div className="mt-6 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
          <h4 className="text-sm font-semibold text-[#1E3A8A]">Moving Event Route Details</h4>
          <p className="mt-1 text-xs text-[#475569]">
            Required for 4D spatio-temporal clash checks (route + time collisions).
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <FormInput
              label="Route Origin"
              placeholder="e.g. Siddhivinayak Temple, Dadar"
              error={methods.formState.errors.routeOrigin?.message}
              {...methods.register("routeOrigin", isMovingProcession ? { required: "This field is required" } : {})}
            />

            <FormInput
              label="Route Destination"
              placeholder="e.g. Girgaon Chowpatty"
              error={methods.formState.errors.routeDestination?.message}
              {...methods.register(
                "routeDestination",
                isMovingProcession ? { required: "This field is required" } : {}
              )}
            />

            <FormInput
              as="select"
              label="Route Mode"
              options={ROUTE_MODE_OPTIONS}
              error={methods.formState.errors.routeMode?.message}
              {...methods.register("routeMode")}
            />

            <div className="rounded-lg border border-[#BFDBFE] bg-white p-3">
              <ToggleSwitch
                label="Fetch Alternate Routes"
                checked={methods.watch("routeAlternatives")}
                onChange={onToggleChange("routeAlternatives")}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  const renderStepSix = () => {
    const wasteRule = isLargeEvent ? { required: "This field is required" } : {};

    return (
      <>
        <StepHeader title="Waste Management" subtitle="Capture sanitation and cleanup commitments." />
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          {isLargeEvent ? "Required for large events" : "Optional for small and medium events"}
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <FormInput
            as="textarea"
            rows={4}
            label="Waste Disposal Plan"
            error={methods.formState.errors.wasteDisposalPlan?.message}
            {...methods.register("wasteDisposalPlan", wasteRule)}
          />

          <FormInput
            label="Cleaning Contractor"
            placeholder="Enter contractor name"
            error={methods.formState.errors.cleaningContractor?.message}
            {...methods.register("cleaningContractor", wasteRule)}
          />

          <FormInput
            type="number"
            min={0}
            label="Number of Dustbins"
            error={methods.formState.errors.numberOfDustbins?.message}
            {...methods.register("numberOfDustbins", {
              ...wasteRule,
              validate: (value) => !value || Number(value) >= 0 || "This field is required",
            })}
          />
        </div>
      </>
    );
  };

  const renderStepSeven = () => (
    <>
      <StepHeader title="Document Upload" subtitle="Upload required event documents." />
      <div className="grid gap-6 md:grid-cols-2">
        {DOCUMENT_FIELDS.map((field) => (
          <FileUploadCard
            key={field.key}
            title={field.title}
            required={isDocumentRequired(field.key)}
            uploadedFile={uploadedDocuments[field.key]}
            onFileSelected={(name, file) => setDocument(field.key, name, file)}
          />
        ))}
      </div>
      {documentError ? <p className="mt-4 text-sm font-medium text-[#DC2626]">{documentError}</p> : null}
    </>
  );

  const renderStepEight = () => {
    const summary = formData;
    const reviewRiskLevel = String(riskAnalysis?.level || "Medium").toUpperCase();

    return (
      <>
        <StepHeader title="Review & Submit" subtitle="Verify all details before submitting." />

        <div className="grid gap-6 md:grid-cols-2">
          <ReviewCard
            title="Event Details"
            items={[
              { label: "Event Name", value: summary.eventDetails.eventName },
              { label: "Event Type", value: summary.eventDetails.eventType },
              { label: "Expected Crowd", value: summary.eventDetails.crowdSize },
              { label: "Event Size", value: eventSize },
              {
                label: "Start",
                value: `${summary.eventDetails.startDate || "-"} ${summary.eventDetails.startTime || ""}`.trim(),
              },
              {
                label: "End",
                value: `${summary.eventDetails.endDate || "-"} ${summary.eventDetails.endTime || ""}`.trim(),
              },
            ]}
          />

          <ReviewCard
            title="Venue Details"
            items={[
              { label: "Venue Name", value: summary.venueDetails.venueName },
              { label: "Venue Type", value: summary.venueDetails.venueType },
              { label: "Address", value: summary.venueDetails.address },
              { label: "City", value: summary.venueDetails.city },
              { label: "Ward Number", value: summary.venueDetails.wardNumber },
              { label: "Venue Ownership", value: summary.venueDetails.venueOwnership },
              { label: "Map URL", value: summary.venueDetails.mapLocationUrl },
            ]}
          />

          <ReviewCard
            title="Infrastructure"
            items={[
              { label: "Stage Required", value: summary.infrastructure.stageRequired ? "Yes" : "No" },
              { label: "Sound System", value: summary.infrastructure.soundSystem ? "Yes" : "No" },
              {
                label: "Temporary Structures",
                value: summary.infrastructure.temporaryStructures ? "Yes" : "No",
              },
              { label: "Food Stalls", value: summary.infrastructure.foodStalls ? "Yes" : "No" },
              { label: "Fireworks", value: summary.infrastructure.fireworks ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Safety"
            items={[
              { label: "Security Personnel", value: summary.safety.securityPersonnelCount },
              { label: "Medical Facility", value: summary.safety.medicalFacilityAvailable ? "Yes" : "No" },
              { label: "First Aid Team", value: summary.safety.firstAidTeam ? "Yes" : "No" },
              { label: "Ambulance Required", value: summary.safety.ambulanceRequired ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Traffic"
            items={[
              { label: "Road Closure", value: summary.traffic.roadClosureRequired ? "Yes" : "No" },
              { label: "Moving Procession", value: summary.traffic.isMovingProcession ? "Yes" : "No" },
              { label: "Route Origin", value: summary.traffic.routeOrigin },
              { label: "Route Destination", value: summary.traffic.routeDestination },
              { label: "Route Mode", value: summary.traffic.routeMode },
              { label: "Parking Capacity", value: summary.traffic.parkingCapacity },
              { label: "Traffic Impact", value: summary.traffic.trafficImpact },
              { label: "PA System", value: summary.traffic.publicAnnouncementSystem ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Waste"
            items={[
              { label: "Waste Plan", value: summary.waste.wasteDisposalPlan },
              { label: "Cleaning Contractor", value: summary.waste.cleaningContractor },
              { label: "Dustbins", value: summary.waste.numberOfDustbins },
            ]}
          />
        </div>

        <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <p className="text-xs uppercase tracking-wide text-[#92400E]">Risk Level</p>
          <span className="mt-1 inline-flex rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#B45309]">
            {reviewRiskLevel} RISK
          </span>
          <p className="mt-3 text-sm text-[#92400E]">
            {riskAnalysis?.aiRecommendation || "AI recommendation will appear after risk analysis."}
          </p>
          {riskAnalysis?.confidence !== null && riskAnalysis?.confidence !== undefined ? (
            <p className="mt-1 text-xs font-medium text-[#B45309]">
              Confidence: {riskAnalysis.confidence}%
            </p>
          ) : null}
        </div>
      </>
    );
  };

  const renderApprovalForecastPanel = () => {
    const probability = approvalPrediction?.probability;
    const hasForecast = typeof probability === "number";
    const bandLabel = approvalPrediction?.bandLabel || "Awaiting Forecast";
    const nearbyCount = approvalPrediction?.summary?.nearby_events;
    const concurrentCount = approvalPrediction?.summary?.concurrent_events;
    const historyCount = approvalPrediction?.summary?.history_events_considered;

    return (
      <section className="mt-6 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[#1E3A8A]">Approval Probability Forecast</h4>
            <p className="text-xs text-[#475569]">
              Spatial-temporal estimate based on event profile and historical patterns.
            </p>
          </div>
          {isApprovalLoading ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#1D4ED8]">
              Forecasting...
            </span>
          ) : hasForecast ? (
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#1E40AF]">
              {bandLabel}
            </span>
          ) : null}
        </div>

        {hasForecast ? (
          <>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-[#BFDBFE] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#64748B]">Approval Chance</p>
                <p className="mt-1 text-lg font-semibold text-[#0F172A]">{probability.toFixed(1)}%</p>
              </div>
              <div className="rounded-lg border border-[#BFDBFE] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#64748B]">Nearby Concurrent Events</p>
                <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                  {typeof nearbyCount === "number" ? nearbyCount : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-[#BFDBFE] bg-white p-3">
                <p className="text-xs uppercase tracking-wide text-[#64748B]">Time-Overlap Events</p>
                <p className="mt-1 text-lg font-semibold text-[#0F172A]">
                  {typeof concurrentCount === "number" ? concurrentCount : "-"}
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {Array.isArray(approvalPrediction?.recommendations) &&
              approvalPrediction.recommendations.length > 0 ? (
                approvalPrediction.recommendations.slice(0, 2).map((tip) => (
                  <p key={tip} className="text-sm text-[#1E3A8A]">
                    - {tip}
                  </p>
                ))
              ) : (
                <p className="text-sm text-[#1E3A8A]">
                  - Keep all mandatory documents complete for faster review.
                </p>
              )}
            </div>

            <p className="mt-3 text-[11px] text-[#64748B]">
              History events used: {typeof historyCount === "number" ? historyCount : 0} | Model:{" "}
              {approvalPrediction?.modelVersion || "unknown"}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-[#1E3A8A]">
            Fill event type, crowd size, and schedule to get a live approval forecast.
          </p>
        )}
      </section>
    );
  };

  const renderCollisionPanel = () => {
    if (!isMovingProcession) return null;

    const collisionStatus = String(routeCollision?.collisionStatus || "INPUT_REQUIRED").toUpperCase();
    const routeOptions = Array.isArray(routeCollision?.routeOptions) ? routeCollision.routeOptions : [];
    const warnings = Array.isArray(routeCollision?.warnings) ? routeCollision.warnings : [];
    const recommendations = Array.isArray(routeCollision?.recommendations)
      ? routeCollision.recommendations
      : [];

    const statusTextByKey = {
      SAFE: "Safe Route",
      WARNING: "Warning",
      SEVERE_WARNING: "Severe Warning",
      UNKNOWN: "Provisional",
      INPUT_REQUIRED: "Input Required",
      NOT_APPLICABLE: "Not Applicable",
      SERVICE_UNAVAILABLE: "Service Unavailable",
    };

    const statusClassByKey = {
      SAFE: "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]",
      WARNING: "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]",
      SEVERE_WARNING: "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]",
      UNKNOWN: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]",
      INPUT_REQUIRED: "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]",
      NOT_APPLICABLE: "border-[#E5E7EB] bg-[#F8FAFC] text-[#334155]",
      SERVICE_UNAVAILABLE: "border-[#E5E7EB] bg-[#F8FAFC] text-[#334155]",
    };

    return (
      <section className="mt-6 rounded-xl border border-[#BFDBFE] bg-[#F8FAFC] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold text-[#1E3A8A]">4D Route Collision Check</h4>
            <p className="text-xs text-[#475569]">
              Live route-time clash detection for moving processions and rallies.
            </p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              statusClassByKey[collisionStatus] || statusClassByKey.INPUT_REQUIRED
            }`}
          >
            {isCollisionLoading ? "Analyzing..." : statusTextByKey[collisionStatus] || collisionStatus}
          </span>
        </div>

        {routeOptions.length > 0 ? (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {routeOptions.map((route) => {
              const routeId = route.route_id || "";
              const isSelected = routeId && routeId === (preferredRouteId || routeCollision?.selectedRoute?.route_id);
              const collision = route.collision || {};
              return (
                <button
                  key={routeId || route.summary}
                  type="button"
                  onClick={() =>
                    methods.setValue("preferredRouteId", routeId, { shouldDirty: true, shouldValidate: false })
                  }
                  className={`rounded-lg border bg-white p-3 text-left transition ${
                    isSelected ? "border-[#1D4ED8] shadow-sm" : "border-[#BFDBFE] hover:border-[#60A5FA]"
                  }`}
                >
                  <p className="text-sm font-semibold text-[#0F172A]">{route.summary || routeId}</p>
                  <p className="mt-1 text-xs text-[#475569]">
                    {route.total_distance || "-"} | {route.total_duration || "-"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#1E3A8A]">
                    Score: {typeof collision.score === "number" ? collision.score.toFixed(2) : "0.00"} | Conflicts:{" "}
                    {collision.conflict_count ?? 0}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}

        {warnings.length > 0 ? (
          <div className="mt-3 space-y-2">
            {warnings.slice(0, 2).map((warning, index) => (
              <p key={`${warning.existing_event_id || "evt"}-${index}`} className="text-sm text-[#92400E]">
                - {warning.severity}: {warning.existing_event_name} within{" "}
                {typeof warning.distance_meters === "number"
                  ? `${warning.distance_meters.toFixed(0)}m`
                  : "nearby range"}
                .
              </p>
            ))}
          </div>
        ) : null}

        {recommendations.length > 0 ? (
          <div className="mt-3 space-y-1">
            {recommendations.slice(0, 2).map((item) => (
              <p key={item} className="text-sm text-[#1E3A8A]">
                - {item}
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#1E3A8A]">
            Provide route origin and destination to evaluate clash risk for this moving event.
          </p>
        )}
      </section>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderStepOne();
      case 1:
        return renderStepTwo();
      case 2:
        return renderStepThree();
      case 3:
        return renderStepFour();
      case 4:
        return renderStepFive();
      case 5:
        return renderStepSix();
      case 6:
        return renderStepSeven();
      case 7:
        return renderStepEight();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <ProgressStepper currentStep={currentStep} steps={steps} />

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <form onSubmit={submitWizard}>
          {renderCurrentStep()}
          {renderApprovalForecastPanel()}
          {renderCollisionPanel()}
          <ComplianceAssistant
            currentStep={currentStep}
            stepName={steps[currentStep]}
            formContext={methods.getValues()}
          />

          {submissionError ? (
            <p className="mt-5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
              {submissionError}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-5">
            <button
              type="button"
              onClick={prevStep}
              disabled={isFirstStep || isSubmitting}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {isLastStep ? (
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={isRiskLoading || isSubmitting}
                className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {currentStep === 6 && isRiskLoading ? "Analyzing Risk..." : "Next"}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
};

export default MultiStepForm;
