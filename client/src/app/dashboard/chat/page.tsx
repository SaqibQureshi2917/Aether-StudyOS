'use client';

import React, { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FiAlertTriangle, FiBookOpen, FiCheck, FiCheckCircle, FiCopy, FiFileText,
  FiGlobe, FiImage, FiMessageSquare, FiPlus, FiRefreshCw, FiSend, FiTrash2, FiX,
} from 'react-icons/fi';
import { apiRequest } from '@/lib/apiClient';
import { formatTimePK } from '@/lib/dateFormat';
import MarkdownContent from './MarkdownContent';
import ChatPageSkeleton from '@/components/layout/ChatPageSkeleton/ChatPageSkeleton';
import styles from './chat.module.css';

type ChatMode = 'GENERAL' | 'STUDY';
type SourceType = 'GENERAL_AI' | 'SOURCE_GROUNDED' | 'SOURCE_INSUFFICIENT';

interface Citation {
  citationId?: string;
  id?: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  chunkId: string;
}

interface ChatMessage {
  id: string;
  sender: 'USER' | 'ASSISTANT';
  content: string;
  mode: ChatMode;
  sourceType: SourceType;
  citations: Citation[];
  createdAt: string;
  attachmentName?: string;
}

interface CourseOption { id: string; name: string }
interface MaterialOption { id: string; title: string; courseId: string; isIndexed: boolean }
interface ApiResponse<T> { success: boolean; data: T }
interface SavedChatMessage extends ChatMessage { citations: Citation[] }
interface ConversationDetails { id: string; title: string; messages: SavedChatMessage[] }
interface ChatReply {
  conversationId: string;
  userMessageId: string;
  messageId: string;
  mode: ChatMode;
  answer: string;
  sourceType: SourceType;
  citations: Citation[];
  createdAt: string;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<ChatMode>('GENERAL');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<string>();
  const [conversationTitle, setConversationTitle] = useState('New conversation');
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [courseId, setCourseId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reindexingMaterialId, setReindexingMaterialId] = useState<string | null>(null);
  const [chatError, setChatError] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [copyNotice, setCopyNotice] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameTitle, setRenameTitle] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingConversation, setIsSavingConversation] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const localMessageCounter = useRef(0);
  const latestUserMessage = useMemo(() => [...messages].reverse().find((item) => item.sender === 'USER'), [messages]);
  const lastAssistantMessageId = useMemo(() => [...messages].reverse().find((item) => item.sender === 'ASSISTANT')?.id, [messages]);

  const resetConversation = useCallback(() => {
    setConversationId(undefined);
    setConversationTitle('New conversation');
    setMessages([]);
    setMode('GENERAL');
    setChatError('');
    setLoadError('');
    setSelectedFile(null);
    setUploadNotice('');
    setIsRenaming(false);
    setIsDeleteDialogOpen(false);
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setIsLoadingConversation(true);
    setLoadError('');
    setChatError('');
    try {
      const response = await apiRequest<ApiResponse<{ conversation: ConversationDetails }>>(`/chat/threads/${id}`, 'GET');
      const conversation = response.data?.conversation;
      if (!conversation) throw new Error('This conversation could not be loaded.');
      setConversationId(conversation.id);
      setConversationTitle(conversation.title);
      const savedMessages: ChatMessage[] = conversation.messages || [];
      setMessages(savedMessages);
      if (savedMessages.length) setMode(savedMessages[savedMessages.length - 1].mode);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'This conversation could not be loaded.'));
    } finally {
      setIsLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    const threadId = searchParams.get('threadId');
    const subjectId = searchParams.get('courseId');
    // Route changes trigger an authenticated history load and update the chat view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (threadId) void loadConversation(threadId);
    else {
      resetConversation();
      if (subjectId) { setCourseId(subjectId); setMode('STUDY'); }
    }
  }, [searchParams, loadConversation, resetConversation]);

  const loadStudySources = useCallback(async () => {
    const [courseResponse, materialResponse] = await Promise.all([
      apiRequest<ApiResponse<{ courses: CourseOption[] }>>('/courses', 'GET'),
      apiRequest<ApiResponse<{ materials: MaterialOption[] }>>('/materials', 'GET'),
    ]);
    setCourses(courseResponse.data?.courses || []);
    setMaterials(materialResponse.data?.materials || []);
  }, []);

  useEffect(() => {
    // Initial API loading is an external synchronization for the chat's subject/document controls.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStudySources().catch(() => {
      setCourses([]);
      setMaterials([]);
    });
  }, [loadStudySources]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const refreshConversationList = () => window.dispatchEvent(new Event('studyos:chat-updated'));

  const sendMessage = async (messageOverride?: string, modeOverride?: ChatMode) => {
    const attachmentToSend = messageOverride === undefined ? selectedFile : null;
    const message = (messageOverride ?? input).trim() || (attachmentToSend ? 'Please explain the attached file.' : '');
    const selectedMode = modeOverride ?? mode;
    if (!message || isLoading) return;

    localMessageCounter.current += 1;
    const localMessageId = `pending-${localMessageCounter.current}`;
    const optimisticMessage: ChatMessage = {
      id: localMessageId,
      sender: 'USER',
      content: message,
      mode: selectedMode,
      sourceType: 'GENERAL_AI',
      citations: [],
      createdAt: new Date().toISOString(),
      ...(attachmentToSend ? { attachmentName: attachmentToSend.name } : {}),
    };
    setMessages((current) => [...current, optimisticMessage]);
    setInput('');
    setChatError('');
    setIsLoading(true);

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const created = await apiRequest<ApiResponse<{ conversation: { id: string } }>>('/chat/threads', 'POST', {});
        activeConversationId = created.data?.conversation?.id;
        if (!activeConversationId) throw new Error('A new conversation could not be started. Please try again.');
        setConversationId(activeConversationId);
      }

      let requestBody: FormData | { message: string; conversationId: string; mode: ChatMode; courseId?: string };
      if (attachmentToSend) {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('conversationId', activeConversationId);
        formData.append('mode', selectedMode);
        if (selectedMode === 'STUDY' && courseId) formData.append('courseId', courseId);
        formData.append('attachment', attachmentToSend);
        requestBody = formData;
      } else {
        requestBody = { message, conversationId: activeConversationId, mode: selectedMode, ...(selectedMode === 'STUDY' && courseId ? { courseId } : {}) };
      }
      const response = await apiRequest<ApiResponse<ChatReply>>('/chat', 'POST', requestBody);
      const data = response.data;
      setMessages((current) => [
        ...current.map((item) => item.id === localMessageId ? { ...item, id: data.userMessageId } : item),
        {
          id: data.messageId,
          sender: 'ASSISTANT',
          content: data.answer,
          mode: data.mode,
          sourceType: data.sourceType,
          citations: data.citations || [],
          createdAt: data.createdAt || new Date().toISOString(),
        },
      ]);
      setConversationTitle((current) => current === 'New conversation' ? message.slice(0, 72) : current);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.replace(`/dashboard/chat?threadId=${encodeURIComponent(activeConversationId)}`, { scroll: false });
      refreshConversationList();
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, 'Your message could not be sent. Try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const regenerateReply = async (message = latestUserMessage?.content, selectedMode = latestUserMessage?.mode || mode) => {
    if (!conversationId || !message || isLoading) return;
    const previousReplyId = messages[messages.length - 1]?.sender === 'ASSISTANT' ? messages[messages.length - 1].id : null;
    setChatError('');
    setIsLoading(true);
    try {
      const response = await apiRequest<ApiResponse<ChatReply>>(`/chat/threads/${conversationId}/regenerate`, 'POST', {
        message,
        mode: selectedMode,
        ...(selectedMode === 'STUDY' && courseId ? { courseId } : {}),
      });
      const data = response.data;
      setMessages((current) => [
        ...current.filter((item) => item.id !== previousReplyId),
        {
          id: data.messageId,
          sender: 'ASSISTANT',
          content: data.answer,
          mode: data.mode,
          sourceType: data.sourceType,
          citations: data.citations || [],
          createdAt: data.createdAt || new Date().toISOString(),
        },
      ]);
      refreshConversationList();
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, 'The reply could not be retried. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const uploadMaterial = async () => {
    if (!selectedFile) return;
    if (!courseId) {
      setChatError('Choose a subject before uploading a study file.');
      return;
    }
    setIsUploading(true);
    setChatError('');
    setUploadNotice('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('courseId', courseId);
      formData.append('title', selectedFile.name.replace(/\.[^.]+$/, ''));
      const response = await apiRequest<ApiResponse<{ material?: { isIndexed?: boolean }; indexingMessage?: string }>>('/materials/upload', 'POST', formData);
      const isIndexed = Boolean(response.data?.material?.isIndexed);
      setUploadNotice(isIndexed
        ? `${selectedFile.name} is ready for StudyOS Tutor.`
        : response.data?.indexingMessage || `${selectedFile.name} was uploaded, but is not ready for Tutor answers yet.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      void loadStudySources().catch(() => undefined);
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, 'The file could not be uploaded. Check the file type and try again.'));
    } finally {
      setIsUploading(false);
    }
  };

  const indexExistingMaterial = async (material: MaterialOption) => {
    if (reindexingMaterialId) return;
    setReindexingMaterialId(material.id);
    setChatError('');
    try {
      await apiRequest(`/materials/${material.id}/index`, 'POST', {});
      setMaterials((current) => current.map((item) => item.id === material.id ? { ...item, isIndexed: true } : item));
      setUploadNotice(`${material.title} is ready for StudyOS Tutor.`);
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, `${material.title} could not be prepared for Tutor search.`));
    } finally {
      setReindexingMaterialId(null);
    }
  };

  const startNewConversation = () => {
    resetConversation();
    router.replace('/dashboard/chat?new=true', { scroll: false });
  };

  const saveRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!conversationId || !renameTitle.trim() || isSavingConversation) return;
    setIsSavingConversation(true);
    setChatError('');
    try {
      const response = await apiRequest<ApiResponse<{ conversation: { title: string } }>>(`/chat/threads/${conversationId}`, 'PATCH', { title: renameTitle.trim() });
      setConversationTitle(response.data?.conversation?.title || renameTitle.trim());
      setIsRenaming(false);
      refreshConversationList();
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, 'The conversation name could not be changed.'));
    } finally {
      setIsSavingConversation(false);
    }
  };

  const deleteCurrentConversation = async () => {
    if (!conversationId || isDeleting) return;
    setIsDeleting(true);
    setChatError('');
    try {
      await apiRequest(`/chat/threads/${conversationId}`, 'DELETE');
      resetConversation();
      router.replace('/dashboard/chat?new=true', { scroll: false });
      refreshConversationList();
    } catch (error: unknown) {
      setChatError(getErrorMessage(error, 'The conversation could not be deleted.'));
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const copyResponse = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopyNotice('Response copied to clipboard.');
      window.setTimeout(() => setCopyNotice(''), 1800);
    } catch {
      setChatError('This browser could not copy the response. Select the text and copy it manually.');
    }
  };

  return (
    <main className={styles.main}>
      <section className={styles.chatContainer} aria-label="AI chat">
        <header className={styles.chatHeader}>
          <div className={styles.headerTitleBlock}>
            <span className={styles.headerEyebrow}>AETHER STUDYOS</span>
            <h1>{conversationTitle}</h1>
          </div>
          <div className={styles.headerActions}>
            {conversationId && !isRenaming && <button type="button" className={styles.iconAction} onClick={() => { setRenameTitle(conversationTitle); setIsRenaming(true); }} aria-label="Rename conversation" title="Rename conversation"><FiFileText /></button>}
            {conversationId && <button type="button" className={`${styles.iconAction} ${styles.dangerAction}`} onClick={() => setIsDeleteDialogOpen(true)} aria-label="Delete conversation" title="Delete conversation"><FiTrash2 /></button>}
            <button type="button" className={styles.newConversationButton} onClick={startNewConversation}><FiPlus /> <span>New chat</span></button>
          </div>
        </header>

        {isRenaming && (
          <form className={styles.renameForm} onSubmit={saveRename}>
            <label htmlFor="conversation-title">Conversation name</label>
            <input id="conversation-title" value={renameTitle} onChange={(event) => setRenameTitle(event.target.value)} maxLength={80} autoFocus />
            <button type="submit" disabled={isSavingConversation || !renameTitle.trim()}>{isSavingConversation ? 'Saving…' : 'Save name'}</button>
            <button type="button" className={styles.cancelRenameButton} onClick={() => setIsRenaming(false)}>Cancel</button>
          </form>
        )}

        <div className={styles.modeHeader}>
          <div className={styles.modeSwitchGroup} role="group" aria-label="Chat mode">
            <button type="button" className={mode === 'GENERAL' ? styles.activeModeBtn : styles.modeBtn} aria-pressed={mode === 'GENERAL'} onClick={() => setMode('GENERAL')}><FiGlobe /> General Chat</button>
            <button type="button" className={mode === 'STUDY' ? styles.activeModeBtn : styles.modeBtn} aria-pressed={mode === 'STUDY'} onClick={() => setMode('STUDY')}><FiBookOpen /> StudyOS Tutor</button>
          </div>
          <p className={styles.modeDescription}>{mode === 'GENERAL' ? 'General AI answers are based on model knowledge.' : 'Tutor answers use indexed documents from your subjects.'}</p>
        </div>

        {mode === 'STUDY' && (
          <div className={styles.studyControls}>
            <label htmlFor="chat-course">Subject</label>
            <select id="chat-course" value={courseId} onChange={(event) => setCourseId(event.target.value)} disabled={!courses.length}>
              <option value="">All subjects</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.name}</option>)}
            </select>
            <span>{courses.length ? 'Choose a subject for indexed materials, or attach a file or image to this chat.' : 'No subjects yet. You can still attach a file or image and ask about it here.'}</span>
          </div>
        )}

        {mode === 'STUDY' && courseId && materials.some((material) => material.courseId === courseId && !material.isIndexed) && (
          <div className={styles.unindexedMaterials}>
            <strong>Files that need preparation</strong>
            {materials.filter((material) => material.courseId === courseId && !material.isIndexed).map((material) => (
              <div key={material.id} className={styles.unindexedMaterialRow}>
                <span title={material.title}>{material.title}</span>
                <button type="button" onClick={() => void indexExistingMaterial(material)} disabled={Boolean(reindexingMaterialId)}>
                  {reindexingMaterialId === material.id ? 'Preparing…' : 'Prepare for Tutor'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={styles.messageStream} aria-live="polite" aria-busy={isLoadingConversation || isLoading}>
          {isLoadingConversation && <div className={styles.conversationSkeleton} role="status" aria-label="Loading conversation"><div className={styles.conversationAiSkeleton} /><div className={styles.conversationUserSkeleton} /><div className={styles.conversationAiSkeleton} /></div>}
          {!isLoadingConversation && loadError && (
            <div className={styles.emptyState} role="alert">
              <FiAlertTriangle />
              <h2>Conversation unavailable</h2>
              <p>{loadError}</p>
              <button type="button" onClick={() => { const id = searchParams.get('threadId'); if (id) void loadConversation(id); }}>Try again</button>
            </div>
          )}
          {!isLoadingConversation && !loadError && messages.length === 0 && (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>{mode === 'STUDY' ? <FiBookOpen /> : <FiMessageSquare />}</div>
              <h2>{mode === 'STUDY' ? 'Study with your course material' : 'What would you like to work on?'}</h2>
              <p>{mode === 'STUDY' ? 'Upload a course document below or ask a question. Answers will clearly show when your sources do not contain enough information.' : 'Ask for an explanation, writing feedback, coding help, or a study plan.'}</p>
            </div>
          )}

          {!isLoadingConversation && messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1;
            return (
              <article key={message.id} className={message.sender === 'USER' ? styles.userMessage : styles.assistantMessage}>
                <div className={styles.messageMeta}>
                  <strong>{message.sender === 'USER' ? 'You' : message.mode === 'STUDY' ? 'StudyOS Tutor' : 'General AI'}</strong>
                  <time dateTime={message.createdAt}>{formatTimePK(message.createdAt)}</time>
                </div>
                {message.sender === 'USER' && message.attachmentName && <div className={styles.filePreview}><FiFileText /><span className={styles.fileName}>{message.attachmentName}</span></div>}
                {message.sender === 'ASSISTANT' && (
                  <div className={message.sourceType === 'GENERAL_AI' ? styles.sourceBannerGeneral : message.sourceType === 'SOURCE_GROUNDED' ? styles.sourceBannerGrounded : styles.sourceBannerInsufficient}>
                    {message.sourceType === 'GENERAL_AI' ? <><FiGlobe /> General AI · Not based on uploaded materials</> : message.sourceType === 'SOURCE_GROUNDED' ? <><FiCheckCircle /> Answer grounded in your indexed materials</> : <><FiAlertTriangle /> Your indexed materials did not contain enough information</>}
                  </div>
                )}
                <MarkdownContent content={message.content} />
                {message.citations.length > 0 && (
                  <div className={styles.citationBox}>
                    <strong>Sources</strong>
                    {message.citations.map((citation, citationIndex) => (
                      <div className={styles.citationItem} key={citation.citationId || citation.chunkId || citationIndex}>
                        <span className={styles.citationIndex}>[{citationIndex + 1}]</span>
                        <span>{citation.fileName}{citation.pageNumber > 0 ? ` · Page ${citation.pageNumber}` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
                {message.sender === 'ASSISTANT' && message.sourceType === 'SOURCE_INSUFFICIENT' && (
                  <button type="button" className={styles.fallbackButton} disabled={isLoading} onClick={() => void sendMessage(latestUserMessage?.content, 'GENERAL')}>
                    <FiGlobe /> Get a general explanation
                  </button>
                )}
                {message.sender === 'ASSISTANT' && (
                  <div className={styles.messageActions}>
                    <button type="button" onClick={() => void copyResponse(message)}><FiCopy /> Copy</button>
                    {message.id === lastAssistantMessageId && <button type="button" disabled={isLoading} onClick={() => void regenerateReply()}><FiRefreshCw /> Regenerate</button>}
                  </div>
                )}
                {message.sender === 'USER' && isLastMessage && chatError && conversationId && (
                  <button type="button" className={styles.retryButton} disabled={isLoading} onClick={() => void regenerateReply(message.content, message.mode)}><FiRefreshCw /> Retry response</button>
                )}
              </article>
            );
          })}
          {isLoading && <div className={styles.thinkingState}><span className={styles.loadingDot} /><span>Preparing your answer…</span></div>}
          <div ref={messagesEndRef} />
        </div>

        {chatError && <div className={styles.chatError} role="alert"><FiAlertTriangle /> <span>{chatError}</span><button type="button" onClick={() => setChatError('')} aria-label="Dismiss message"><FiX /></button></div>}
        {uploadNotice && <div className={styles.uploadNotice} role="status"><FiCheckCircle /> <span>{uploadNotice}</span><button type="button" onClick={() => setUploadNotice('')} aria-label="Dismiss message"><FiX /></button></div>}
        {copyNotice && <div className={styles.copyNotice} role="status"><FiCheck /> {copyNotice}</div>}

        {selectedFile && (
          <div className={styles.filePreview}>
            {selectedFile.type.startsWith('image/') ? <FiImage /> : <FiFileText />}
            <span className={styles.fileName}>{selectedFile.name}</span>
            {mode === 'STUDY' && courseId && !selectedFile.type.startsWith('image/') && <button type="button" className={styles.uploadButton} onClick={() => void uploadMaterial()} disabled={isUploading}>{isUploading ? 'Saving…' : 'Also save to subject'}</button>}
            <button type="button" className={styles.removeFileButton} onClick={() => setSelectedFile(null)} aria-label="Remove selected file"><FiX /></button>
          </div>
        )}

        <form className={styles.inputArea} onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
          <input
            type="file"
            ref={fileInputRef}
            className={styles.hiddenInput}
            accept=".pdf,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) { setSelectedFile(file); setChatError(''); } }}
          />
          <div className={styles.inputWrapper}>
            <button type="button" className={styles.attachBtn} onClick={() => fileInputRef.current?.click()} disabled={isLoading || isLoadingConversation || Boolean(loadError)} aria-label="Attach a file or image" title="Attach a PDF, DOCX, or image"><FiPlus /></button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
              placeholder={mode === 'STUDY' ? 'Ask a question about your course materials…' : 'Message General AI…'}
              maxLength={4000}
              rows={1}
              disabled={isLoading || isLoadingConversation || Boolean(loadError)}
              aria-label="Your message"
            />
            <button type="submit" className={styles.sendBtn} disabled={isLoading || (!input.trim() && !selectedFile) || isLoadingConversation || Boolean(loadError)}>
              {isLoading ? 'Working…' : <><FiSend /> <span>Send</span></>}
            </button>
          </div>
          <p className={styles.inputHint}>{mode === 'STUDY' ? 'Ask about indexed subject files, or attach a PDF, DOCX, or image for this message.' : 'Attach a PDF, DOCX, or image to ask General AI about it.'}</p>
        </form>
      </section>

      {isDeleteDialogOpen && (
        <div className={styles.dialogOverlay} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isDeleting) setIsDeleteDialogOpen(false); }}>
          <section className={styles.deleteDialog} role="dialog" aria-modal="true" aria-labelledby="delete-chat-title">
            <button type="button" className={styles.dialogClose} onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} aria-label="Close dialog"><FiX /></button>
            <div className={styles.dialogIcon}><FiTrash2 /></div>
            <h2 id="delete-chat-title">Delete this conversation?</h2>
            <p>This permanently deletes the conversation and its messages.</p>
            <div className={styles.dialogActions}>
              <button type="button" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>Keep conversation</button>
              <button type="button" className={styles.confirmDeleteButton} onClick={() => void deleteCurrentConversation()} disabled={isDeleting}>{isDeleting ? 'Deleting…' : 'Delete conversation'}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<ChatPageSkeleton />}><ChatWorkspace /></Suspense>;
}
