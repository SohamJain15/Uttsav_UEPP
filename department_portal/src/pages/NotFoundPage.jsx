import { Link } from 'react-router-dom';

const NotFoundPage = () => (
  <div className="rounded-2xl border border-borderMain bg-cardBg p-6 shadow-card">
    <h1 className="text-xl font-semibold text-textMain">Page Not Found</h1>
    <p className="mt-2 text-sm text-textSecondary">The requested route is not available in this portal.</p>
    <Link to="/dashboard" className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white">
      Back to Dashboard
    </Link>
  </div>
);

export default NotFoundPage;
