import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function MethodologyLoading() {
  return (
    <div className={styles.methodologyContainer}>
      <div className={styles.methodologyHeader}>
        <div className={`${styles.box} ${styles.boxMethodTitle}`} />
        <div className={`${styles.box} ${styles.boxMethodSub}`} />
      </div>

      <div className={styles.methodologyGrid}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${styles.skeletonBase} ${styles.methodologyCardSkeleton}`}>
            <div className={`${styles.box} ${styles.boxCardTag}`} />
            <div className={`${styles.box} ${styles.boxCardTitle}`} />
            <div className={`${styles.box} ${styles.boxCardFull}`} />
            <div className={`${styles.box} ${styles.boxCardFull}`} />
          </div>
        ))}
      </div>
    </div>
  );
}