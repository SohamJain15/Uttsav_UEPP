import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "../components/Header";
import SidebarNavigation from "../components/SidebarNavigation";

const titleByPath = {
  "/dashboard": "Dashboard",
  "/apply": "Apply for Event",
  "/apply/preview": "Approval Preview",
  "/apply/confirmation": "Application Confirmation",
  "/documents": "Document Upload",
  "/applications": "Applications",
  "/notifications": "Notifications",
  "/profile": "Profile",
};

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const pageTitle = useMemo(() => {
    if (titleByPath[location.pathname]) {
      return titleByPath[location.pathname];
    }

    if (location.pathname.startsWith("/applications/")) {
      return "Application Tracking";
    }

    return "UTTSAV User Portal";
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-lightBg text-textPrimary">
      <SidebarNavigation isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="md:pl-[260px]">
        <Header title={pageTitle} onOpenSidebar={() => setIsSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-content p-4 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
