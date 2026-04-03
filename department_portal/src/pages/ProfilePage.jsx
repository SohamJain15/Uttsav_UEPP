import { useAuth } from '../context/AuthContext';
import { useDepartmentData } from '../hooks/useDepartmentData';

const ProfilePage = () => {
  const { user, logout } = useAuth();
  const { jurisdiction } = useDepartmentData(user?.role);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div className="rounded-2xl border border-borderMain bg-cardBg p-6 shadow-card">
        <p className="text-sm text-textSecondary">Username</p>
        <p className="text-lg font-semibold text-textMain">{user?.username}</p>

        <p className="mt-4 text-sm text-textSecondary">Department</p>
        <p className="text-lg font-semibold text-textMain">{user?.departmentLabel}</p>

        <p className="mt-4 text-sm text-textSecondary">Jurisdiction Pincodes</p>
        <p className="text-sm text-textMain">{jurisdiction.join(', ')}</p>

        <button
          onClick={logout}
          className="mt-6 rounded-xl border border-statusRed px-4 py-2 text-sm font-semibold text-statusRed transition hover:bg-statusRed hover:text-white"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
