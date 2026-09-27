'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/apiClient';
import { 
  FiHome, 
  FiCheckSquare,
  FiMessageSquare, 
  FiCalendar, 
  FiSettings, 
  FiUploadCloud, 
  FiSliders, 
  FiChevronDown,
  FiHelpCircle,
  FiBarChart2,
  FiPlus,
  FiMessageCircle,
  FiBookOpen,
} from 'react-icons/fi';
import styles from './Sidebar.module.css';
import skeletonStyles from '@/styles/skeletons.module.css';

interface ChatThreadItem {
  id: string;
  title: string;
  isStudy: boolean;
}

interface SidebarProps {
  onOpenSetupModal: () => void;
  isSetupCompleted?: boolean;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ onOpenSetupModal, isSetupCompleted = false, isCollapsed, isMobileOpen, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [showMoreTools, setShowMoreTools] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatThreadItem[]>([]);
  const [chatLoading, setChatLoading] = useState(true);

  const mainTools = [
    { label: 'Overview', href: '/dashboard', icon: <FiHome /> },
    { label: 'Assignments', href: '/dashboard/assignments', icon: <FiCheckSquare /> },
    { label: 'Courses', href: '/dashboard/courses', icon: <FiBookOpen /> },
    { label: 'AI Study Tutor', href: '/dashboard/chat', icon: <FiMessageSquare /> },
    { label: 'Semester Planner', href: '/dashboard/planner', icon: <FiCalendar /> },
  ];

  const secondaryTools = [
    { label: 'Quizzes', href: '/dashboard/quizzes', icon: <FiHelpCircle /> },
    { label: 'Analytics', href: '/dashboard/analytics', icon: <FiBarChart2 /> },
  ];

  const fetchRecentChats = useCallback(async () => {
    try {
      setChatLoading(true);
      const res: any = await apiRequest('/chat/threads', 'GET');
      if (res.data?.threads) {
        setRecentChats(res.data.threads);
      }
    } catch (err) {
      console.warn('Recent chats fetch fallback');
    } finally {
      setChatLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecentChats();
  }, [fetchRecentChats]);

  useEffect(() => {
    onCloseMobile();
  }, [pathname, onCloseMobile]);

  const handleCreateNewChat = () => {
    router.push('/dashboard/chat?new=true');
  };

  return (
    <>
      {isMobileOpen && (
        <div className={styles.mobileBackdrop} onClick={onCloseMobile} />
      )}

      <aside 
        className={`
          ${styles.sidebar} 
          ${isMobileOpen ? styles.mobileOpen : ''} 
          ${isCollapsed ? styles.collapsed : ''}
        `}
      >
        <button 
          type="button" 
          onClick={handleCreateNewChat} 
          className={styles.newChatBtn}
          title={isCollapsed ? 'New Chat' : undefined}
        >
          <FiPlus className={styles.navIcon} />
          {!isCollapsed && <span>New Chat</span>}
        </button>

        <nav className={styles.navMenu}>
          {!isCollapsed && <span className={styles.menuTitle}>Core Tools</span>}
          {mainTools.map((item, idx) => {
            const isActive = item.href === '/dashboard' 
              ? pathname === '/dashboard' 
              : pathname.startsWith(item.href);

            return (
              <Link
                key={idx}
                href={item.href}
                className={isActive ? styles.activeNavLink : styles.navLink}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              </Link>
            );
          })}

          {!isCollapsed && !showMoreTools && (
            <button 
              type="button" 
              className={styles.seeMoreBtn}
              onClick={() => setShowMoreTools((prev) => !prev)}
            >
              <span>See More Tools</span>
              <FiChevronDown className={styles.chevron} />
            </button>
          )}

          {(showMoreTools || isCollapsed) && secondaryTools.map((item, idx) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={idx}
                href={item.href}
                className={isActive ? styles.activeNavLink : styles.navLink}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!isCollapsed && <span className={styles.navLabel}>{item.label}</span>}
              </Link>
            );
          })}
          {!isCollapsed && showMoreTools && (
            <button 
              type="button" 
              className={styles.seeMoreBtn}
              onClick={() => setShowMoreTools((prev) => !prev)}
            >
              <span>Show Less Tools</span>
              <FiChevronDown className={`${styles.chevron} ${styles.rotated}`} />
            </button>
          )}

          {/* Recent Chats Section with Skeleton Fallback */}
          {!isCollapsed && (
            <div className={styles.chatsSection}>
              <span className={styles.menuTitle}>Recent Chats</span>
              {chatLoading ? (
                <div className={styles.chatList}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={skeletonStyles.sidebarChatSkeleton}>
                      <div className={`${skeletonStyles.box} ${skeletonStyles.chatSkeletonIcon}`} />
                      <div className={`${skeletonStyles.box} ${skeletonStyles.chatSkeletonText}`} />
                    </div>
                  ))}
                </div>
              ) : recentChats.length > 0 ? (
                <div className={styles.chatList}>
                  {recentChats.slice(0, 5).map((chat) => {
                    const isActive = pathname === `/dashboard/chat` && location.search.includes(chat.id);
                    return (
                      <Link
                        key={chat.id}
                        href={`/dashboard/chat?threadId=${chat.id}`}
                        className={isActive ? styles.activeChatItem : styles.chatItem}
                      >
                        <FiMessageCircle className={styles.chatIcon} />
                        <span className={styles.chatTitle}>{chat.title}</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.noChats}>No previous chats yet.</div>
              )}
            </div>
          )}
        </nav>

        <div className={styles.bottomSection}>
          {!isSetupCompleted && (
            <div className={styles.setupCard}>
              <div className={styles.setupHeader}>
                <FiUploadCloud className={styles.setupIcon} />
                {!isCollapsed && <h4>Workspace Setup</h4>}
              </div>
              <button 
                type="button" 
                onClick={() => {
                  onCloseMobile();
                  onOpenSetupModal();
                }} 
                className={styles.setupBtn}
              >
                <FiSliders />
                {!isCollapsed && <span>Setup Workspace</span>}
              </button>
            </div>
          )}

          <Link 
            href="/dashboard/settings" 
            className={pathname === '/dashboard/settings' ? styles.activeNavLink : styles.navLink}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <span className={styles.navIcon}><FiSettings /></span>
            {!isCollapsed && <span className={styles.navLabel}>Settings</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
