import { useState, useEffect } from 'react';
import { Plus, Building2, Users, Settings, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenantContext';

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

interface TenantFormData {
  name: string;
  slug: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
}

export function TenantManagement() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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

  const handleCreateTenant = async () => {
    try {
      // Generate slug from name if not provided
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
          description: "Dieser Slug wird bereits verwendet. Bitte wählen Sie einen anderen.",
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

  const handleUpdateTenant = async () => {
    if (!editingTenant) return;

    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          description: formData.description,
          contact_email: formData.contact_email,
          contact_phone: formData.contact_phone,
          address: formData.address,
          website: formData.website
        })
        .eq('id', editingTenant.id)
        .select()
        .single();

      if (error) throw error;

      setTenants(prev => prev.map(t => t.id === editingTenant.id ? data : t));
      setEditingTenant(null);
      resetForm();
      refreshTenants();

      toast({
        title: "Mandant aktualisiert",
        description: `${formData.name} wurde erfolgreich aktualisiert.`
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast({
        title: "Fehler",
        description: "Mandant konnte nicht aktualisiert werden.",
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
    resetForm();
  };

  if (loading) {
    return <div>Lade Mandanten...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Mandantenverwaltung</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Golfclub-Mandanten und deren Einstellungen
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Neuer Mandant
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tenants.map((tenant) => (
          <Card key={tenant.id}>
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
                {tenant.website && (
                  <div>
                    <span className="font-medium">Website:</span>{' '}
                    <a href={tenant.website} target="_blank" rel="noopener noreferrer" 
                       className="text-primary hover:underline">
                      {tenant.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" onClick={() => openEditDialog(tenant)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
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
              onClick={editingTenant ? handleUpdateTenant : handleCreateTenant}
              disabled={!formData.name}
            >
              {editingTenant ? 'Aktualisieren' : 'Erstellen'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}