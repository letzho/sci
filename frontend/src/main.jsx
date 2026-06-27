import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { GamificationBonusProvider } from './context/GamificationBonusContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GamificationBonusProvider>
          <App />
        </GamificationBonusProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
