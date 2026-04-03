import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { PortalUiProvider } from './context/PortalUiContext';
import { initializePortalData } from './data/storage';
import './index.css';

initializePortalData();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PortalUiProvider>
        <App />
      </PortalUiProvider>
    </AuthProvider>
  </React.StrictMode>
);
