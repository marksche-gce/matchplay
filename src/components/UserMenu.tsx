import { useAuth } from '@/hooks/useAuth';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogOut, User, Shield, Key } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changing, setChanging] = useState(false);

  if (!user) {
    return null;
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Fehler",
        description: "Die neuen Passwörter stimmen nicht überein.",
        variant: "destructive"
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Fehler", 
        description: "Das neue Passwort muss mindestens 6 Zeichen lang sein.",
        variant: "destructive"
      });
      return;
    }

    setChanging(true);
    try {
      // Verify current password by trying to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword
      });

      if (signInError) {
        throw new Error("Das aktuelle Passwort ist falsch.");
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: "Ihr Passwort wurde erfolgreich geändert.",
      });

      // Reset form and close dialog
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordOpen(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: "Fehler",
        description: error.message || "Passwort konnte nicht geändert werden.",
        variant: "destructive"
      });
    } finally {
      setChanging(false);
    }
  };

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => navigate('/user-management')}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Benutzerverwaltung</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
          <Key className="mr-2 h-4 w-4" />
          <span>Passwort ändern</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Abmelden</span>
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
            <DialogDescription>
              Geben Sie Ihr aktuelles Passwort und ein neues Passwort ein.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Aktuelles Passwort *</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Aktuelles Passwort"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Neues Passwort *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Neues Passwort"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Neues Passwort bestätigen *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Neues Passwort bestätigen"
                required
                minLength={6}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setChangePasswordOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={changing}>
                {changing ? "Ändere..." : "Passwort ändern"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}