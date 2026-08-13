"use client"
import OnboardingWizard from "@/components/features/Onboarding/OnboardingWizard";
import styles from './onboardingPage.module.css'
export default function OnboardingPage(){
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