import React from 'react';
import styles from './planner.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

export default function PlannerLoading() {
  return (
    <div className={`${skeletonStyles.plannerContainer} ${styles.plannerContainer}`}>
      <div className={styles.plannerHeader}>
        <div>
          <div className={`${skeletonStyles.box} ${skeletonStyles.boxPlannerTitle}`} />
          <div className={`${skeletonStyles.box} ${skeletonStyles.plannerSubtitleSkeleton}`} />
        </div>
        <div className={`${skeletonStyles.box} ${skeletonStyles.plannerActionSkeleton}`} />
      </div>

      <div className={styles.plannerGrid}>
        <div className={styles.timelineSection}>
          <div className={`${skeletonStyles.box} ${skeletonStyles.plannerSectionSkeleton}`} />
          <div className={styles.skeletonWrapper}>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
            <div className={`${skeletonStyles.box} ${skeletonStyles.boxDaySlot}`}></div>
          </div>
        </div>

        <div className={styles.sidebarSection}>
          <div className={`${skeletonStyles.box} ${skeletonStyles.plannerSectionSkeleton}`} />
          <div className={`${skeletonStyles.box} ${skeletonStyles.plannerPanelSkeleton}`} />
        </div>
      </div>
    </div>
  );
}
