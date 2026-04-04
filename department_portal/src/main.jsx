import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { PortalUiProvider } from './context/PortalUiContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <PortalUiProvider>
        <App />
      </PortalUiProvider>
    </AuthProvider>
  </React.StrictMode>
);
