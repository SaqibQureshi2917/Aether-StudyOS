'use client';

import React, { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar/Sidebar';
import Header from '@/components/layout/Header/Header';
import { apiRequest } from '@/lib/apiClient';
import { FiSend, FiGlobe, FiBookOpen, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import styles from './chat.module.css';

interface Citation {
  citationId: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
}

interface Message {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  mode: 'GENERAL' | 'STUDY';
  sourceType: 'GENERAL_AI' | 'SOURCE_GROUNDED' | 'SOURCE_INSUFFICIENT';
  citations: Citation[];
}

export default function ChatPage() {
  const [mode, setMode] = useState<'GENERAL' | 'STUDY'>('GENERAL');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (overrideMessage?: string, overrideMode?: 'GENERAL' | 'STUDY') => {
    const textToSend = overrideMessage || input;
    const modeToSend = overrideMode || mode;

    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'USER',
      content: textToSend,
      mode: modeToSend,
      sourceType: 'GENERAL_AI',
      citations: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideMessage) setInput('');
    setIsLoading(true);

    try {
      const res: any = await apiRequest('/chat', 'POST', {
        message: textToSend,
        conversationId,
        mode: modeToSend,
      });

      if (res.data) {
        setConversationId(res.data.conversationId);
        const assistantMsg: Message = {
          id: res.data.messageId,
          sender: 'ASSISTANT',
          content: res.data.answer,
          mode: res.data.mode,
          sourceType: res.data.sourceType,
          citations: res.data.citations || [],
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
    } catch (err) {
      console.error('Chat API Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.layout}>
      <Sidebar onOpenSetupModal={() => {}} />

      <main className={styles.main}>
        <Header />

        <div className={styles.chatContainer}>
          {/* Mode Selector Toggle */}
          <div className={styles.modeHeader}>
            <div className={styles.modeSwitchGroup}>
              <button
                type="button"
                className={mode === 'GENERAL' ? styles.activeModeBtn : styles.modeBtn}
                onClick={() => setMode('GENERAL')}
              >
                <FiGlobe /> General Chat
              </button>
              <button
                type="button"
                className={mode === 'STUDY' ? styles.activeModeBtn : styles.modeBtn}
                onClick={() => setMode('STUDY')}
              >
                <FiBookOpen /> StudyOS Tutor
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div className={styles.messageStream}>
            {messages.map((msg) => (
              <div key={msg.id} className={msg.sender === 'USER' ? styles.userBubble : styles.assistantBubble}>
                {msg.sender === 'ASSISTANT' && (
                  <>
                    {msg.sourceType === 'GENERAL_AI' && (
                      <div className={styles.sourceBannerGeneral}>
                        <FiGlobe /> General AI Response (Not based on uploaded materials)
                      </div>
                    )}
                    {msg.sourceType === 'SOURCE_GROUNDED' && (
                      <div className={styles.sourceBannerGrounded}>
                        <FiCheckCircle /> Source-Grounded Answer
                      </div>
                    )}
                    {msg.sourceType === 'SOURCE_INSUFFICIENT' && (
                      <div className={styles.sourceBannerInsufficient}>
                        <FiAlertTriangle /> Not enough information in uploaded study materials
                      </div>
                    )}
                  </>
                )}

                <p>{msg.content}</p>

                {/* Explicit Fallback Action if Evidence Insufficient */}
                {msg.sourceType === 'SOURCE_INSUFFICIENT' && (
                  <button
                    type="button"
                    onClick={() => sendMessage(messages[messages.length - 2]?.content, 'GENERAL')}
                    className={styles.fallbackBtn}
                  >
                    Get General Explanation →
                  </button>
                )}

                {/* Verified Clickable Citations */}
                {msg.citations.length > 0 && (
                  <div className={styles.citationBox}>
                    <span className={styles.citationTitle}>Verified Sources:</span>
                    {msg.citations.map((cit, idx) => (
                      <span key={idx} className={styles.citationTag}>
                        [{idx + 1}] {cit.fileName} — Page {cit.pageNumber}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className={styles.inputArea}
          >
            <input
              type="text"
              placeholder={mode === 'GENERAL' ? 'Ask any general question...' : 'Ask about your uploaded lectures/notes...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.textInput}
            />
            <button type="submit" className={styles.sendBtn} disabled={isLoading}>
              <FiSend /> Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}