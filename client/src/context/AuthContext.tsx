'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, clearApiResponseCache } from '@/lib/apiClient';

type AuthMode = 'login' | 'signup';
type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  major?: string | null;
  currentSemester?: string | null;
  planType?: 'FREE' | 'PRO';
  dailyGoalHours?: number;
  dailySessionMinutes?: number;
  aiMode?: string;
  isOnboarded: boolean;
}

interface AuthContextType {
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  prefilledEmail: string;
  openAuthModal: (mode?: AuthMode, email?: string) => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
  user: AuthUser | null;
  authStatus: AuthStatus;
  authError: string;
  setAuthenticatedUser: (user: AuthUser) => void;
  clearAuthentication: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [prefilledEmail, setPrefilledEmail] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [authError, setAuthError] = useState('');

  const clearAuthentication = useCallback(() => {
    clearApiResponseCache();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('studyos_token');
      localStorage.removeItem('token');
      localStorage.removeItem('studyos_user');
      sessionStorage.removeItem('studyos_token');
    }
    setUser(null);
    setAuthStatus('unauthenticated');
    setAuthError('');
  }, []);

  const setAuthenticatedUser = useCallback((authenticatedUser: AuthUser) => {
    setUser(authenticatedUser);
    setAuthStatus('authenticated');
    setAuthError('');
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response: any = await apiRequest('/auth/me', 'GET');
      const authenticatedUser = response.data?.user as AuthUser | undefined;
      if (!authenticatedUser) throw new Error('Authenticated user could not be loaded.');
      setAuthenticatedUser(authenticatedUser);
      return authenticatedUser;
    } catch (error: any) {
      if (error?.status === 401 || error?.status === 404) {
        clearAuthentication();
      } else {
        setAuthStatus('error');
        setAuthError('Could not verify your session. Check your connection and try again.');
      }
      return null;
    }
  }, [clearAuthentication, setAuthenticatedUser]);

  useEffect(() => {
    localStorage.removeItem('studyos_token');
    localStorage.removeItem('token');
    localStorage.removeItem('studyos_user');
    sessionStorage.removeItem('studyos_token');
    void refreshUser();

    const handleUnauthorized = () => clearAuthentication();
    window.addEventListener('studyos:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('studyos:unauthorized', handleUnauthorized);
    };
  }, [clearAuthentication, refreshUser]);

  const openAuthModal = (mode: AuthMode = 'login', email: string = '') => {
    setAuthMode(mode);
    setPrefilledEmail(email);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider value={{
      isAuthModalOpen,
      authMode,
      prefilledEmail,
      openAuthModal,
      closeAuthModal,
      setAuthMode,
      user,
      authStatus,
      authError,
      setAuthenticatedUser,
      clearAuthentication,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const useAuthModal = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthModal must be used within an AuthProvider');
  return context;
};
