import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function RootLoading() {
  return (
    <div className={styles.landingContainer}>
      <div className={`${styles.box} ${styles.boxHeroBadge}`} />
      <div className={`${styles.box} ${styles.boxLandingTitle}`} />
      <div className={`${styles.box} ${styles.boxLandingSub}`} />
      <div className={`${styles.box} ${styles.boxLandingCta}`} />
    </div>
  );
}