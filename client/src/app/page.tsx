'use client';
import { useTheme } from "@/context/ThemeContext";
import styles from '../styles/landing.module.css';
import Navbar from "@/components/layout/Navbar/Navbar";
import Hero from "@/components/layout/Hero/Hero";

export default function LandingPage(){
    const {theme, toggleTheme} = useTheme();

    return(
      <>
      <Navbar/>
      <main>
        <Hero/>
      </main></>
    )
}