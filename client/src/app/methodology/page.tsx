'use client';

import React from 'react';
import Navbar from '@/components/layout/Navbar/Navbar';
import Footer from '@/components/layout/Footer/Footer';
import { motion } from 'framer-motion';
import { FiBookOpen, FiCpu, FiRefreshCw, FiTarget, FiShield } from 'react-icons/fi';
import styles from './methodology.module.css';

const steps = [
  {
    icon: <FiBookOpen />,
    stepNumber: '01',
    title: 'Syllabus Ingestion & Parsing',
    desc: 'Upload your course outlines or semester timetables. Our AI extracts core learning objectives, weightages, and topic hierarchies.',
  },
  {
    icon: <FiTarget />,
    stepNumber: '02',
    title: 'Autonomous Practice Generation',
    desc: 'Instead of raw homework tracking, StudyOS creates independent diagnostic quizzes and practice assignments targeted at weak areas.',
  },
  {
    icon: <FiCpu />,
    stepNumber: '03',
    title: 'Source-Grounded AI Tutoring',
    desc: 'Ask questions and receive explanations with page-level inline citations strictly referenced from your uploaded course material.',
  },
  {
    icon: <FiRefreshCw />,
    stepNumber: '04',
    title: 'Zero-Penalty Recalibration',
    desc: 'Missed a day? The adaptive scheduler dynamically adjusts your target pace without guilt, backlog accumulation, or blaming penalties.',
  },
];

export default function MethodologyPage() {
  return (
    <>
      <Navbar />
      <main className={styles.container}>
        {/* Hero Banner */}
        <section className={styles.heroSection}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className={styles.heroContent}
          >
            <span className={styles.badge}>Pedagogical Framework</span>
            <h1 className={styles.title}>
              Engineered for <span className={styles.highlight}>Authentic Learning</span>
            </h1>
            <p className={styles.subtitle}>
              Aether StudyOS is built on evidence-based cognitive psychology and spaced-repetition models to turn heavy course loads into manageable study habits.
            </p>
          </motion.div>
        </section>

        {/* 4-Step Framework Grid */}
        <section className={styles.frameworkSection}>
          <div className={styles.grid}>
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                className={styles.stepCard}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1, duration: 0.4 }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.iconWrapper}>{step.icon}</div>
                  <span className={styles.stepNum}>{step.stepNumber}</span>
                </div>
                <h3 className={styles.cardTitle}>{step.title}</h3>
                <p className={styles.cardDesc}>{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Integrity Commitment */}
        <section className={styles.trustSection}>
          <div className={styles.trustCard}>
            <FiShield className={styles.shieldIcon} />
            <h2>Zero Essay Shortcuts. 100% Authentic Growth.</h2>
            <p>
              StudyOS is not a cheat tool or essay generator. It acts as an active learning partner designed to help you comprehend course material faster and retain knowledge longer.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}