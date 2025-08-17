import { UserMenu } from '@/components/UserMenu';
import { useAuth } from '@/hooks/useAuth';

interface AppLayoutProps {
  children: React.ReactNode;
  showUserMenu?: boolean;
}

export function AppLayout({ children, showUserMenu = true }: AppLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {showUserMenu && user && (
        <div className="fixed top-4 right-4 z-50">
          <UserMenu />
        </div>
      )}
      {children}
    </div>
  );
}