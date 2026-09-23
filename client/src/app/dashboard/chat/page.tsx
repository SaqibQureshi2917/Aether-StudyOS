'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiRequest } from '@/lib/apiClient';
import { FiSend, FiGlobe, FiBookOpen, FiAlertTriangle, FiCheckCircle, FiPlus, FiPaperclip, FiImage, FiLink } from 'react-icons/fi';
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
  fileName?: string;
}

export default function ChatPage() {
  const [mode, setMode] = useState<'GENERAL' | 'STUDY'>('GENERAL');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  
  // File and menu state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleAddLink = () => {
    setIsMenuOpen(false);
    const url = prompt("Enter reference link:");
    if (url) {
      setInput((prev) => `${prev} [Reference Link: ${url}] `);
    }
  };

  const sendMessage = async (overrideMessage?: string, overrideMode?: 'GENERAL' | 'STUDY') => {
    const textToSend = overrideMessage || input;
    const modeToSend = overrideMode || mode;
    const currentFile = selectedFile;

    if ((!textToSend.trim() && !currentFile) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'USER',
      content: textToSend,
      mode: modeToSend,
      sourceType: 'GENERAL_AI',
      citations: [],
      fileName: currentFile?.name,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideMessage) setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', textToSend);
      formData.append('mode', modeToSend);
      if (conversationId) formData.append('conversationId', conversationId);
      if (currentFile) formData.append('file', currentFile);

      const res: any = await apiRequest('/chat', 'POST', formData);

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
    <main className={styles.main}>
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
          {messages.length === 0 && (
            <div className="text-center text-gray-500 my-auto">
              <p>Aapka AI academic assistant taiyyar hai, Qureshi!</p>
              <p className="text-xs mt-1">Sawal poochiye ya material attach karke guide lijiye.</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={msg.sender === 'USER' ? styles.userBubble : styles.assistantBubble}>
              {msg.fileName && (
                <div className="mb-2 text-xs bg-indigo-500/20 px-2 py-1 rounded flex items-center gap-1 text-indigo-300">
                  <FiPaperclip /> {msg.fileName}
                </div>
              )}

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

              {msg.sourceType === 'SOURCE_INSUFFICIENT' && (
                <button
                  type="button"
                  onClick={() => sendMessage(messages[messages.length - 2]?.content, 'GENERAL')}
                  className={styles.fallbackBtn}
                >
                  Get General Explanation →
                </button>
              )}

              {msg.citations && msg.citations.length > 0 && (
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
          <div ref={messagesEndRef} />
        </div>

        {/* File Preview Banner */}
        {selectedFile && (
          <div className={styles.filePreviewBanner}>
            <span>📎 Attached File: {selectedFile.name}</span>
            <button 
              type="button" 
              onClick={() => setSelectedFile(null)}
              className={styles.removeFileBtn}
            >
              Remove ✕
            </button>
          </div>
        )}

        {/* Input Controls with Popup Menu */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className={styles.inputArea}
        >
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files) setSelectedFile(e.target.files[0]);
              setIsMenuOpen(false);
            }}
            className={styles.hiddenInput}
            accept=".pdf,.txt,.doc,.docx"
          />
          <input
            type="file"
            ref={imageInputRef}
            onChange={(e) => {
              if (e.target.files) setSelectedFile(e.target.files[0]);
              setIsMenuOpen(false);
            }}
            className={styles.hiddenInput}
            accept="image/*"
          />

          <div className={styles.inputWrapper}>
            {/* Plus Button & Popup Menu */}
            <div className={styles.attachContainer}>
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={styles.attachBtn}
                title="Add attachment"
              >
                <FiPlus size={20} />
              </button>

              {isMenuOpen && (
                <div className={styles.attachMenu}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FiPaperclip size={14} /> Add File
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <FiImage size={14} /> Add Picture
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleAddLink}
                  >
                    <FiLink size={14} /> Add Link
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder={mode === 'GENERAL' ? 'Ask any general question...' : 'Ask about your uploaded lectures/notes...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className={styles.textInput}
            />

            <button type="submit" className={styles.sendBtn} disabled={isLoading}>
              <FiSend size={16} /> Send
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}