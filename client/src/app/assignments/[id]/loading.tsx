import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function AssignmentDetailLoading() {
  return (
    <div className={styles.assignmentsContainer}>
      <div className={styles.headerRow}>
        <div className={`${styles.box} ${styles.boxBackLink}`} />
        <div className={`${styles.box} ${styles.boxActionBtn}`} />
      </div>

      <div className={`${styles.skeletonBase} ${styles.detailHero}`}>
        <div className={`${styles.box} ${styles.boxHeroTag}`} />
        <div className={`${styles.box} ${styles.boxHeroTitle}`} />
        <div className={`${styles.box} ${styles.boxHeroBar}`} />
      </div>

      <div className={styles.detailWorkspace}>
        <div className={styles.skeletonBase}>
          <div className={`${styles.box} ${styles.boxSectionTitle}`} />
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.box} ${styles.boxCardFull}`} />
          ))}
        </div>

        <div className={styles.sideColumn}>
          <div className={`${styles.skeletonBase} ${styles.boxSideCard}`} />
          <div className={`${styles.skeletonBase} ${styles.boxSideCard}`} />
        </div>
      </div>
    </div>
  );
}