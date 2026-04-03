import { forwardRef } from "react";

const sharedClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-[#0F172A] outline-none transition focus:border-[#1E40AF] focus:ring-2 focus:ring-[#1E40AF]/10";

const FormInput = forwardRef(
  ({ label, helperText, error, type = "text", as = "input", options = [], className = "", ...props }, ref) => {
    return (
      <label className="block">
        <span className="text-sm font-medium text-[#0F172A]">{label}</span>
        {as === "select" ? (
          <select ref={ref} className={`${sharedClass} ${className}`} {...props}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : as === "textarea" ? (
          <textarea ref={ref} className={`${sharedClass} ${className}`} {...props} />
        ) : (
          <input ref={ref} type={type} className={`${sharedClass} ${className}`} {...props} />
        )}
        {error ? <p className="mt-1 text-xs text-[#DC2626]">{error}</p> : null}
        {!error && helperText ? <p className="mt-1 text-xs text-[#64748B]">{helperText}</p> : null}
      </label>
    );
  }
);

FormInput.displayName = "FormInput";

export default FormInput;
