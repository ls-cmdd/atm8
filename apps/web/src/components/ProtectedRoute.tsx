import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { api } from '../lib/api';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp * 1000 > Date.now()) {
            setIsAuthenticated(true);
            return;
          }
        } catch {
          // Token invalid, will request new session below
        }
      }

      // Automatically skip login and establish demo session
      try {
        const res = await api.post('/auth/demo');
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setIsAuthenticated(true);
      } catch (err) {
        console.error('Failed to auto-login demo account:', err);
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Entering Workspace...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}

