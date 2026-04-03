import { createContext, useContext, useMemo, useState } from 'react';

const PortalUiContext = createContext(null);

export const PortalUiProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const value = useMemo(
    () => ({
      searchQuery,
      setSearchQuery,
      isNotificationsOpen,
      openNotifications: () => setIsNotificationsOpen(true),
      closeNotifications: () => setIsNotificationsOpen(false),
      toggleNotifications: () => setIsNotificationsOpen((prev) => !prev)
    }),
    [isNotificationsOpen, searchQuery]
  );

  return <PortalUiContext.Provider value={value}>{children}</PortalUiContext.Provider>;
};

export const usePortalUi = () => {
  const context = useContext(PortalUiContext);

  if (!context) {
    throw new Error('usePortalUi must be used inside PortalUiProvider.');
  }

  return context;
};
