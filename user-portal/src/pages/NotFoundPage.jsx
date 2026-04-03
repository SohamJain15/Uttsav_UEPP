import { Link } from "react-router-dom";

const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-lightBg px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <h1 className="text-[26px] font-semibold text-textPrimary">Page Not Found</h1>
        <p className="mt-2 text-sm text-textSecondary">The page you requested does not exist.</p>
        <Link to="/dashboard" className="mt-4 inline-block text-sm font-medium text-govBlue hover:underline">
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
