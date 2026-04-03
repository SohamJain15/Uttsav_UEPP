import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { register, handleSubmit } = useForm();

  const onSubmit = async (values) => {
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await authService.login(values);
      localStorage.setItem("uttsav_auth", JSON.stringify(response));
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setErrorMessage("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-lightBg px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <h1 className="text-[26px] font-semibold text-textPrimary">User Login</h1>
        <p className="mt-1 text-sm text-textSecondary">Access your UTTSAV organizer account.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <label className="block text-[13px] font-medium text-textSecondary">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              {...register("email", { required: true })}
            />
          </label>

          <label className="block text-[13px] font-medium text-textSecondary">
            Password
            <input
              type="password"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              {...register("password", { required: true })}
            />
          </label>

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-sm text-textSecondary">
          New organizer?{" "}
          <Link to="/register" className="font-medium text-govBlue hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
