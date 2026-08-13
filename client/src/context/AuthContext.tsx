'use client';

import React, { createContext, useContext, useState } from 'react';

type AuthMode = 'login' | 'signup';

interface AuthContextType {
  isAuthModalOpen: boolean;
  authMode: AuthMode;
  prefilledEmail: string;
  openAuthModal: (mode?: AuthMode, email?: string) => void;
  closeAuthModal: () => void;
  setAuthMode: (mode: AuthMode) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [prefilledEmail, setPrefilledEmail] = useState('');

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
      setAuthMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthModal = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthModal must be used within an AuthProvider');
  return context;
};