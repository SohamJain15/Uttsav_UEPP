import { Mail, Phone } from "lucide-react";

const getInitials = (name = "") => {
  const parts = name
    .trim()
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const ProfileCard = ({ profile, compact = false, className = "" }) => {
  const safeProfile = {
    name: profile?.name || profile?.full_name || profile?.email?.split("@")?.[0] || "User",
    role: profile?.role || profile?.organization || profile?.department || "Organizer",
    email: profile?.email || "-",
    phone: profile?.phone || profile?.phone_number || "-",
  };

  return (
    <article className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold"
        >
          {getInitials(safeProfile.name)}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-[#0F172A]">{safeProfile.name}</h3>
          <p className="text-sm text-gray-500">{safeProfile.role}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-center gap-3 rounded-lg bg-gray-100 p-3">
          <Mail size={16} className="text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-500">Email</p>
            <p className="text-sm text-[#0F172A]">{safeProfile.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg bg-gray-100 p-3">
          <Phone size={16} className="text-gray-500" />
          <div>
            <p className="text-xs font-medium text-gray-500">Phone</p>
            <p className="text-sm text-[#0F172A]">{safeProfile.phone}</p>
          </div>
        </div>
      </div>
    </article>
  );
};

export default ProfileCard;
