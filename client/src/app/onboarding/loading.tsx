import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function OnboardingLoading() {
  return (
    <div className={styles.onboardingContainer}>
      <div className={`${styles.skeletonBase} ${styles.onboardingCardSkeleton}`}>
        <div className={`${styles.box} ${styles.boxBackLink}`} />
        <div className={`${styles.box} ${styles.boxHeroTitle}`} />
        <div className={`${styles.box} ${styles.boxCardFull}`} />
        <div className={`${styles.box} ${styles.boxCardFull}`} />
        <div className={`${styles.box} ${styles.boxBtn}`} />
      </div>
    </div>
  );
}