import { useAuth } from '../context/AuthContext';
import { usePortalUi } from '../context/PortalUiContext';
import { useNavigate } from 'react-router-dom';

const getInitials = (name = '') => {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
};

const IconButton = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-xl border border-borderMain bg-cardBg px-3 py-2 text-textSecondary transition hover:text-primary"
  >
    {children}
  </button>
);

const Navbar = () => {
  const { user } = useAuth();
  const { searchQuery, setSearchQuery, toggleNotifications } = usePortalUi();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-borderMain bg-pageBg/95 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">U</div>
          <div>
            <p className="text-sm font-semibold text-textMain">UTTSAV</p>
            <p className="text-xs text-textSecondary">Unified Event Permission Portal</p>
          </div>
        </div>

        <div className="hidden max-w-xl flex-1 items-center md:flex">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by ID, Event, Venue or Organizer"
            className="w-full rounded-xl border border-borderMain bg-cardBg px-4 py-2 text-sm text-textMain outline-none ring-primary/30 focus:ring"
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary lg:inline-flex">
            {user?.departmentLabel}
          </span>
          <IconButton onClick={toggleNotifications}>Notifications</IconButton>
          <IconButton onClick={() => navigate('/profile')}>Profile</IconButton>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
            aria-label="Open profile"
          >
            {getInitials(user?.fullName || user?.username || user?.email || 'User')}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
