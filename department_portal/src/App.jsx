import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import PortalLayout from './layouts/PortalLayout';
import ApplicationDetailPage from './pages/ApplicationDetailPage';
import ApprovedPage from './pages/ApprovedPage';
import DashboardPage from './pages/DashboardPage';
import InReviewPage from './pages/InReviewPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PendingPage from './pages/PendingPage';
import ProfilePage from './pages/ProfilePage';
import QueriesPage from './pages/QueriesPage';
import RejectedPage from './pages/RejectedPage';

const ProtectedRoutes = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <PortalLayout />;
};

const PublicLogin = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginPage />;
};

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/login" element={<PublicLogin />} />

      <Route element={<ProtectedRoutes />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/pending" element={<PendingPage />} />
        <Route path="/in-review" element={<InReviewPage />} />
        <Route path="/approved" element={<ApprovedPage />} />
        <Route path="/rejected" element={<RejectedPage />} />
        <Route path="/queries" element={<QueriesPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/application/:id" element={<ApplicationDetailPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </BrowserRouter>
);

export default App;
