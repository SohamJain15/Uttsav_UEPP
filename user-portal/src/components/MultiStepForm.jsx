import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileText, MapPin, ShieldCheck, Users } from "lucide-react";
import DepartmentBadge from "./DepartmentBadge";
import FileUploadCard from "./FileUploadCard";
import FormInput from "./FormInput";
import ProgressStepper from "./ProgressStepper";
import ReviewCard from "./ReviewCard";
import ToggleSwitch from "./ToggleSwitch";
import { determineDepartments, useApplicationForm } from "../hooks/useApplicationForm";

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

const DOCUMENT_FIELDS = [
  { key: "organizerIdProof", title: "Organizer ID Proof", required: true },
  { key: "venueOwnerConsent", title: "Venue Owner Consent", required: false },
  { key: "eventLayoutPlan", title: "Event Layout Plan", required: true },
  { key: "safetyPlan", title: "Safety Plan", required: true },
  { key: "insuranceCertificate", title: "Insurance Certificate", required: true },
];

const STEP_VALIDATION_FIELDS = {
  0: ["eventName", "eventType", "crowdSize", "startDate", "endDate", "startTime", "endTime"],
  1: ["venueName", "venueType", "address", "city", "wardNumber", "venueOwnership"],
  3: ["securityPersonnelCount"],
  4: ["parkingCapacity", "trafficImpact"],
  5: ["wasteDisposalPlan", "cleaningContractor", "numberOfDustbins"],
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
  const [submittedApplication, setSubmittedApplication] = useState(null);
  const {
    methods,
    currentStep,
    steps,
    isFirstStep,
    isLastStep,
    nextStep,
    prevStep,
    eventSize,
    uploadedDocuments,
    setDocument,
  } = useApplicationForm();

  const formValues = methods.watch();
  const venueOwnership = methods.watch("venueOwnership");

  const departmentsRequired = useMemo(() => determineDepartments(formValues), [formValues]);

  const renderEventSizeBadge = () => (
    <span className="inline-flex items-center rounded-full border border-[#FCD34D] bg-[#FFFBEB] px-3 py-1 text-xs font-semibold text-[#B45309]">
      Event Size: {eventSize}
    </span>
  );

  const onToggleChange = (fieldName) => (event) => {
    methods.setValue(fieldName, event.target.checked, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const handleNext = async () => {
    setDocumentError("");

    const fieldsToValidate = STEP_VALIDATION_FIELDS[currentStep] || [];
    if (fieldsToValidate.length > 0) {
      const valid = await methods.trigger(fieldsToValidate);
      if (!valid) return;
    }

    if (currentStep === 6) {
      const requiredDocumentKeys = DOCUMENT_FIELDS.filter(
        (field) => field.required || (field.key === "venueOwnerConsent" && venueOwnership === "Venue Booking")
      ).map((field) => field.key);

      const allPresent = requiredDocumentKeys.every((key) => Boolean(uploadedDocuments[key]));
      if (!allPresent) {
        setDocumentError("Please upload all required documents to continue.");
        return;
      }
    }

    nextStep();
  };

  const submitWizard = methods.handleSubmit((values) => {
    const generatedId = `UTTSAV-${Math.floor(2000 + Math.random() * 7000)}`;
    const payload = {
      ...values,
      eventSize,
      documents: uploadedDocuments,
      departmentsRequired,
      riskLevel: "MEDIUM RISK",
      id: generatedId,
    };

    setSubmittedApplication(payload);
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
                {submittedApplication.departmentsRequired.map((department) => (
                  <DepartmentBadge key={department} label={department} />
                ))}
              </div>
            </div>
          </article>

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
          {...methods.register("eventName", { required: "Event name is required." })}
        />

        <FormInput
          as="select"
          label="Event Type"
          options={EVENT_TYPE_OPTIONS}
          error={methods.formState.errors.eventType?.message}
          {...methods.register("eventType", { required: "Event type is required." })}
        />

        <div>
          <FormInput
            type="number"
            label="Expected Crowd"
            min={1}
            placeholder="Enter expected attendees"
            error={methods.formState.errors.crowdSize?.message}
            helperText="Used for event-size and department routing."
            {...methods.register("crowdSize", {
              required: "Expected crowd is required.",
              min: { value: 1, message: "Crowd size must be at least 1." },
            })}
          />
          <div className="mt-2">{renderEventSizeBadge()}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput
            type="date"
            label="Start Date"
            error={methods.formState.errors.startDate?.message}
            {...methods.register("startDate", { required: "Start date is required." })}
          />
          <FormInput
            type="date"
            label="End Date"
            error={methods.formState.errors.endDate?.message}
            {...methods.register("endDate", { required: "End date is required." })}
          />
        </div>

        <FormInput
          type="time"
          label="Start Time"
          error={methods.formState.errors.startTime?.message}
          {...methods.register("startTime", { required: "Start time is required." })}
        />

        <FormInput
          type="time"
          label="End Time"
          error={methods.formState.errors.endTime?.message}
          {...methods.register("endTime", { required: "End time is required." })}
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
          {...methods.register("venueName", { required: "Venue name is required." })}
        />

        <FormInput
          as="select"
          label="Venue Type"
          options={VENUE_TYPE_OPTIONS}
          error={methods.formState.errors.venueType?.message}
          {...methods.register("venueType", { required: "Venue type is required." })}
        />

        <FormInput
          label="Address"
          placeholder="Enter complete venue address"
          error={methods.formState.errors.address?.message}
          {...methods.register("address", { required: "Address is required." })}
        />

        <FormInput
          label="City"
          placeholder="Enter city"
          error={methods.formState.errors.city?.message}
          {...methods.register("city", { required: "City is required." })}
        />

        <FormInput
          label="Ward Number"
          placeholder="Enter ward number"
          error={methods.formState.errors.wardNumber?.message}
          {...methods.register("wardNumber", { required: "Ward number is required." })}
        />

        <FormInput
          as="select"
          label="Venue Ownership"
          options={OWNERSHIP_OPTIONS}
          error={methods.formState.errors.venueOwnership?.message}
          {...methods.register("venueOwnership", { required: "Venue ownership is required." })}
        />
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-[#F8FAFC] p-5 text-center">
        <MapPin className="mx-auto text-[#64748B]" size={20} />
        <p className="mt-2 text-sm font-medium text-[#0F172A]">Map Location Selector (Coming Soon)</p>
      </div>

      {venueOwnership === "Venue Booking" ? (
        <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <p className="text-sm font-semibold text-[#92400E]">Additional Document Required: Venue Owner Consent</p>
          <p className="mt-1 text-sm text-[#B45309]">Examples: Hall booking receipt, owner authorization letter</p>
          <div className="mt-4">
            <FileUploadCard
              title="Venue Owner Consent"
              required
              onFileSelected={(name) => setDocument("venueOwnerConsent", name)}
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
            required: "Security personnel count is required.",
            min: { value: 0, message: "Value cannot be negative." },
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
          helperText="Optional upload"
          onFileSelected={(name) => setDocument("crowdManagementPlan", name)}
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

        <FormInput
          type="number"
          label="Parking Capacity"
          min={0}
          error={methods.formState.errors.parkingCapacity?.message}
          {...methods.register("parkingCapacity", {
            required: "Parking capacity is required.",
            min: { value: 0, message: "Value cannot be negative." },
          })}
        />

        <FormInput
          as="select"
          label="Expected Traffic Impact"
          options={TRAFFIC_OPTIONS}
          error={methods.formState.errors.trafficImpact?.message}
          {...methods.register("trafficImpact", { required: "Traffic impact is required." })}
        />

        <ToggleSwitch
          label="Public Announcement System"
          checked={methods.watch("publicAnnouncementSystem")}
          onChange={onToggleChange("publicAnnouncementSystem")}
        />
      </div>
    </>
  );

  const renderStepSix = () => (
    <>
      <StepHeader title="Waste Management" subtitle="Capture sanitation and cleanup commitments." />
      <div className="grid gap-6 md:grid-cols-2">
        <FormInput
          as="textarea"
          rows={4}
          label="Waste Disposal Plan"
          error={methods.formState.errors.wasteDisposalPlan?.message}
          {...methods.register("wasteDisposalPlan", { required: "Waste disposal plan is required." })}
        />

        <FormInput
          label="Cleaning Contractor"
          placeholder="Enter contractor name"
          error={methods.formState.errors.cleaningContractor?.message}
          {...methods.register("cleaningContractor", { required: "Cleaning contractor is required." })}
        />

        <FormInput
          type="number"
          min={0}
          label="Number of Dustbins"
          error={methods.formState.errors.numberOfDustbins?.message}
          {...methods.register("numberOfDustbins", {
            required: "Number of dustbins is required.",
            min: { value: 0, message: "Value cannot be negative." },
          })}
        />
      </div>
    </>
  );

  const renderStepSeven = () => (
    <>
      <StepHeader title="Document Upload" subtitle="Upload required event documents." />
      <div className="grid gap-6 md:grid-cols-2">
        {DOCUMENT_FIELDS.map((field) => (
          <FileUploadCard
            key={field.key}
            title={field.title}
            required={field.required || (field.key === "venueOwnerConsent" && venueOwnership === "Venue Booking")}
            onFileSelected={(name) => setDocument(field.key, name)}
          />
        ))}
      </div>
      {documentError ? <p className="mt-4 text-sm font-medium text-[#DC2626]">{documentError}</p> : null}
    </>
  );

  const renderStepEight = () => {
    const summary = methods.getValues();

    return (
      <>
        <StepHeader title="Review & Submit" subtitle="Verify all details before submitting." />

        <div className="grid gap-6 md:grid-cols-2">
          <ReviewCard
            title="Event Details"
            items={[
              { label: "Event Name", value: summary.eventName },
              { label: "Event Type", value: summary.eventType },
              { label: "Expected Crowd", value: summary.crowdSize },
              { label: "Event Size", value: eventSize },
              { label: "Start", value: `${summary.startDate || "-"} ${summary.startTime || ""}`.trim() },
              { label: "End", value: `${summary.endDate || "-"} ${summary.endTime || ""}`.trim() },
            ]}
          />

          <ReviewCard
            title="Venue Details"
            items={[
              { label: "Venue Name", value: summary.venueName },
              { label: "Venue Type", value: summary.venueType },
              { label: "Address", value: summary.address },
              { label: "City", value: summary.city },
              { label: "Ward Number", value: summary.wardNumber },
              { label: "Venue Ownership", value: summary.venueOwnership },
            ]}
          />

          <ReviewCard
            title="Infrastructure"
            items={[
              { label: "Stage Required", value: summary.stageRequired ? "Yes" : "No" },
              { label: "Sound System", value: summary.soundSystem ? "Yes" : "No" },
              { label: "Temporary Structures", value: summary.temporaryStructures ? "Yes" : "No" },
              { label: "Food Stalls", value: summary.foodStalls ? "Yes" : "No" },
              { label: "Fireworks", value: summary.fireworks ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Safety"
            items={[
              { label: "Security Personnel", value: summary.securityPersonnelCount },
              { label: "Medical Facility", value: summary.medicalFacilityAvailable ? "Yes" : "No" },
              { label: "First Aid Team", value: summary.firstAidTeam ? "Yes" : "No" },
              { label: "Ambulance Required", value: summary.ambulanceRequired ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Traffic"
            items={[
              { label: "Road Closure", value: summary.roadClosureRequired ? "Yes" : "No" },
              { label: "Parking Capacity", value: summary.parkingCapacity },
              { label: "Traffic Impact", value: summary.trafficImpact },
              { label: "PA System", value: summary.publicAnnouncementSystem ? "Yes" : "No" },
            ]}
          />

          <ReviewCard
            title="Waste"
            items={[
              { label: "Waste Plan", value: summary.wasteDisposalPlan },
              { label: "Cleaning Contractor", value: summary.cleaningContractor },
              { label: "Dustbins", value: summary.numberOfDustbins },
            ]}
          />
        </div>

        <div className="mt-6 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#92400E]">Risk Level</p>
              <span className="mt-1 inline-flex rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-3 py-1 text-xs font-semibold text-[#B45309]">
                MEDIUM RISK
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-[#92400E]">Departments Required</p>
              <div className="mt-1 flex flex-wrap justify-end gap-2">
                {departmentsRequired.length > 0 ? (
                  departmentsRequired.map((department) => (
                    <DepartmentBadge key={department} label={department} variant="department" />
                  ))
                ) : (
                  <span className="text-sm text-[#92400E]">No departments matched</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
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

          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-5">
            <button
              type="button"
              onClick={prevStep}
              disabled={isFirstStep}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-[#0F172A] transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            {isLastStep ? (
              <button
                type="submit"
                className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                Submit
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNext}
                className="rounded-lg bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                Next
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h4 className="text-base font-semibold text-[#0F172A]">Smart Routing Preview</h4>
        <p className="mt-1 text-sm text-[#64748B]">Departments update automatically based on your current inputs.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
            <div className="flex items-center gap-2 text-[#1E40AF]">
              <Users size={16} />
              <p className="text-xs font-semibold uppercase">Event Size</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">{eventSize}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
            <div className="flex items-center gap-2 text-[#1E40AF]">
              <ShieldCheck size={16} />
              <p className="text-xs font-semibold uppercase">Departments</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">{departmentsRequired.length}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
            <div className="flex items-center gap-2 text-[#1E40AF]">
              <FileText size={16} />
              <p className="text-xs font-semibold uppercase">Uploaded Files</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">{Object.keys(uploadedDocuments).length}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
            <div className="flex items-center gap-2 text-[#1E40AF]">
              <CheckCircle2 size={16} />
              <p className="text-xs font-semibold uppercase">Current Step</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-[#0F172A]">{steps[currentStep]}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MultiStepForm;
