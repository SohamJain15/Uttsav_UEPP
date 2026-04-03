import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import SplashPage from "./pages/SplashPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import SmartApplicationPage from "./pages/SmartApplicationPage";
import ApprovalPreviewPage from "./pages/ApprovalPreviewPage";
import ApplicationConfirmationPage from "./pages/ApplicationConfirmationPage";
import ApplicationsListPage from "./pages/ApplicationsListPage";
import ApplicationTracking from "./pages/ApplicationTrackingPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import DocumentUploadPage from "./pages/DocumentUploadPage";
import NotFoundPage from "./pages/NotFoundPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/apply" element={<SmartApplicationPage />} />
        <Route path="/apply/preview" element={<ApprovalPreviewPage />} />
        <Route path="/apply/confirmation" element={<ApplicationConfirmationPage />} />
        <Route path="/documents" element={<DocumentUploadPage />} />
        <Route path="/applications" element={<ApplicationsListPage />} />
        <Route path="applications/:id" element={<ApplicationTracking />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      <Route path="/home" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
