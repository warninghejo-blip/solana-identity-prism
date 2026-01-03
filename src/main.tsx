import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import App from './App';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import './index.css';
import '@solana/wallet-adapter-react-ui/styles.css';
import { Buffer } from 'buffer';
import { HELIUS_CONFIG } from './constants';

declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

if (!window.Buffer) {
  window.Buffer = Buffer;
}

if (!globalThis.Buffer) {
  globalThis.Buffer = Buffer;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Index /> },
      { path: '*', element: <NotFound /> },
    ],
  },
], {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  } as any,
});

const wallets = [new PhantomWalletAdapter()];
const endpoint = HELIUS_CONFIG.RPC_URL;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <RouterProvider router={router} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </React.StrictMode>
);
