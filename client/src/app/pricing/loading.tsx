import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function PricingLoading() {
  return (
    <div className={styles.pricingContainer}>
      <div className={styles.pricingHeader}>
        <div className={`${styles.box} ${styles.boxPricingTitle}`} />
        <div className={`${styles.box} ${styles.boxPricingSub}`} />
      </div>

      <div className={styles.pricingGrid}>
        <div className={`${styles.skeletonBase} ${styles.pricingCardSkeleton}`}>
          <div className={`${styles.box} ${styles.boxHeroTag}`} />
          <div className={`${styles.box} ${styles.boxHeroTitle}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
          <div className={`${styles.box} ${styles.boxBtn}`} />
        </div>

        <div className={`${styles.skeletonBase} ${styles.pricingCardSkeleton}`}>
          <div className={`${styles.box} ${styles.boxHeroTag}`} />
          <div className={`${styles.box} ${styles.boxHeroTitle}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
          <div className={`${styles.box} ${styles.boxCardFull}`} />
          <div className={`${styles.box} ${styles.boxBtn}`} />
        </div>
      </div>
    </div>
  );
}