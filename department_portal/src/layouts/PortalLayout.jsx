import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import NotificationsDrawer from '../components/NotificationsDrawer';
import Sidebar from '../components/Sidebar';

const PortalLayout = () => (
  <div className="min-h-screen bg-pageBg text-textMain">
    <Navbar />
    <div className="flex min-h-[calc(100vh-4rem)]">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
    <NotificationsDrawer />
  </div>
);

export default PortalLayout;
