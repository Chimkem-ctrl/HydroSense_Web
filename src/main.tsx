import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/variables.css';
import './styles/background.css';
import './styles/components.css';
import './styles/auth.css';
import './styles/dashboard.css';
import './styles/profile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
