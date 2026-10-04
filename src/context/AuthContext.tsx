import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'veterinarian' | 'student';
  subscription_status: 'active' | 'inactive' | 'trial' | 'cancelled' | 'pending_payment';
  subscription_expires_at: string | null;
  trial_days: number;
  is_blocked: boolean;
  created_at: string;
  last_login_at: string | null;
  email_verified?: boolean;
  phone?: string;
  cpf?: string;
  is_lifetime?: boolean;
  asaas_invoice_url?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isPendingPayment: boolean;
  isLifetime: boolean;
  isLoading: boolean;
  concurrentDisconnected: boolean;
  subscriptionError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  dismissConcurrentNotice: () => void;
  refreshUser: () => Promise<void>;
  setAuthSession: (user: AuthUser, token: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'sp_vet_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(true);
  const [concurrentDisconnected, setConcurrentDisconnected] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {}
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  // Heartbeat function to validate single active session
  const checkHeartbeat = useCallback(async (activeToken: string) => {
    try {
      const res = await fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'CONCURRENT_LOGIN_DETECTED') {
          // Bloqueio de conexão concorrente disparado!
          setConcurrentDisconnected(true);
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
          return;
        }
        // Sessão inválida
        logout();
        return;
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        setSubscriptionError(data.message || 'Assinatura inativa ou expirada.');
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        return;
      }

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setSubscriptionError(null);
      }
    } catch (err) {
      // Falha de rede temporária: não derruba imediatamente
    }
  }, [logout]);

  // Initial load
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      if (savedToken) {
        setToken(savedToken);
        await checkHeartbeat(savedToken);
      }
      setIsLoading(false);
    };
    initAuth();
  }, [checkHeartbeat]);

  // Periodic heartbeat every 20 seconds to enforce single session
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      checkHeartbeat(token);
    }, 20000);

    return () => clearInterval(interval);
  }, [token, checkHeartbeat]);

  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    setSubscriptionError(null);
    setConcurrentDisconnected(false);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Erro ao realizar login.');
      }

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setUser(data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    if (token) await checkHeartbeat(token);
  };

  const setAuthSession = useCallback((newUser: AuthUser, newToken: string) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    setSubscriptionError(null);
  }, []);

  const dismissConcurrentNotice = () => {
    setConcurrentDisconnected(false);
  };

  const isPendingPayment =
    !!user &&
    user.role !== 'admin' &&
    (user.subscription_status === 'pending_payment' ||
      user.subscription_status === 'inactive' ||
      !user.email_verified);

  const isLifetime =
    !!user &&
    (user.is_lifetime === true ||
      (user.subscription_status === 'active' && !user.subscription_expires_at));

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isPendingPayment,
        isLifetime,
        isLoading,
        concurrentDisconnected,
        subscriptionError,
        login,
        logout,
        dismissConcurrentNotice,
        refreshUser,
        setAuthSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
