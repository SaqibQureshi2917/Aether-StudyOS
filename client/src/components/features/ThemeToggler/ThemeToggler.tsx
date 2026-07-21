'use cleint';

import React from "react";
import { motion } from 'framer-motion'
import{useTheme} from '@/context/ThemeContext'
import styles from './Theme.module.css';
import { FiMoon, FiSun } from "react-icons/fi";
import { button } from "framer-motion/client";

export default function ThemeToggler() {
    const { theme, toggleTheme} = useTheme();

    return (
        <motion.button
        onClick={toggleTheme}
        className={styles.toggleBtn}
        aria-label="Toggle Application theme"
        whileHover={{ scale: 1.05 }}
        whileTap={{scale:0.92}}
        >

            <motion.div
            key={theme}
            initial={{rotate: -90, opacity:0}}
            animate={{rotate: 0, opacity:1}}
            exit={{rotate:90,opacity:0.2}}
            transition={{duration:0.2}}
            className={styles.iconWrapper}
            >
                {theme === 'dark' ? <FiSun className={styles.sunIcon}/> : <FiMoon className={styles.moonIcon}/>}

            </motion.div>
        </motion.button>
    );
}