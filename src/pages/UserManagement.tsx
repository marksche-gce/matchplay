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
import { UserPlus, Users, Shield, Trash2, ArrowLeft, Edit } from 'lucide-react';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';

interface User {
  id: string;
  email: string;
  display_name?: string;
  created_at: string;
  role?: 'system_admin' | 'organizer' | 'tenant_admin' | 'manager' | 'player' | null;
  tenant_name?: string;
  tenant_slug?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createUserDialogOpen, setCreateUserDialogOpen] = useState(false);
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserDisplayName, setNewUserDisplayName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'system_admin' | 'tenant_admin' | 'organizer' | 'manager'>('manager');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<'system_admin' | 'tenant_admin' | 'organizer' | 'manager'>('manager');
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isSystemAdmin, loading: systemAdminCheckLoading } = useSystemAdminCheck();

  useEffect(() => {
    if (!systemAdminCheckLoading && !isSystemAdmin) {
      toast({
        title: "Zugriff verweigert",
        description: "Sie haben keine Berechtigung, diese Seite zu besuchen.",
        variant: "destructive"
      });
      navigate('/');
      return;
    }

    if (isSystemAdmin) {
      fetchUsers();
    }
  }, [isSystemAdmin, systemAdminCheckLoading, navigate, toast]);

  const fetchUsers = async () => {
    try {
      setLoading(true);

      // First get users from edge function
      const { data, error } = await supabase.functions.invoke('list-users');

      if (error) throw error;
      if (!data || !Array.isArray(data.users)) {
        throw new Error('Ungültige Antwort vom Server');
      }

      // Enrich users with tenant information
      const enrichedUsers = await Promise.all(
        data.users.map(async (user: any) => {
          try {
            // Get user's tenant information
            const { data: userRoles, error: roleError } = await supabase
              .from('user_roles')
              .select(`
                role,
                tenants (
                  name,
                  slug
                )
              `)
              .eq('user_id', user.id)
              .limit(1)
              .single();

            return {
              ...user,
              role: userRoles?.role || null,
              tenant_name: userRoles?.tenants?.name || 'Kein Mandant',
              tenant_slug: userRoles?.tenants?.slug || null
            };
          } catch (err) {
            console.error('Error fetching role for user:', user.id, err);
            return {
              ...user,
              role: null,
              tenant_name: 'Kein Mandant',
              tenant_slug: null
            };
          }
        })
      );

      setUsers(enrichedUsers);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnten nicht geladen werden.",
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
      // Use Edge Function to create user with proper admin validation
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserDisplayName,
          role: newUserRole
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Erfolg",
        description: `Benutzer ${newUserDisplayName} wurde erfolgreich erstellt.`,
      });

      // Reset form and close dialog
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserDisplayName('');
      setNewUserRole('manager');
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

  const handleEditUser = (userData: User) => {
    setEditingUser(userData);
    setEditDisplayName(userData.display_name || '');
    setEditRole((userData.role as 'system_admin' | 'tenant_admin' | 'organizer' | 'manager') || 'manager');
    setEditUserDialogOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editDisplayName) return;

    setUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-user', {
        body: {
          userId: editingUser.id,
          displayName: editDisplayName,
          role: editRole
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');

      toast({
        title: "Erfolg",
        description: `Benutzer ${editDisplayName} wurde erfolgreich aktualisiert.`,
      });

      // Reset form and close dialog
      setEditDisplayName('');
      setEditRole('manager');
      setEditingUser(null);
      setEditUserDialogOpen(false);

      // Refresh users list
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Möchten Sie den Benutzer ${userEmail} wirklich löschen?`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unbekannter Fehler');

      toast({
        title: "Erfolg",
        description: `Benutzer ${userEmail} wurde gelöscht.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: "Fehler",
        description: error.message || "Benutzer konnte nicht gelöscht werden.",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-destructive text-destructive-foreground';
      case 'organizer': return 'bg-primary text-primary-foreground';
      case 'manager': return 'bg-blue-500 text-white';
      case 'tenant_admin': return 'bg-purple-500 text-white';
      case 'player': return 'bg-secondary text-secondary-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin': return 'Systemadmin';
      case 'organizer': return 'Organisator';
      case 'manager': return 'Manager';
      case 'tenant_admin': return 'Mandanten-Admin';
      case 'player': return 'Spieler';
      default: return role;
    }
  };

  if (systemAdminCheckLoading || loading) {
  return (
    <div className="min-h-screen bg-gradient-course pt-20">{/* pt-20 to account for fixed header */}
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <p>Lade Benutzerverwaltung...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isSystemAdmin) {
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
              <p className="text-muted-foreground">Systemadministratoren und Manager verwalten</p>
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
                  Erstellen Sie einen neuen Manager oder Systemadministrator für das System.
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
                    placeholder="max@outlook.com"
                    required
                    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
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
                  <Select value={newUserRole} onValueChange={(value: 'system_admin' | 'tenant_admin' | 'organizer' | 'manager') => setNewUserRole(value)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="system_admin">Systemadmin (Vollzugriff)</SelectItem>
                      <SelectItem value="tenant_admin">Mandanten-Admin</SelectItem>
                      <SelectItem value="organizer">Organisator</SelectItem>
                      <SelectItem value="manager">Manager (Turniere verwalten)</SelectItem>
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

        {/* Edit User Dialog */}
        <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Benutzer bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Daten von {editingUser?.email}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editDisplayName">Anzeigename *</Label>
                <Input
                  id="editDisplayName"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Max Mustermann"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Rolle *</Label>
                <Select value={editRole} onValueChange={(value: 'system_admin' | 'tenant_admin' | 'organizer' | 'manager') => setEditRole(value)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="system_admin">Systemadmin (Vollzugriff)</SelectItem>
                    <SelectItem value="tenant_admin">Mandanten-Admin</SelectItem>
                    <SelectItem value="organizer">Organisator</SelectItem>
                    <SelectItem value="manager">Manager (Turniere verwalten)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUserDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? "Aktualisiere..." : "Benutzer aktualisieren"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              System-Benutzer ({users.length})
            </CardTitle>
            <CardDescription>
              Alle registrierten Manager und Systemadministratoren im System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Mandant</TableHead>
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
                      <span className="text-sm text-muted-foreground">
                        {userData.tenant_name || 'Kein Mandant'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(userData.created_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(userData)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {userData.id !== user?.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(userData.id, userData.email)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
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