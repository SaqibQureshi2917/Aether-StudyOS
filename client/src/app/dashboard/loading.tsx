import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function DashboardLoading() {
  return (
    <div className={styles.dashboardContainer}>
      <div className={`${styles.skeletonBase} ${styles.topBanner}`} />

      <div className={styles.metricsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`${styles.skeletonBase} ${styles.metricCard}`}>
            <div className={`${styles.box} ${styles.boxSubHeader}`} />
            <div className={`${styles.box} ${styles.boxTitle}`} />
          </div>
        ))}
      </div>

      <div className={styles.splitWorkspace}>
        <div className={`${styles.skeletonBase} ${styles.planBox}`}>
          <div className={`${styles.box} ${styles.boxSectionTitle}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
        </div>

        <div className={`${styles.skeletonBase} ${styles.recomBox}`}>
          <div className={`${styles.box} ${styles.boxSectionTitle}`} />
          <div className={`${styles.box} ${styles.boxLargeCard}`} />
          <div className={`${styles.box} ${styles.boxBtn}`} />
        </div>
      </div>
    </div>
  );
}