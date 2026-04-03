import { Bell, Menu } from "lucide-react";
import { Link } from "react-router-dom";

const Header = ({ title, onOpenSidebar }) => {
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
          <Link
            to="/notifications"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-textPrimary"
            aria-label="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-govBlue" />
          </Link>
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-govBlue text-sm font-semibold text-white">
            AS
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
