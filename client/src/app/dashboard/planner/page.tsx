'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiPlus, FiCalendar, FiClock } from 'react-icons/fi';
import { apiRequest } from '@/lib/apiClient';
import styles from './planner.module.css';
import skeletonStyles from '@/styles/skeletons.module.css'; 

export default function PlannerPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const loadPlannerData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response: any = await apiRequest('/dashboard/overview', 'GET');
      setSessions(response.data?.todayPlan || []);
      setActiveSemesterId(response.data?.user?.activeSemesterId || null);
    } catch (err: any) {
      setError(err?.message || 'Could not load your planner. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlannerData(); }, [loadPlannerData]);

  const handleAddSessionClick = () => {
    router.push('/dashboard/assignments?action=new');
  };

  const handleOptimizeSchedule = async () => {
    if (!activeSemesterId) {
      setError('Create an active semester and courses before generating a schedule.');
      return;
    }
    try {
      setIsGenerating(true);
      setError('');
      await apiRequest('/planner/generate', 'POST', { semesterId: activeSemesterId });
      await loadPlannerData();
    } catch (err: any) {
      setError(err?.message || 'Could not generate a schedule. Check that study availability is configured.');
    } finally {
      setIsGenerating(false);
    }
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
        {error && <p role="alert">{error}</p>}
        <motion.button 
          type="button"
          onClick={handleAddSessionClick}
          className={styles.primaryActionBtn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <FiPlus /> Add Assignment
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

          {loading ? (
            <div className={styles.emptyState} role="status">Loading your sessions...</div>
          ) : sessions.length === 0 ? (
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
            <h3>Adaptive Schedule Generator</h3>
            <p>Schedule pending study tasks into your available study slots.</p>
            <motion.button 
              type="button"
              onClick={handleOptimizeSchedule}
              disabled={isGenerating}
              className={styles.secondaryBtn}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isGenerating ? 'Generating...' : 'Optimize Schedule'}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
