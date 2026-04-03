import MultiStepForm from "../components/MultiStepForm";

const SmartApplicationPage = () => {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-[22px] font-semibold text-[#0F172A]">Smart Event Application Form</h2>
        <p className="mt-2 text-[15px] text-[#64748B]">
          Complete all steps to prepare your event request. Departments are assigned automatically based
          on event details.
        </p>
      </section>

      <MultiStepForm />
    </div>
  );
};

export default SmartApplicationPage;
