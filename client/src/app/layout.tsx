// src/app/layout.tsx
import './globals.css';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import AuthModal from '@/components/features/AuthModal/AuthModal';

export const metadata = {
  title: 'Aether StudyOS',
  description: 'AI Student Success Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <AuthProvider>
             {children}
             <AuthModal />
          </AuthProvider>
         
        </ThemeProvider>
      </body>
    </html>
  );
}