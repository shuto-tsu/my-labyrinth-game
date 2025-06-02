import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Tailwind CSSのベーススタイルやカスタムスタイルを適用する場合
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
