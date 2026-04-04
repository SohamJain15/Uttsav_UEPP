import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfileCard from "../components/ProfileCard";
import { useAuth } from "../context/AuthContext";

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, refreshProfile, logout } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      const response = await refreshProfile();
      setProfile(
        response || {
          name: user?.name || user?.full_name || user?.email,
          role: user?.role || user?.department || "Organizer",
          email: user?.email,
          phone: user?.phone || user?.phone_number,
        }
      );
    };

    loadProfile();
  }, [refreshProfile, user]);

  if (!profile) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-textSecondary">Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <ProfileCard profile={{ ...profile, role: profile.role || "NGO" }} />

      <div className="flex flex-wrap gap-3">
        <button type="button" className="rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
          Edit Profile
        </button>
        <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-textPrimary hover:bg-slate-200">
          Change Password
        </button>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
          className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Logout
        </button>
      </div>
    </section>
  );
};

export default ProfilePage;
