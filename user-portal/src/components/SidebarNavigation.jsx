import { X, LayoutDashboard, FilePlus2, FolderKanban, Bell, UserCircle2 } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { label: "Apply for Event", to: "/apply", icon: FilePlus2 },
  { label: "Applications", to: "/applications", icon: FolderKanban },
  { label: "Notifications", to: "/notifications", icon: Bell },
  { label: "Profile", to: "/profile", icon: UserCircle2 },
];

const SidebarNavigation = ({ isOpen, onClose }) => {
  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 transition md:hidden ${isOpen ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[260px] border-r border-slate-200 bg-white transition-transform md:z-20 md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-slate-200 px-5">
          <div>
            <p className="text-sm font-semibold text-govBlue">UTTSAV</p>
            <p className="text-xs text-textSecondary">User Portal</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-textSecondary md:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-govBlue text-white"
                      : "text-textPrimary hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default SidebarNavigation;
