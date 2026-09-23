'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiCalendar, FiClock } from 'react-icons/fi';
import styles from './planner.module.css';
import skeletonStyles from '@/styles/skeletons.module.css'; 

export default function PlannerPage() {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/dashboard', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSessions(data.data.todayPlan || []);
        }
      })
      .catch(err => {
        console.error('Error fetching planner sessions:', err);
      });
  }, []);

  const handleAddSessionClick = () => {
    console.log('Add Study Session clicked');
  };

  return (
    <motion.div 
      className={`${skeletonStyles.plannerContainer} ${styles.plannerContainer}`}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <header className={styles.plannerHeader}>
        <div>
          <motion.h1 
            className={styles.title}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            Study Planner & Timeline
          </motion.h1>
          <motion.p 
            className={styles.subtitle}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            A complete overview of your scheduled study sessions and focus tasks for today.
          </motion.p>
        </div>
        <motion.button 
          type="button"
          onClick={handleAddSessionClick}
          className={styles.primaryActionBtn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiPlus /> Add Study Session
        </motion.button>
      </header>

      <div className={styles.plannerGrid}>
        {/* Timeline Column */}
        <motion.div 
          className={styles.timelineSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>Today&apos;s Sessions</h2>

          {sessions.length === 0 ? (
            <div className={styles.emptyState}>
              <FiCalendar className={styles.emptyIcon} />
              <p>No study sessions are scheduled for today.</p>
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map((session, index) => (
                <motion.div 
                  key={session.id} 
                  className={styles.sessionCard}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <div className={styles.sessionTime}>
                    <FiClock className={styles.clockIcon} />
                    <span>
                      {new Date(session.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                      {' — '}
                      {new Date(session.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={styles.sessionDetails}>
                    <h3>{session.task?.title || 'Study Task'}</h3>
                    <p className={styles.taskMeta}>
                      {session.task?.assignment?.title ? `Assignment: ${session.task.assignment.title}` : 'General Study Session'}
                    </p>
                  </div>
                  <span className={`${styles.statusBadge} ${styles[session.status.toLowerCase()]}`}>
                    {session.status}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Sidebar Actions Column */}
        <motion.div 
          className={styles.sidebarSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <h2 className={styles.sectionTitle}>Planner Tools</h2>
          <div className={styles.actionCard}>
            <h3>AI Auto-Scheduler</h3>
            <p>Schedule your pending assignments intelligently across your free slots.</p>
            <motion.button 
              type="button"
              className={styles.secondaryBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Optimize Schedule
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}