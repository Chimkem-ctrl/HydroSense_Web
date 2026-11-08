import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/auth-variables.css';
import './styles/background.css';
import './styles/auth.css';
import './styles/components.css';
import './design-system/tokens.css';
import './design-system/glass.css';
import './styles/glass-screens.css';
import './styles/glass-shell.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
