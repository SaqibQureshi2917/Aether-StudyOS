'use client';

import React from "react";
import Link from "next/link";
import {motion} from "framer-motion";
import { FiCalendar, FiTarget, FiBookOpen, FiArrowDownRight, FiZap } from "react-icons/fi";
import styles from './FeaturesPreview.module.css'
import { MdOpacity } from "react-icons/md";

interface FeatureCard {
    title: string;
    desc: string;
    icon: React.ReactNode;
}
const coreFeatures: FeatureCard[]=[
   {
    title: 'Smart Semester Planner',
    desc: 'Extract courses, deadlines, and weightage. Automatically reschedules your study plan when reality changes.',
    icon: <FiCalendar />
  },
  {
    title: 'Assignment Coach',
    desc: 'Breaks complex assignment briefs and rubrics into manageable, milestone-based deadlines.',
    icon: <FiTarget />
  },
  {
    title: 'Source-Grounded AI Tutor',
    desc: 'Learns strictly from your uploaded course materials with explicit, page-level inline citations.',
    icon: <FiBookOpen />
  },
  {
    title: 'Exam Preparation Studio',
    desc: 'Measures topic mastery through targeted spaced-repetition testing and adaptive practice sets.',
    icon: <FiZap />
  }
];

export default function FeaturesPreview(){
    return(
        <section id="features" className={styles.featuresSection}>
            <div className={styles.headerBlock}>
                <motion.h2
                className={styles.sectionTitle}
                initial= {{opacity:0, y:20}}
                whileInView={{opacity:1 , y:0}}
                viewport={{once: true}}
                transition={{duration: 0.5}}
                >
                    Engineered for the Student Learning Loop
                </motion.h2>

                <motion.p
                className={styles.sectionSubtitle}
                initial={{opacity:0 , y:20}}
                whileInView={{opacity:1, y:0}}
                viewport={{once: true}}
                transition={{duration: 0.5, delay:0.1}}
                >
                    Four core interconnected capabilities feeding one central, adaptive study plan.
                </motion.p>
            </div>


            <div className={styles.gridContainer}>
                {coreFeatures.map((feature,idx)=>(
                    <motion.div
                    key={idx}
                    className={styles.featureCard}
                    initial={{opacity:0 , y: 25}}
                    whileInView={{opacity:1, y:0}}
                    viewport={{once: true}}
                    transition={{duration:0.4, delay: idx*0.1}}
                    whileHover={{y:-6}}
                    >
                        <div className={styles.iconWrapper}>{feature.icon}</div>
                        <h3 className={styles.cardTitle}>{feature.title}</h3>
                        <p className={styles.cardDesc}>{feature.desc}</p>
                    </motion.div>
                ))}
            </div>

            <motion.div
            className={styles.actionWrapper}
            initial={{opacity:0, }}
            whileInView={{opacity:1}}
            viewport={{once: true}}
            >
                <Link href="/features" className={styles.exploreLink}>
                Explore Full Capabilities <FiArrowDownRight className={styles.linkIcon}/>
                </Link>
            </motion.div>
        </section>
    )
}