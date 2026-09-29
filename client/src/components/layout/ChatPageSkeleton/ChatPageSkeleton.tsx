'use client';

import styles from '@/styles/skeletons.module.css';

export default function ChatPageSkeleton() {
  return (
    <div className={styles.chatLayout} role="status" aria-label="Loading chat">
      <span className={styles.srOnly}>Loading chat</span>
      <div className={`${styles.skeletonBase} ${styles.chatHeader}`} />
      <div className={`${styles.skeletonBase} ${styles.chatStream}`}>
        <div className={`${styles.box} ${styles.aiBubble}`} />
        <div className={`${styles.box} ${styles.userBubble}`} />
        <div className={`${styles.box} ${styles.aiBubble}`} />
      </div>
      <div className={`${styles.skeletonBase} ${styles.chatInput}`} />
    </div>
  );
}
