import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Building2, Plus, ArrowLeft, Edit, Globe, Mail, Phone, MapPin } from 'lucide-react';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';

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
  updated_at: string;
  user_count?: number;
}

export default function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: ''
  });
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
      fetchTenants();
    }
  }, [isSystemAdmin, systemAdminCheckLoading]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      
      // Fetch tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenantsError) throw tenantsError;

      // Fetch user counts for each tenant
      const tenantsWithCounts = await Promise.all(
        (tenantsData || []).map(async (tenant) => {
          const { count } = await supabase
            .from('user_roles')
            .select('*', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id);
          
          return {
            ...tenant,
            user_count: count || 0
          };
        })
      );

      setTenants(tenantsWithCounts);
    } catch (error: any) {
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

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) {
      toast({
        title: "Fehler",
        description: "Name und Slug sind erforderlich.",
        variant: "destructive"
      });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: formData.description || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          address: formData.address || null,
          website: formData.website || null,
          status: 'active'
        });

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: `Mandant "${formData.name}" wurde erfolgreich erstellt.`,
      });

      resetForm();
      setCreateDialogOpen(false);
      fetchTenants();
    } catch (error: any) {
      console.error('Error creating tenant:', error);
      toast({
        title: "Fehler",
        description: error.message || "Mandant konnte nicht erstellt werden.",
        variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditTenant = (tenant: Tenant) => {
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
    setEditDialogOpen(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant || !formData.name || !formData.slug) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: formData.description || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          address: formData.address || null,
          website: formData.website || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingTenant.id);

      if (error) throw error;

      toast({
        title: "Erfolg",
        description: `Mandant "${formData.name}" wurde erfolgreich aktualisiert.`,
      });

      resetForm();
      setEditingTenant(null);
      setEditDialogOpen(false);
      fetchTenants();
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      toast({
        title: "Fehler",
        description: error.message || "Mandant konnte nicht aktualisiert werden.",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white';
      case 'inactive': return 'bg-gray-500 text-white';
      case 'suspended': return 'bg-red-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'inactive': return 'Inaktiv';
      case 'suspended': return 'Gesperrt';
      default: return status;
    }
  };

  if (systemAdminCheckLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-course pt-20">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center">
            <p>Lade Mandantenverwaltung...</p>
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
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              Mandantenverwaltung
            </h1>
            <p className="text-muted-foreground">Mandanten und Organisationen verwalten</p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuer Mandant
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Neuen Mandanten erstellen</DialogTitle>
                <DialogDescription>
                  Erstellen Sie einen neuen Mandanten für eine Organisation oder Gruppe.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTenant} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="z.B. Golf Club Beispiel"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="z.B. golf-club-beispiel"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Kurze Beschreibung des Mandanten"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact_email">Kontakt E-Mail</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={formData.contact_email}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                      placeholder="kontakt@beispiel.de"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_phone">Telefon</Label>
                    <Input
                      id="contact_phone"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      placeholder="+49 123 456789"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Adresse</Label>
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Straße, PLZ Ort"
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                    placeholder="https://www.beispiel.de"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Erstelle..." : "Mandant erstellen"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Edit Tenant Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Mandant bearbeiten</DialogTitle>
              <DialogDescription>
                Bearbeiten Sie die Daten von {editingTenant?.name}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateTenant} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_name">Name *</Label>
                  <Input
                    id="edit_name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="z.B. Golf Club Beispiel"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_slug">Slug *</Label>
                  <Input
                    id="edit_slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="z.B. golf-club-beispiel"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_description">Beschreibung</Label>
                <Textarea
                  id="edit_description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Kurze Beschreibung des Mandanten"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_email">Kontakt E-Mail</Label>
                  <Input
                    id="edit_contact_email"
                    type="email"
                    value={formData.contact_email}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
                    placeholder="kontakt@beispiel.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_contact_phone">Telefon</Label>
                  <Input
                    id="edit_contact_phone"
                    value={formData.contact_phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_address">Adresse</Label>
                <Textarea
                  id="edit_address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Straße, PLZ Ort"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_website">Website</Label>
                <Input
                  id="edit_website"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                  placeholder="https://www.beispiel.de"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={updating}>
                  {updating ? "Aktualisiere..." : "Mandant aktualisieren"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Mandanten ({tenants.length})
            </CardTitle>
            <CardDescription>
              Alle registrierten Mandanten und Organisationen im System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Erstellt am</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold">{tenant.name}</p>
                        {tenant.description && (
                          <p className="text-sm text-muted-foreground">{tenant.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{tenant.slug}</code>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusBadgeColor(tenant.status)}>
                        {getStatusDisplayName(tenant.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{tenant.user_count}</span>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {tenant.contact_email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3" />
                            <span>{tenant.contact_email}</span>
                          </div>
                        )}
                        {tenant.contact_phone && (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            <span>{tenant.contact_phone}</span>
                          </div>
                        )}
                        {tenant.website && (
                          <div className="flex items-center gap-1 text-sm">
                            <Globe className="h-3 w-3" />
                            <a href={tenant.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              Website
                            </a>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(tenant.created_at).toLocaleDateString('de-DE')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTenant(tenant)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {tenants.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Keine Mandanten gefunden</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}