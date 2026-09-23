import React from 'react';
import styles from './planner.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

export default function PlannerLoading() {
  return (
    <div className={`${skeletonStyles.plannerContainer} ${styles.plannerContainer}`}>
      <div className={styles.plannerHeader}>
        <div>
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTitle}`} style={{ width: '250px', height: '32px', marginBottom: '8px' }} />
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTag}`} style={{ width: '350px', height: '16px' }} />
        </div>
        <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTag}`} style={{ width: '150px', height: '40px', borderRadius: '8px' }} />
      </div>

      <div className={styles.plannerGrid}>
        <div className={styles.timelineSection}>
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTitle}`} style={{ width: '180px', height: '20px', marginBottom: '1.25rem' }} />
          <div className={styles.skeletonWrapper}>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardTitle}`} style={{ width: '140px', height: '20px', marginBottom: '1.25rem' }} />
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxCardFull}`} style={{ height: '120px' }} />
        </div>
      </div>
    </div>
  );
}