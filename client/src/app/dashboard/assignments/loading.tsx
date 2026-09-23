import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function AssignmentsLoading() {
  return (
    <div className={styles.assignmentsContainer}>
      <div className={styles.headerRow}>
        <div>
          <div className={`${styles.box} ${styles.boxHeaderTitle}`} />
          <div className={`${styles.box} ${styles.boxHeaderSub}`} />
        </div>
        <div className={`${styles.box} ${styles.boxHeaderBtn}`} />
      </div>

      <div className={styles.filterRow}>
        {[1, 2, 3].map((i) => (
          <div key={i} className={`${styles.box} ${styles.boxTab}`} />
        ))}
      </div>

      <div className={styles.cardsGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`${styles.skeletonBase} ${styles.assignmentCard}`}>
            <div className={`${styles.box} ${styles.boxCardTag}`} />
            <div className={`${styles.box} ${styles.boxCardTitle}`} />
            <div className={`${styles.box} ${styles.boxCardProgress}`} />
          </div>
        ))}
      </div>
    </div>
  );
}