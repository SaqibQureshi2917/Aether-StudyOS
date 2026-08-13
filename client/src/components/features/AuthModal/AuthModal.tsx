"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiMail,
  FiLock,
  FiUser,
  FiArrowRight,
  FiCheckCircle,
  FiX,
  FiEye,
  FiEyeOff,
  FiAlertCircle
} from "react-icons/fi";
import { useAuthModal } from "@/context/AuthContext";
import styles from "./AuthModal.module.css";
import { apiRequest } from "@/lib/apiClient";

export default function AuthModal() {
  const {
    isAuthModalOpen,
    authMode,
    prefilledEmail,
    closeAuthModal,
    setAuthMode,
  } = useAuthModal();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');


  useEffect(() => {
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
    setErrorMessage('');
    setErrorCode('');
  }, [prefilledEmail, isAuthModalOpen, authMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal();
    };
    if (isAuthModalOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isAuthModalOpen, closeAuthModal]);

  // handleSubmit function inside AuthModal.tsx
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setErrorMessage('');
  setErrorCode('');

  if (authMode === 'signup' && !agreeTerms) {
    setErrorMessage('Please accept the Academic Integrity Policy.');
    return;
  }

  setIsLoading(true);

  try {
    const endpoint = authMode === 'signup' ? '/auth/register' : '/auth/login';
    const payload = authMode === 'signup'
      ? { email, password, fullName }
      : { email, password };

    // Express Backend Hit (Port 5000)
    const data: any = await apiRequest(endpoint, 'POST', payload);

    // Save JWT Token & User Data
    if (data.token) {
      localStorage.setItem('studyos_token', data.token);
    }
    if (data.user) {
      localStorage.setItem('studyos_user', JSON.stringify(data.user));
    }

    setIsLoading(false);
    closeAuthModal();

    // Smart Routing based on Onboarding Status
    if (data.user && data.user.isOnboarded) {
      router.push('/dashboard');
    } else {
      router.push('/onboarding');
    }
  } catch (err: any) {
    console.error('Express Auth API Error:', err);
    setErrorMessage(err.message || 'Authentication failed. Check your connection.');
    if (err.code) setErrorCode(err.code);
    setIsLoading(false);
  }
};


  return(
    <AnimatePresence>
        {isAuthModalOpen && (
            <div className={styles.overlay} onClick={closeAuthModal}>
                <motion.div
                className={styles.modalCard}
                onClick={(e)=> e.stopPropagation()}
                initial={{opacity:0, scale:0.95, y:15}}
                animate={{opacity:1, scale:1, y:0}}
                exit={{opacity:0, scale:0.95,y:15}}
                transition={{duration:0.25, ease: 'easeOut'}}
                >
                    <button className={styles.closeBtn} onClick={closeAuthModal} aria-label="Close Modal">
                      <FiX/>
                    </button>

                    <div className={styles.tabContainer}>
                        <button 
                        type="button"
                        className={authMode === 'login' ? styles.activeTab : styles.tab}
                        onClick={()=> setAuthMode('login')}
                        >
                            Sign In
                        </button>
                        <button
                        type="button"
                        className={authMode === 'signup' ? styles.activeTab : styles.tab}
                        onClick={()=>setAuthMode('signup')}
                        >
                            Create Account
                        </button>
                    </div>

                    <div className={styles.headerBlock}>
                        <h2 className={styles.title}>
                            {authMode === 'login'? 'Welcome Back' : 'Claim Your Workspace'}
                        </h2>
                        <p className={styles.subtitle}>
                            {authMode === 'login'
                            ? 'Access your Acadamic operating system'
                        : 'Set Up your Single Acadamic profile for all courses'
                        }
                        </p>
                    </div>

                    {errorMessage && (
                        <div className={styles.errorAlert}>
                            <FiAlertCircle className={styles.errorIcon}/>
                           <div className={styles.errorContent}>
                            <span>{errorMessage}</span>
                            {errorCode === 'USER_NOT_FOUND' &&(
                                <button
                                type="button"
                                onClick={()=>{
                                    setErrorMessage('');
                                    setErrorCode('');
                                    setAuthMode('signup');
                                }} 
                                className={styles.switchModeBtn}
                                >
                                    Click here to Create Account →
                                </button>
                            )}
                           </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <AnimatePresence mode="wait">
                            {authMode === 'signup' && (
                                <motion.div
                                key='fullNameInput'
                                initial={{opacity:0, height:0}}
                                animate={{opacity:1, height:'auto'}}
                                exit={{opacity:0, height:0}}
                                className={styles.inputGroup}
                                >
                                    <label className={styles.label}>Full Name</label>
                                    <div className={styles.inputWrapper}>
                                        <FiUser className={styles.inputIcon}/>
                                        <input
                                         type="text"
                                         placeholder="Your Name"
                                         value={fullName}
                                         onChange={(e)=>setFullName(e.target.value)}
                                         className={styles.input}
                                         required= {authMode === "signup"}
                                         />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className={styles.inputGroup}>
                            <label className={styles.label}>Your Email</label>
                            <div className={styles.inputWrapper}>
                                <FiMail className={styles.inputIcon}/>
                                <input 
                            type="email" 
                            placeholder="abc@gmail.com"
                            value={email}
                            onChange={(e)=>setEmail(e.target.value)}
                            className={styles.input} 
                            required
                            />
                            </div>
                        </div>

                        <div className={styles.inputGroup}>

                            <div className={styles.labelRow}>
                                <label  className={styles.label}>Your Password</label>
                                {authMode === 'login' && (
                                  <Link 
                                  href='/forgot-password'
                                  onClick={closeAuthModal}
                                  className={styles.forgotLink}
                                  > 
                                  Forgot Password?
                                  </Link>
                                )}
                            </div>
                            <div className={styles.inputWrapper}>
                                <FiLock className={styles.inputIcon}/>
                                <input 
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter Password"
                                value={password}
                                onChange={(e)=>setPassword(e.target.value)}
                                className={styles.inputPassword}
                                required
                                maxLength={20}
                                minLength={6}
                                />
                                <button
                                type="button"
                                className={styles.togglePasswordBtn}
                                onClick={()=>setShowPassword((prev)=> !prev)}
                                aria-label={showPassword ? "Hide Password" : "Show Password"}
                                >
                                   {showPassword ? <FiEyeOff/> : <FiEye/>} 
                                </button>
                            </div>

                        </div>


                        {authMode === 'signup' &&(
                            <motion.div
                            className={styles.checkBoxGroup}
                            initial={{opacity:0}}
                            animate={{opacity:1}}
                            >
                                <input 
                                type="checkbox"
                                id="termsModal" 
                                checked={agreeTerms}
                                onChange={(e)=> setAgreeTerms(e.target.checked)}
                                className={styles.checkbox}
                                required
                                />
                                <label 
                                htmlFor="termsModal" 
                                className={styles.checkboxLabel}>
                                    I agree to the 
                                    <Link 
                                    href='./terms' 
                                    onClick={closeAuthModal} 
                                    className={styles.inlineLink}
                                    >
                                        Acadamic Integrity Policy
                                    </Link>
                                </label>
                            </motion.div>
                        )}

                        <motion.button
                        type="submit"
                        className={styles.submitBtn}
                        disabled={isLoading}
                        whileHover={{scale: isLoading ? 1 : 1.01}}
                        whileTap={{scale: isLoading ? 1 : 0.98}}
                        >
                            {isLoading ? (
                                'Connecting to Cloud DB.'
                            ): (
                                <>
                                {authMode === 'login' ? 'Sign In to Workspace' : 'Continue to Onboarding'}
                                <FiArrowRight className={styles.btnIcon} />
                                </>
                            )}
                        </motion.button>
                    </form>

                    <div className={styles.trustFooter}>
                        <FiCheckCircle className={styles.trustIcon}/>
                        <span>Course data remains isolated and encrypted.</span>
                    </div>
                </motion.div>
            </div>
        )}
    </AnimatePresence>
  );
}
