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
        <div className="mx-auto flex items-center justify-center gap-3">
          <img src="/ashoka-emblem.svg" alt="Ashoka Emblem" className="h-12 w-auto object-contain" />
          <img src="/uttsav-logo.svg" alt="UTTSAV logo" className="h-16 w-auto object-contain" />
        </div>
        <p className="mt-2 text-sm text-textSecondary">Smart Event Permission System</p>
      </div>
    </div>
  );
};

export default SplashPage;
