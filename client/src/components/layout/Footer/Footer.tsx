'use client';

import React from "react";
import Link from "next/link";
import styles from './Footer.module.css';

export default function Footer(){
    return(
        <footer className={styles.footerContainer}>
            <div className={styles.footerContent}>
                <div className={styles.brandInfo}>
                    <span className={styles.logoText}>Aether StudyOS</span>
                    <p className={styles.tagline}>
                        Connectd Academic Operating system for modern higher education.
                    </p>
                </div>
                <div className={styles.footerLinks}>
                    <Link href="/privacy" className={styles.link}>Privacy Policy</Link>
                    <Link href="/privacy" className={styles.link}>Academic Integrity Policy</Link>
                    <Link href="/pricing" className={styles.link}>Pricing</Link>
                </div>
            </div>
            <div className={styles.bottomBar}>
        <p>© {new Date().getFullYear()} Aether Genesis Studio. All rights reserved.</p>
      </div>
        </footer>
    )
}