import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { applicationQueryClient } from '@/queries';
import { AuthProvider } from '@/app/context/AuthProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={applicationQueryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
