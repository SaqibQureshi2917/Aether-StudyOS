import React from 'react';
import styles from '@/styles/skeletons.module.css';

export default function ChatLoading() {
  return (
    <div className={styles.chatLayout}>
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