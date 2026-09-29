'use client';

import styles from '@/styles/skeletons.module.css';

type PageSkeletonProps = { kind?: 'collection' | 'subject' | 'settings' | 'form' | 'legal' };

export default function PageSkeleton({ kind = 'collection' }: PageSkeletonProps) {
  return (
    <div className={styles.routeSkeletonPage} role="status" aria-label="Loading page">
      <span className={styles.srOnly}>Loading page</span>
      <div className={`${styles.skeletonBase} ${styles.routeSkeletonHeader}`}>
        <div><div className={`${styles.box} ${styles.boxSectionTitle}`} /><div className={`${styles.box} ${styles.routeSkeletonSubtitle}`} /></div>
        {kind !== 'legal' && <div className={`${styles.box} ${styles.boxHeaderBtn}`} />}
      </div>
      {kind === 'subject' && <div className={styles.routeSkeletonMetrics}>{[1, 2, 3].map((item) => <div key={item} className={`${styles.skeletonBase} ${styles.routeSkeletonMetric}`}><div className={`${styles.box} ${styles.boxTitle}`} /><div className={`${styles.box} ${styles.boxSubHeader}`} /></div>)}</div>}
      {kind === 'legal' ? <div className={`${styles.skeletonBase} ${styles.routeSkeletonLegal}`}>{[1, 2, 3, 4, 5, 6, 7].map((item) => <div key={item} className={`${styles.box} ${styles.routeSkeletonLegalLine}`} />)}</div> : null}
      {kind === 'form' ? <div className={`${styles.skeletonBase} ${styles.routeSkeletonForm}`}>{[1, 2, 3].map((item) => <div key={item} className={`${styles.box} ${styles.boxLargeCard}`} />)}</div> : null}
      {kind !== 'legal' && kind !== 'form' && <div className={styles.routeSkeletonGrid}>{Array.from({ length: kind === 'subject' ? 4 : 6 }, (_, index) => <div key={index} className={`${styles.skeletonBase} ${styles.routeSkeletonCard}`}><div className={`${styles.box} ${styles.boxSectionTitle}`} /><div className={`${styles.box} ${styles.boxCardFull}`} /><div className={`${styles.box} ${styles.boxCardFull}`} /></div>)}</div>}
    </div>
  );
}
