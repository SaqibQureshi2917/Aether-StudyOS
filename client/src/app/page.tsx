'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from "@/context/ThemeContext";
import { apiRequest } from '@/lib/apiClient';
import styles from '../styles/landing.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';
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

      // Agar Token nahi hai toh Landing Page render hone dein
      if (!token) {
        setIsCheckingSession(false);
        return;
      }

      try {
        // Express Backend Check
        const data: any = await apiRequest('/auth/me', 'GET');
        
        if (data.user) {
          // Valid Token -> Direct Dashboard Redirection
          router.replace('/dashboard');
        } else {
          setIsCheckingSession(false);
        }
      } catch (error) {
        // Expired / Broken Token -> Storage Cleanup
        localStorage.removeItem('studyos_token');
        localStorage.removeItem('studyos_user');
        setIsCheckingSession(false);
      }
    };

    verifyUserSession();
  }, [router]);

  // Session verification ke waqt 0% inline CSS + Pure Skeleton Shimmer
  if (isCheckingSession) {
    return (
      <div className={skeletonStyles.landingContainer}>
        <div className={`${skeletonStyles.box} ${skeletonStyles.boxHeroBadge}`} />
        <div className={`${skeletonStyles.box} ${skeletonStyles.boxLandingTitle}`} />
        <div className={`${skeletonStyles.box} ${skeletonStyles.boxLandingSub}`} />
        <div className={`${skeletonStyles.box} ${skeletonStyles.boxLandingCta}`} />
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