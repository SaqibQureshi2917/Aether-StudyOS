'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from '../styles/landing.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';
import Navbar from "@/components/layout/Navbar/Navbar";
import Hero from "@/components/layout/Hero/Hero";
import FeaturesPreview from "@/components/layout/FeaturesPreview/FeaturesPreview";
import Footer from "@/components/layout/Footer/Footer";

export default function LandingPage() {
  const router = useRouter();
  const { authStatus, user } = useAuth();

  useEffect(() => {
    if (authStatus === 'authenticated' && user) {
      router.replace(user.isOnboarded ? '/dashboard' : '/onboarding');
    }
  }, [authStatus, router, user]);

  // Session verification ke waqt 0% inline CSS + Pure Skeleton Shimmer
  if (authStatus === 'loading' || authStatus === 'authenticated') {
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
