'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { motion } from 'framer-motion';
import { FiCheck, FiZap, FiBookOpen } from 'react-icons/fi';
import { useAuthModal } from '@/context/AuthContext';
import styles from './pricing.module.css';

export default function PricingPage() {
  const { openAuthModal } = useAuthModal();

  return (
    <>
      <Navbar />
      <main className={styles.container}>
        {/* Header */}
        <section className={styles.headerArea}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={styles.headerContent}
          >
            <h1 className={styles.title}>Simple, Transparent Pricing</h1>
            <p className={styles.subtitle}>
              Start for free with core study tools or unlock advanced AI processing power.
            </p>
          </motion.div>
        </section>

        {/* Pricing Cards Grid */}
        <section className={styles.cardsSection}>
          <div className={styles.cardsGrid}>
            {/* Free Tier */}
            <motion.div
              className={styles.card}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
            >
              <div className={styles.cardHeader}>
                <div className={styles.tierBadge}><FiBookOpen /> Student Tier</div>
                <h2 className={styles.price}>$0 <span>/ forever</span></h2>
                <p className={styles.cardDesc}>Essential workspace for individual self-study and course organization.</p>
              </div>
              <ul className={styles.featureList}>
                <li><FiCheck className={styles.checkIcon} /> Up to 3 Uploaded Course Outlines</li>
                <li><FiCheck className={styles.checkIcon} /> Source-Grounded AI Tutor Chatbot</li>
                <li><FiCheck className={styles.checkIcon} /> Zero-Penalty Adaptive Planner</li>
                <li><FiCheck className={styles.checkIcon} /> Basic Citation Tracking</li>
              </ul>
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className={styles.outlineBtn}
              >
                Get Started Free
              </button>
            </motion.div>

            {/* Pro Tier (Featured) */}
            <motion.div
              className={styles.featuredCard}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              <div className={styles.popularTag}>Most Popular</div>
              <div className={styles.cardHeader}>
                <div className={styles.proBadge}><FiZap /> Academic Pro</div>
                <h2 className={styles.price}>$9 <span>/ month</span></h2>
                <p className={styles.cardDesc}>For power users managing heavy multi-subject academic workloads.</p>
              </div>
              <ul className={styles.featureList}>
                <li><FiCheck className={styles.checkIcon} /> Unlimited Course Syllabi Uploads</li>
                <li><FiCheck className={styles.checkIcon} /> High-Priority AI Reasoning Speed</li>
                <li><FiCheck className={styles.checkIcon} /> Deep-Dive AI Exam Studio</li>
                <li><FiCheck className={styles.checkIcon} /> Page-Level Citation Maps</li>
                <li><FiCheck className={styles.checkIcon} /> Priority Support & Custom Prompts</li>
              </ul>
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className={styles.primaryBtn}
              >
                Start 14-Day Free Trial
              </button>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}