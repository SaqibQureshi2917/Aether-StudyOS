"use client"
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import OnboardingWizard from "@/components/features/Onboarding/OnboardingWizard";
import styles from './onboardingPage.module.css'
export default function OnboardingPage(){
    const router = useRouter();
    const { authStatus, user, authError, refreshUser } = useAuth();

    useEffect(() => {
        if (authStatus === 'unauthenticated') router.replace('/');
        else if (authStatus === 'authenticated' && user?.isOnboarded) router.replace('/dashboard');
    }, [authStatus, router, user]);

    if (authStatus !== 'authenticated' || user?.isOnboarded) {
        if (authStatus === 'error') {
            return <div role="alert">{authError} <button type="button" onClick={() => void refreshUser()}>Retry</button></div>;
        }
        return <div role="status" aria-live="polite">Checking your account...</div>;
    }

    return(
        <div className={styles.onboardingLayout}>
            <header className={styles.minimalHeader}>
                <h2 className={styles.brandLogo}>
Aether <span className={styles.betaBedge}>StudyOS</span>
                </h2>
                
            </header>
        <main className={styles.mainContent}>
            <OnboardingWizard/>
        </main>
        </div>
    )
}
