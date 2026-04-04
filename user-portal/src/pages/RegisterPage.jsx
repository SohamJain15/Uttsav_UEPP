import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

const RegisterPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { register, handleSubmit } = useForm();

  const onSubmit = async (values) => {
    setLoading(true);
    setErrorMessage("");
    try {
      await authService.register(values);
      navigate("/login", { replace: true });
    } catch (error) {
      setErrorMessage(error?.response?.data?.detail || "Registration failed. Please verify details and retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-lightBg px-4">
      <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-[26px] font-semibold text-textPrimary">Organizer Registration</h1>
        <p className="mt-1 text-sm text-textSecondary">Create your UTTSAV user portal account.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-[13px] font-medium text-textSecondary">
            Full Name
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register("name", { required: true })} />
          </label>

          <label className="text-[13px] font-medium text-textSecondary">
            Organization
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register("organization", { required: true })} />
          </label>

          <label className="text-[13px] font-medium text-textSecondary">
            Email
            <input type="email" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register("email", { required: true })} />
          </label>

          <label className="text-[13px] font-medium text-textSecondary">
            Phone
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" {...register("phone", { required: true })} />
          </label>

          <label className="text-[13px] font-medium text-textSecondary">
            Department
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Organizer"
              {...register("department")}
            />
          </label>

          <label className="text-[13px] font-medium text-textSecondary md:col-span-2">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              {...register("password", { required: true })}
            />
          </label>

          {errorMessage ? (
            <p className="text-sm text-danger md:col-span-2">{errorMessage}</p>
          ) : null}

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Register"}
            </button>
          </div>
        </form>

        <p className="mt-4 text-sm text-textSecondary">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-govBlue hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
