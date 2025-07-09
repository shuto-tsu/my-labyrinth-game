// アプリケーションのエントリーポイント
// ReactアプリケーションをDOM上の指定要素にマウントする

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Tailwind CSSのベーススタイルやカスタムスタイルを適用する場合
import App from './App';

// HTMLのroot要素を取得してReactのルートを作成
const root = ReactDOM.createRoot(document.getElementById('root'));

// アプリケーションをレンダリング
// React.StrictModeで開発時のバグ検出を強化
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
