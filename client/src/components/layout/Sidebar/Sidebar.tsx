'use client';

import React, { useState, useEffect } from 'react';
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
  FiMenu, 
  FiX,
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiHelpCircle,
  FiBarChart2,
  FiPlus,
  FiMessageCircle
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
}

export default function Sidebar({ onOpenSetupModal, isSetupCompleted = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [recentChats, setRecentChats] = useState<ChatThreadItem[]>([]);
  const [chatLoading, setChatLoading] = useState(true);

  const mainTools = [
    { label: 'Overview', href: '/dashboard', icon: <FiHome /> },
    { label: 'Assignments', href: '/assignments', icon: <FiCheckSquare /> },
    { label: 'AI Study Tutor', href: '/dashboard/chat', icon: <FiMessageSquare /> },
    { label: 'Semester Planner', href: '/dashboard/planner', icon: <FiCalendar /> },
  ];

  const secondaryTools = [
    { label: 'Quizzes', href: '/dashboard/quizzes', icon: <FiHelpCircle /> },
    { label: 'Analytics', href: '/dashboard/analytics', icon: <FiBarChart2 /> },
  ];

  const fetchRecentChats = async () => {
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
  };

  useEffect(() => {
    setIsMobileOpen(false);
    fetchRecentChats();
  }, [pathname]);

  const handleCreateNewChat = () => {
    router.push('/dashboard/chat?new=true');
  };

  return (
    <>
      <div className={styles.mobileHeader}>
        <Link href="/dashboard" className={styles.brandLogo}>
          Aether <span className={styles.betaBadge}>StudyOS</span>
        </Link>
        <button 
          type="button" 
          className={styles.hamburgerBtn}
          onClick={() => setIsMobileOpen((prev) => !prev)}
        >
          {isMobileOpen ? <FiX /> : <FiMenu />}
        </button>
      </div>

      {isMobileOpen && (
        <div className={styles.mobileBackdrop} onClick={() => setIsMobileOpen(false)} />
      )}

      <aside 
        className={`
          ${styles.sidebar} 
          ${isMobileOpen ? styles.mobileOpen : ''} 
          ${isCollapsed ? styles.collapsed : ''}
        `}
      >
        <div className={styles.brandContainer}>
          <Link href="/dashboard" className={styles.brandLogo}>
            <span className={styles.brandIcon}>A</span>
            {!isCollapsed && (
              <span className={styles.brandText}>
                ether <span className={styles.betaBadge}>StudyOS</span>
              </span>
            )}
          </Link>

          <button 
            type="button" 
            className={styles.collapseToggleBtn}
            onClick={() => setIsCollapsed((prev) => !prev)}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
          </button>
        </div>

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

          {!isCollapsed && (
            <button 
              type="button" 
              className={styles.seeMoreBtn}
              onClick={() => setShowMoreTools((prev) => !prev)}
            >
              <span>{showMoreTools ? 'Show Less Tools' : 'See More Tools'}</span>
              <FiChevronDown className={`${styles.chevron} ${showMoreTools ? styles.rotated : ''}`} />
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
                  setIsMobileOpen(false);
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