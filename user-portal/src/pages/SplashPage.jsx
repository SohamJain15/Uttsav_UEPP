import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const SplashPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1200);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-lightBg px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <h1 className="text-[26px] font-semibold text-govBlue">UTTSAV</h1>
        <p className="mt-2 text-sm text-textSecondary">Smart Event Permission System</p>
      </div>
    </div>
  );
};

export default SplashPage;
