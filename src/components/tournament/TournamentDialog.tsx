import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BracketGenerator } from '@/lib/bracketGenerator';
import { useAuth } from '@/hooks/useAuth';

interface TournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TournamentFormData {
  name: string;
  type: 'singles' | 'foursome';
  maxPlayers: number;
  startDate: string;
  endDate: string;
}

interface TenantOption {
  id: string;
  name: string;
}

export function TournamentDialog({ open, onOpenChange }: TournamentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState<TournamentFormData>({
    name: '',
    type: 'singles',
    maxPlayers: 16,
    startDate: '',
    endDate: '',
  });
  const [loading, setLoading] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [isSystemAdmin, setIsSystemAdmin] = useState<boolean>(false);

  useEffect(() => {
    if (!open) return;
    const loadTenants = async () => {
      try {
        // Check if user is system admin
        const { data: sysAdmin } = await supabase.rpc('is_system_admin', { _user_id: user?.id });
        setIsSystemAdmin(!!sysAdmin);

        if (sysAdmin) {
          // System admin can view all tenants
          const { data, error } = await supabase.from('tenants').select('id, name').order('name');
          if (error) throw error;
          const opts = (data || []).map((t: any) => ({ id: t.id, name: t.name }));
          setTenants(opts);
          setSelectedTenantId(opts[0]?.id || '');
        } else if (user?.id) {
          // Regular user: only their tenants
          const { data, error } = await supabase.rpc('get_user_tenants', { _user_id: user.id });
          if (error) throw error;
          const opts = (data || []).map((t: any) => ({ id: t.tenant_id, name: t.tenant_name }));
          setTenants(opts);
          setSelectedTenantId(opts[0]?.id || '');
        }
      } catch (e) {
        console.error('Error loading tenants:', e);
        setTenants([]);
        setSelectedTenantId('');
      }
    };
    loadTenants();
  }, [open, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startDate || !formData.endDate || !selectedTenantId) {
      toast({
        title: 'Fehlende Informationen',
        description: 'Bitte füllen Sie alle Pflichtfelder aus und wählen Sie einen Mandanten.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    
    try {
      let tournamentData: any = null;

      if (isSystemAdmin) {
        // Use Edge Function to create with service role as system admin
        const { data, error } = await supabase.functions.invoke('create-tournament', {
          body: {
            name: formData.name,
            type: formData.type,
            max_players: formData.maxPlayers,
            start_date: formData.startDate,
            end_date: formData.endDate,
            registration_status: 'open',
            tenant_id: selectedTenantId,
          },
        });
        if (error) throw error;
        tournamentData = data?.tournament ?? null;
        if (!tournamentData?.id) throw new Error('Turnier konnte nicht erstellt werden.');
      } else {
        // Direct insert respects RLS for tenant organizers/admins
        const { data, error } = await supabase
          .from('tournaments_new')
          .insert({
            name: formData.name,
            type: formData.type,
            max_players: formData.maxPlayers,
            start_date: formData.startDate,
            end_date: formData.endDate,
            registration_status: 'open',
            tenant_id: selectedTenantId,
          })
          .select()
          .single();
        if (error) throw error;
        tournamentData = data;
      }

      // Automatically generate bracket for the new tournament
      const generator = new BracketGenerator();
      await generator.generateBracket(tournamentData.id, {
        id: tournamentData.id,
        type: formData.type,
        max_players: formData.maxPlayers,
        max_rounds: tournamentData.max_rounds,
      });

      toast({
        title: 'Turnier erstellt',
        description: `${formData.name} wurde erfolgreich mit generiertem Bracket erstellt.`,
      });

      // Reset form and close dialog
      setFormData({ name: '', type: 'singles', maxPlayers: 16, startDate: '', endDate: '' });
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({
        title: 'Fehler',
        description: 'Turnier konnte nicht erstellt werden. Bitte prüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turnier erstellen</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tenant">Mandant *</Label>
            <Select value={selectedTenantId} onValueChange={(value) => setSelectedTenantId(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Mandant auswählen" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Turniername *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Frühjahrs-Meisterschaft 2026"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="type">Turnierart</Label>
            <Select value={formData.type} onValueChange={(value: 'singles' | 'foursome') => setFormData({ ...formData, type: value })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Einzel Matchplay</SelectItem>
                <SelectItem value="foursome">Vierer Matchplay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="maxPlayers">Maximum {formData.type === 'singles' ? 'Spieler' : 'Teams'}</Label>
            <Select value={formData.maxPlayers.toString()} onValueChange={(value) => setFormData({ ...formData, maxPlayers: parseInt(value) })}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="16">16</SelectItem>
                <SelectItem value="32">32</SelectItem>
                <SelectItem value="64">64</SelectItem>
                <SelectItem value="128">128</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Startdatum *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="endDate">Enddatum *</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={loading} variant="default">
              {loading ? 'Turnier wird erstellt & Bracket generiert...' : 'Turnier erstellen'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
