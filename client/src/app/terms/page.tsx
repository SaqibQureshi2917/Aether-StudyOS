'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiAlertCircle, FiAward } from 'react-icons/fi';
import styles from './terms.module.css';

export default function TermsPage() {
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
            <span className={styles.badge}><FiAward /> Terms & Honor Code</span>
            <h1 className={styles.title}>Academic Integrity Policy</h1>
            <p className={styles.subtitle}>
              Our commitment to authentic learning and responsible AI usage in higher education.
            </p>
          </motion.div>
        </section>

        <section className={styles.contentSection}>
          <div className={styles.noticeCard}>
            <FiCheckCircle className={styles.checkIcon} />
            <div>
              <h3>Built for Authentic Mastery</h3>
              <p>Aether StudyOS is designed to tutor, test, and guide students—not to write essays or generate shortcuts for unearned academic credit.</p>
            </div>
          </div>

          <div className={styles.rulesBlock}>
            <h2>1. Acceptable Use Guidelines</h2>
            <p>Students agree to use StudyOS for personal study planning, practice diagnostic testing, and concept clarification grounded in their own course materials.</p>

            <h2>2. Honor Code & Institutional Compliance</h2>
            <p>Users are solely responsible for ensuring their usage aligns with their respective university or academic institution's AI and academic integrity policies.</p>

            <h2>3. Service Availability</h2>
            <p>Aether StudyOS provides AI-generated tutoring and dynamic scheduling on an "as-is" basis to assist study habits, without replacing formal institutional instruction.</p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}