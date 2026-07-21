"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FiArrowRight, FiCheckCircle } from "react-icons/fi";
import styles from "./Hero.module.css";

export default function Hero() {
  const [email, setEmail] = useState("");

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      window.location.href = "signup?email={encodeURIComponent(email)}";
    }
  };
  return (
    <section className={styles.heroSection}>
      <div className={styles.contentContainer}>
        <motion.div
          className={styles.badge}
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className={styles.badgeDot}></span>
          Next-Gen Acadamic Oparating System
        </motion.div>

        <motion.h1
          className={styles.headline}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Your Acadamic{" "}
          <span className={styles.highlight}>Operating System</span>
        </motion.h1>

        <motion.p
          className={styles.subheadline}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Plan your Semester, consult Source-Grounded AI tutor, and recover
          instantly when schedules change. One connected workspace, zero chaos.
        </motion.p>

        <motion.form
          onSubmit={handleStart}
          className={styles.ctaForm}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <input
            type="email"
            placeholder="Enter your email..."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.emailInput}
            required
          />
          <motion.button
            type="submit"
            className={styles.primaryBtn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Get Started <FiArrowRight className={styles.btnIcon} />
          </motion.button>
        </motion.form>

        <motion.div
          className={styles.trustBadge}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <FiCheckCircle className={styles.checkIcon} />
          Built for authentic learning. No essay shortcuts, zero fabrication.
        </motion.div>
      </div>
    </section>
  );
}
