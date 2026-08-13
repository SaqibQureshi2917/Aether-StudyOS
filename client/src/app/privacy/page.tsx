'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { motion } from 'framer-motion';
import { FiLock, FiShield, FiDatabase, FiEyeOff } from 'react-icons/fi';
import styles from './privacy.module.css';

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className={styles.container}>
        <section className={styles.headerArea}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={styles.headerContent}
          >
            <span className={styles.badge}><FiLock /> Privacy First</span>
            <h1 className={styles.title}>Privacy Policy & Data Security</h1>
            <p className={styles.subtitle}>
              Your academic documents and study records belong solely to you. Here is how we protect your information.
            </p>
          </motion.div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.policyGrid}>
            <div className={styles.policyCard}>
              <FiShield className={styles.icon} />
              <h3>Course Syllabus Isolation</h3>
              <p>Uploaded course Outlines and PDFs are stored in encrypted, isolated containers. Other users cannot access your documents.</p>
            </div>

            <div className={styles.policyCard}>
              <FiDatabase className={styles.icon} />
              <h3>Zero Public Model Training</h3>
              <p>Your academic notes, uploaded PDFs, and chatbot interactions are never used to train public third-party AI models.</p>
            </div>

            <div className={styles.policyCard}>
              <FiEyeOff className={styles.icon} />
              <h3>No Third-Party Data Selling</h3>
              <p>We do not monetize student data or sell personal university information to advertisers or external vendors.</p>
            </div>
          </div>

          <div className={styles.textBlock}>
            <h2>1. Information We Collect</h2>
            <p>We collect essential account details (name and email address) and user-uploaded academic materials (syllabi, course outlines, timetables) strictly to power your AI tutor and study planner.</p>

            <h2>2. Data Retention & Erasure</h2>
            <p>You can request complete account erasure or remove uploaded course files at any time via your Account Settings dashboard.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}