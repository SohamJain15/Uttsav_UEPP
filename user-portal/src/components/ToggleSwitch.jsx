const ToggleSwitch = ({ label, checked = false, onChange, helperText }) => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#0F172A]">{label}</p>
          {helperText ? <p className="text-xs text-[#64748B]">{helperText}</p> : null}
        </div>

        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
            checked ? "bg-[#1E40AF]" : "bg-[#CBD5E1]"
          }`}
        >
          <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
      </label>
    </div>
  );
};

export default ToggleSwitch;
