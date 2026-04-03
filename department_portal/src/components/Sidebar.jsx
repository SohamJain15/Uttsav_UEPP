import { NavLink } from 'react-router-dom';

const sidebarItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Pending', to: '/pending' },
  { label: 'In Review', to: '/in-review' },
  { label: 'Approved', to: '/approved' },
  { label: 'Rejected', to: '/rejected' },
  { label: 'Queries', to: '/queries' },
  { label: 'Profile', to: '/profile' }
];

const Sidebar = () => (
  <aside className="w-64 shrink-0 border-r border-borderMain bg-cardBg p-4">
    <nav className="space-y-1">
      {sidebarItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `block rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              isActive ? 'bg-primary text-white shadow-card' : 'text-textSecondary hover:bg-slate-100 hover:text-textMain'
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);

export default Sidebar;
