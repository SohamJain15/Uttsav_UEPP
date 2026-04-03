import { useEffect, useState } from "react";
import { authService } from "../services/authService";

const ProfilePage = () => {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      const response = await authService.getProfile();
      setProfile(response);
    };

    loadProfile();
  }, []);

  if (!profile) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
        <p className="text-sm text-textSecondary">Loading profile...</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-[22px] font-semibold text-textPrimary">Profile</h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[13px] font-medium text-textSecondary">Name</p>
          <p className="text-base text-textPrimary">{profile.name}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-textSecondary">Email</p>
          <p className="text-base text-textPrimary">{profile.email}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-textSecondary">Phone</p>
          <p className="text-base text-textPrimary">{profile.phone}</p>
        </div>
        <div>
          <p className="text-[13px] font-medium text-textSecondary">Organization</p>
          <p className="text-base text-textPrimary">{profile.organization}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" className="rounded-lg bg-govBlue px-4 py-2 text-sm font-medium text-white">
          Edit Profile
        </button>
        <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-textPrimary">
          Change Password
        </button>
        <button type="button" className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white">
          Logout
        </button>
      </div>
    </section>
  );
};

export default ProfilePage;
