"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import ThemeToggler from "@/components/features/ThemeToggler/ThemeToggler";
import { useAuthModal } from "@/context/AuthContext";
import styles from "./Navbar.module.css";
import { NavItem } from "./types";
import { FiMenu, FiX } from "react-icons/fi";

const navigationLinks: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Methodology", href: "/methodology" },
  { label: "Pricing", href: "/pricing" },
];

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState<string>("");
  const pathname = usePathname();
  const{openAuthModal}= useAuthModal();

  useEffect(() => {
    if (pathname !== "/") {
        setActivePage("");
    return;
    }
    const observerOptions: IntersectionObserverInit = {
        root: null,
        rootMargin: '-20% 0px -50% 0px',
        threshold: 0.1
    };
    const handleIntersect: IntersectionObserverCallback= (entries)=>{
        entries.forEach((entry)=>{
            if(entry.isIntersecting){
                setActivePage(
                    `#${entry.target.id}`
                );
            }
        });
    }
    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const featuresElement = document.getElementById('features');

    if(featuresElement){
        observer.observe(featuresElement);
    }
    const handleScroll = () =>{
        if(window.scrollY < 200){
            setActivePage('')
        }
    };
    window.addEventListener('scroll' , handleScroll)

    return()=>{
        if(featuresElement) observer.unobserve(featuresElement);
        window.removeEventListener('scroll' , handleScroll)
    };
  },[pathname]);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  const toggleMobielMenu = () => setIsMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className={styles.navbar}>
      <div className={styles.logoContainer}>
        <Link className={styles.logo} href="/" onClick={closeMobileMenu}>
          Aether StudyOS <span className={styles.betaBadge}>Beta</span>
        </Link>
      </div>

      <nav className={styles.desktopNav}>
        {navigationLinks.map((link, idx) => {
          const isActive = link.href.startsWith('#')
          ? activePage === link.href
            : pathname === link.href;
          return (
            <Link
              key={idx}
              href={link.href}
              className={isActive ? styles.navLinkActive : styles.navLink}
            >
              {link.label}
              {isActive && (
                <motion.div
                  layoutId="activeIndcator"
                  className={styles.activeIndicator}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <div className={styles.actions}>
        <ThemeToggler />

        <button type="button" onClick={()=>openAuthModal('login')} className={styles.signInBtn}>
          Sign In
        </button>

        <motion.button
          className={styles.hamburgerBtn}
          whileTap={{ scale: 0.9 }}
          onClick={toggleMobielMenu}
          aria-label="Toggle Navigation Menu"
        >
          {isMobileMenuOpen ? <FiX /> : <FiMenu />}
        </motion.button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className={styles.mobileDrawer}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            <nav className={styles.mobileNav}>
              {navigationLinks.map((link, idx) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                  >
                    <Link
                      href={link.href}
                      className={
                        isActive
                          ? styles.mobileNavLinkActive
                          : styles.mobileNavLinks
                      }
                      onClick={closeMobileMenu}
                    >
                      {link.label}
                    </Link>
                  </motion.div>
                );
              })}

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <button
                type="button"
                  className={styles.mobileSignInBtn}
                  onClick={()=>{
                    closeMobileMenu();
                    openAuthModal('login')
                  }}
                >
                  Sign In to Account
                </button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
