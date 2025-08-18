import { useState, useEffect } from 'react';
import { Plus, Building2, Users, Settings, Trash2, Edit, Shield, UserCheck, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenantContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  website?: string;
  status: string;
  created_at: string;
}

interface TenantUser {
  id: string;
  email: string;
  display_name?: string;
  roles: Array<{
    role: string;
    tenant_id: string;
    tenant_name: string;
  }>;
}

interface TenantFormData {
  name: string;
  slug: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
}

export function SystemAdminPanel() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    name: '',
    slug: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: ''
  });
  const [newUserData, setNewUserData] = useState({
    email: '',
    password: '',
    displayName: '',
    role: 'player' as 'tenant_admin' | 'manager' | 'organizer' | 'player'
  });
  const { toast } = useToast();
  const { refreshTenants } = useTenant();

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast({
        title: "Fehler",
        description: "Mandanten konnten nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantUsers = async (tenantId: string) => {
    try {
      // First get user roles for this tenant
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('tenant_id', tenantId);

      if (rolesError) throw rolesError;

      // Then get profiles for these users
      const userIds = userRoles?.map(ur => ur.user_id) || [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get user emails from auth (this requires system admin privileges)
      const users: TenantUser[] = userRoles?.map(userRole => {
        const profile = profiles?.find(p => p.id === userRole.user_id);
        return {
          id: userRole.user_id,
          email: 'Loading...', // Will be loaded separately
          display_name: profile?.display_name,
          roles: [{
            role: userRole.role,
            tenant_id: tenantId,
            tenant_name: selectedTenant?.name || 'Unknown'
          }]
        };
      }) || [];

      setTenantUsers(users);
    } catch (error) {
      console.error('Error fetching tenant users:', error);
      toast({
        title: "Fehler",
        description: "Benutzer konnten nicht geladen werden.",
        variant: "destructive"
      });
    }
  };

  const handleCreateTenant = async () => {
    try {
      const slug = formData.slug || formData.name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          slug,
          description: formData.description,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          address: formData.address,
          website: formData.website
        })
        .select()
        .single();

      if (error) throw error;

      setTenants(prev => [data, ...prev]);
      setShowCreateDialog(false);
      resetForm();
      refreshTenants();

      toast({
        title: "Mandant erstellt",
        description: `${formData.name} wurde erfolgreich erstellt.`
      });
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      
      if (error.code === '23505') {
        toast({
          title: "Slug bereits vergeben",
          description: "Dieser Slug wird bereits verwendet.",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Fehler",
          description: "Mandant konnte nicht erstellt werden.",
          variant: "destructive"
        });
      }
    }
  };

  const handleCreateUser = async () => {
    if (!selectedTenant) return;

    try {
      const { data, error } = await supabase.functions.invoke('create-admin-user', {
        body: {
          email: newUserData.email,
          password: newUserData.password,
          displayName: newUserData.displayName,
          role: newUserData.role,
          tenantId: selectedTenant.id
        }
      });

      if (error) throw error;

      toast({
        title: "Benutzer erstellt",
        description: `${newUserData.displayName} wurde erfolgreich erstellt.`
      });

      setShowUserDialog(false);
      setNewUserData({ email: '', password: '', displayName: '', role: 'player' });
      fetchTenantUsers(selectedTenant.id);
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Fehler",
        description: "Benutzer konnte nicht erstellt werden.",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      contact_email: '',
      contact_phone: '',
      address: '',
      website: ''
    });
  };

  const openEditDialog = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description || '',
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      address: tenant.address || '',
      website: tenant.website || ''
    });
  };

  const closeDialog = () => {
    setShowCreateDialog(false);
    setEditingTenant(null);
    setShowUserDialog(false);
    resetForm();
  };

  const handleTenantClick = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    fetchTenantUsers(tenant.id);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'tenant_admin': return <Crown className="h-4 w-4" />;
      case 'manager': return <UserCheck className="h-4 w-4" />;
      case 'organizer': return <Shield className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin': return 'Mandanten-Admin';
      case 'manager': return 'Manager';
      case 'organizer': return 'Organizer';
      default: return 'Spieler';
    }
  };

  if (loading) {
    return <div>Lade System-Verwaltung...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8" />
            System-Administration
          </h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Mandanten und System-Einstellungen
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Mandant
        </Button>
      </div>

      <Tabs defaultValue="tenants" className="w-full">
        <TabsList>
          <TabsTrigger value="tenants">Mandanten</TabsTrigger>
          <TabsTrigger value="users" disabled={!selectedTenant}>
            Benutzer {selectedTenant && `(${selectedTenant.name})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant) => (
              <Card 
                key={tenant.id} 
                className={`cursor-pointer transition-colors ${
                  selectedTenant?.id === tenant.id ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => handleTenantClick(tenant)}
              >
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      <CardTitle className="text-lg">{tenant.name}</CardTitle>
                    </div>
                    <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                      {tenant.status}
                    </Badge>
                  </div>
                  <CardDescription>{tenant.slug}</CardDescription>
                </CardHeader>
                <CardContent>
                  {tenant.description && (
                    <p className="text-sm text-muted-foreground mb-4">{tenant.description}</p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    {tenant.contact_email && (
                      <div>
                        <span className="font-medium">E-Mail:</span> {tenant.contact_email}
                      </div>
                    )}
                    {tenant.contact_phone && (
                      <div>
                        <span className="font-medium">Telefon:</span> {tenant.contact_phone}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(tenant);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTenantClick(tenant);
                      }}
                    >
                      <Users className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {selectedTenant && (
            <>
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">
                  Benutzer von {selectedTenant.name}
                </h2>
                <Button onClick={() => setShowUserDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Benutzer
                </Button>
              </div>

              <div className="grid gap-4">
                {tenantUsers.map((user) => (
                  <Card key={user.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{user.display_name || user.email}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex gap-2 mt-2">
                            {user.roles.map((role, idx) => (
                              <Badge key={idx} variant="outline" className="flex items-center gap-1">
                                {getRoleIcon(role.role)}
                                {getRoleLabel(role.role)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Tenant Dialog */}
      <Dialog open={showCreateDialog || !!editingTenant} onOpenChange={closeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? 'Mandant bearbeiten' : 'Neuen Mandant erstellen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Golf Club Name"
                />
              </div>
              
              {!editingTenant && (
                <div>
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="golf-club-name"
                  />
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Beschreibung des Golf Clubs"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="contact_email">Kontakt E-Mail</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                  placeholder="info@golfclub.de"
                />
              </div>
              
              <div>
                <Label htmlFor="contact_phone">Telefon</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                  placeholder="+49 123 456789"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Golfplatz Straße 123, 12345 Stadt"
              />
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://www.golfclub.de"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={closeDialog}>
              Abbrechen
            </Button>
            <Button 
              onClick={editingTenant ? () => {} : handleCreateTenant}
              disabled={!formData.name}
            >
              {editingTenant ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={showUserDialog} onOpenChange={setShowUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Benutzer erstellen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="user_email">E-Mail *</Label>
              <Input
                id="user_email"
                type="email"
                value={newUserData.email}
                onChange={(e) => setNewUserData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="benutzer@beispiel.de"
              />
            </div>

            <div>
              <Label htmlFor="user_password">Passwort *</Label>
              <Input
                id="user_password"
                type="password"
                value={newUserData.password}
                onChange={(e) => setNewUserData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Mindestens 6 Zeichen"
              />
            </div>

            <div>
              <Label htmlFor="user_display_name">Anzeigename *</Label>
              <Input
                id="user_display_name"
                value={newUserData.displayName}
                onChange={(e) => setNewUserData(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Max Mustermann"
              />
            </div>

            <div>
              <Label htmlFor="user_role">Rolle *</Label>
              <Select 
                value={newUserData.role} 
                onValueChange={(value) => setNewUserData(prev => ({ ...prev, role: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant_admin">Mandanten-Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="player">Spieler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowUserDialog(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={handleCreateUser}
              disabled={!newUserData.email || !newUserData.password || !newUserData.displayName}
            >
              Erstellen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}