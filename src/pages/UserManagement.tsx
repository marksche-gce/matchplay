import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Shield, Trash2, ArrowLeft } from 'lucide-react';
import { useAdminCheck } from '@/hooks/useAdminCheck';

interface User {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
  role?: 'admin' | 'organizer' | 'player';
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'admin' | 'organizer'>('organizer');
  const [creating, setCreating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin, loading: adminCheckLoading } = useAdminCheck();

  useEffect(() => {
    if (!adminCheckLoading && !isAdmin) {
      toast({
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung, diese Seite zu besuchen.",
        variant: "destructive"
      });
      navigate('/');
      return;
    }

    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin, adminCheckLoading, navigate, toast]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      
      // Get auth.users data via admin API
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      // Fetch profiles separately
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name');

      if (profilesError) throw profilesError;

      // Fetch user roles separately
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine the data
      const combinedUsers: User[] = authUsers.users.map((authUser) => {
        const profile = profiles?.find(p => p.id === authUser.id);
        const roleData = userRoles?.find(r => r.user_id === authUser.id);
        
        return {
          id: authUser.id,
          email: authUser.email || '',
          display_name: profile?.display_name || authUser.user_metadata?.display_name,
          created_at: authUser.created_at,
          role: (roleData?.role as 'admin' | 'organizer' | 'player') || 'player'
        };
      });

      setUsers(combinedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Fehler",
        description: "Benutzer konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserDisplayName) return;

    setCreating(true);
    try {
      // Create user via admin API
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newUserEmail,
        password: newUserPassword,
        user_metadata: {
          display_name: newUserDisplayName
        },
        email_confirm: true
      });

      if (authError) throw authError;

      // Assign role to the new user
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: newUserRole
        });

      if (roleError) throw roleError;

      toast({
        title: "Erfolg",
        description: `Benutzer ${newUserDisplayName} wurde erfolgreich erstellt.`,
      });

      // Reset form and close dialog
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserRole('organizer');
      setCreateUserDialogOpen(false);

      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Möchten Sie den Benutzer ${userEmail} wirklich löschen?`)) {
      return;
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      toast({
        title: "Erfolg",
        description: `Benutzer ${userEmail} wurde gelöscht.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Fehler",
        description: "Benutzer konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'organizer': return 'bg-primary text-primary-foreground';
      case 'player': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'organizer': return 'Manager';
      case 'player': return 'Spieler';
      default: return role;
    }
  };

  if (adminCheckLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-course">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <p>Lade Benutzerverwaltung...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zum Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Benutzerverwaltung
              </h1>
              <p className="text-muted-foreground">Manager und Administratoren verwalten</p>
            </div>
          </div>
          
          <Dialog open={createUserDialogOpen} onOpenChange={setCreateUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Neuer Benutzer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie einen neuen Manager oder Administrator für das System.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Anzeigename *</Label>
                  <Input
                    id="displayName"
                    value={newUserDisplayName}
                    onChange={(e) => setNewUserDisplayName(e.target.value)}
                    placeholder="Max Mustermann"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="max@beispiel.de"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Sicheres Passwort"
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Rolle *</Label>
                  <Select value={newUserRole} onValueChange={(value: 'admin' | 'organizer') => setNewUserRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organizer">Manager</SelectItem>
                      <SelectItem value="admin">Administrator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateUserDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Erstelle..." : "Benutzer erstellen"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              System-Benutzer ({users.length})
            </CardTitle>
            <CardDescription>
              Alle registrierten Manager und Administratoren im System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userData) => (
                  <TableRow key={userData.id}>
                    <TableCell className="font-medium">
                      {userData.display_name || 'Unbekannt'}
                    </TableCell>
                    <TableCell>{userData.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(userData.role || 'player')}>
                        {getRoleDisplayName(userData.role || 'player')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(userData.created_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      {userData.id !== user?.id && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(userData.id, userData.email)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {users.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Benutzer gefunden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}