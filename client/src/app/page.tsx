'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from "@/context/ThemeContext";
import { apiRequest } from '@/lib/apiClient';
import styles from '../styles/landing.module.css';
import Navbar from "@/components/layout/Navbar/Navbar";
import Hero from "@/components/layout/Hero/Hero";
import FeaturesPreview from "@/components/layout/FeaturesPreview/FeaturesPreview";
import Footer from "@/components/layout/Footer/Footer";

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    const verifyUserSession = async () => {
      const token = localStorage.getItem('studyos_token');

      // Agar Token nahi hai toh Landing Page dikhne dein
      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        // Express Backend Check (Port 5000)
        const data: any = await apiRequest('/auth/me', 'GET');
        
        if (data.user) {
          // Valid Token -> Directly redirect to Dashboard
          router.replace('/dashboard');
        } else {
          setIsCheckingSession(false);
        }
      } catch (error) {
        // Expired / Broken Token -> Local Storage Clean karein
        localStorage.removeItem('studyos_token');
        localStorage.removeItem('studyos_user');
        setIsCheckingSession(false);
      }
    };

    verifyUserSession();
  }, [router]);

  // Jab tak session check ho raha hai, landing page flash hone se bachayein
  if (isCheckingSession) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#090d16',
        color: '#64748b',
        fontFamily: 'sans-serif'
      }}>
        Checking session...
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <FeaturesPreview />
      </main>
      <Footer />
    </>
  );
}