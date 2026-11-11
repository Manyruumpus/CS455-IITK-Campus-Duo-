import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { applicationQueryClient } from '@/queries';
import { AuthProvider } from '@/app/context/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { appConfig } from '@/config/features';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={applicationQueryClient}>
      <ToastProvider>
        <AuthProvider>
          {appConfig.isDemoShowcase && (
            <div
              role="status"
              aria-label="Demo Showcase Identification Banner"
              className="sticky top-0 z-50 bg-amber-500 text-black px-4 py-1 text-xs font-semibold text-center tracking-wide shadow-md flex items-center justify-center gap-2"
            >
              <span className="font-mono uppercase bg-black text-amber-400 px-1.5 py-0.5 rounded text-[10px]">
                Demo Showcase
              </span>
              <span>
                Demonstration Preview Mode — All profiles, authentication, and table reservations are illustrative simulations.
              </span>
            </div>
          )}
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
