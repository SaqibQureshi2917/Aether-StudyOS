"use client";

import React, {createContext, useContext, useEffect, useState} from "react"

type Theme = "light" | "dark";

interface ThemeContextType{
    theme : Theme;
    toggleTheme: ()=> void;
}
const ThemeContext = createContext<ThemeContextType | undefined> (undefined);

export const ThemeProvider = ({children}: {children: React.ReactNode}) =>{
    const [theme, setTheme] = useState<Theme>("dark");

    useEffect (()=>{

        const savedTheme = localStorage.getItem("aether-theme") as Theme;
        if(savedTheme){
            setTheme(savedTheme);
        } else if (window.matchMedia("(prefers-color-scheme: dark)").matches){
            setTheme("dark");
        }
    }, []);

    useEffect(()=>{
        document.documentElement.setAttribute("data-theme" , theme);
        localStorage.setItem('aether-theme', theme);
    },[theme]);

const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{theme, toggleTheme}}>
        {children}
    </ThemeContext.Provider>
  );

};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};