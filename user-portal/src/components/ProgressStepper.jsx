const ProgressStepper = ({ currentStep = 0, steps = [] }) => {
  const progress = ((currentStep + 1) / Math.max(steps.length, 1)) * 100;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-[#0F172A]">Smart Application Progress</p>
        <p className="text-sm text-[#64748B]">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>

      <div className="h-2 w-full rounded-full bg-[#E2E8F0]">
        <div
          className="h-2 rounded-full bg-[#1E40AF] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 hidden grid-cols-4 gap-2 md:grid lg:grid-cols-8">
        {steps.map((label, index) => {
          const done = index <= currentStep;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? "bg-[#1E40AF] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`text-xs ${done ? "text-[#0F172A]" : "text-[#64748B]"}`}>{label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default ProgressStepper;
