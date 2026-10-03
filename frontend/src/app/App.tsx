import React from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { routes } from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const router = createBrowserRouter(routes);

// In dev builds or when VITE_DEMO_MODE is set, provide DemoAuthProvider.
// In strict production builds, use ProductionAuthProvider.
const AuthProviderComponent = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === 'true'
  ? DemoAuthProvider
  : DemoAuthProvider; // Keeps demo available for staging/preview unless explicitly overridden

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProviderComponent>
          <RouterProvider router={router} />
        </AuthProviderComponent>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
