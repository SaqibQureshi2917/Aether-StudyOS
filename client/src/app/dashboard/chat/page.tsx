'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import { FiSend, FiBookOpen, FiFileText, FiUser, FiCpu } from 'react-icons/fi';
import styles from './chat.module.css';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  citation?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'ai',
      text: 'Hello! I am your Source-Grounded AI Tutor. Select a subject or ask any question from your uploaded syllabus.',
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate Source-Grounded AI Response with citation
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'ai',
        text: 'Based on your Artificial Intelligence course outline, heuristic search algorithms evaluate node costs using h(n).',
        citation: 'Source: AI_Course_Syllabus.pdf — Page 14, Section 3.2'
      };
      setMessages((prev) => [...prev, aiMsg]);
    }, 1000);
  };

  return (
    <div className={styles.chatLayout}>
      <Sidebar onOpenSetupModal={() => {}} />

      <main className={styles.chatContainer}>
        {/* Chat Header with Active Course Dropdown */}
        <header className={styles.chatHeader}>
          <div className={styles.headerTitle}>
            <FiCpu className={styles.aiIcon} />
            <h2>AI Study Tutor Workspace</h2>
          </div>
          <select className={styles.subjectSelect}>
            <option value="all">All Uploaded Courses</option>
            <option value="ai">CS401 - Artificial Intelligence</option>
            <option value="se">SE302 - Software Architecture</option>
          </select>
        </header>

        {/* Messages Stream */}
        <div className={styles.messageStream}>
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={msg.sender === 'user' ? styles.userRow : styles.aiRow}
            >
              <div className={msg.sender === 'user' ? styles.userAvatar : styles.aiAvatar}>
                {msg.sender === 'user' ? <FiUser /> : <FiCpu />}
              </div>
              <div className={msg.sender === 'user' ? styles.userBubble : styles.aiBubble}>
                <p>{msg.text}</p>
                {msg.citation && (
                  <div className={styles.citationBadge}>
                    <FiFileText /> {msg.citation}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className={styles.inputForm}>
          <input
            type="text"
            placeholder="Ask a question from your course outlines..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={styles.chatInput}
          />
          <button type="submit" className={styles.sendBtn}>
            <FiSend /> Send
          </button>
        </form>
      </main>
    </div>
  );
}