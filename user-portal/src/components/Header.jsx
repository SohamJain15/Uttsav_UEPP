import { useEffect, useState } from "react";
import { Bell, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "./ProfileCard";
import { authService } from "../services/authService";

const Header = ({ title, onOpenSidebar }) => {
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const profileForCard = profile ? { ...profile, role: profile.role || "NGO" } : null;

  useEffect(() => {
    const loadProfile = async () => {
      const response = await authService.getProfile();
      setProfile(response || null);
    };

    loadProfile();
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] w-full max-w-content items-center justify-between px-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSidebar}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-textPrimary md:hidden"
            type="button"
            aria-label="Open navigation"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-[26px] font-semibold text-textPrimary">{title}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/notifications")}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-textPrimary"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-govBlue" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-govBlue text-sm font-semibold text-white"
                aria-label="Open profile menu"
              >
              {profileForCard?.avatar || "RK"}
            </button>

            {isProfileOpen ? (
              <div className="absolute right-0 mt-2 w-[320px] space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                <ProfileCard profile={profileForCard} compact />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/profile");
                    }}
                    className="flex-1 rounded-lg bg-govBlue px-3 py-2 text-sm font-medium text-white hover:bg-blue-800"
                  >
                    View Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      navigate("/login");
                    }}
                    className="flex-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-textPrimary hover:bg-slate-200"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
