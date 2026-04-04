import { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "./ProfileCard";
import { useAuth } from "../context/AuthContext";

const getInitials = (name = "") => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const Header = ({ title, onOpenSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileForCard = user
    ? {
        name: user.name || user.full_name || user.email,
        role: user.role || user.department || "Organizer",
        email: user.email,
        phone: user.phone || user.phone_number,
      }
    : null;

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
              {getInitials(profileForCard?.name || user?.email || "User")}
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
                      logout();
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
