import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2, UserPlus, Save, X, Edit, ArrowUp, ArrowDown, Filter, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
  created_at: string;
}

interface Registration {
  id: string;
  player_id: string;
  registered_at: string;
  player: Player;
}

interface Tournament {
  id: string;
  name: string;
  max_players: number;
  type: 'singles' | 'foursome';
}

interface RegistrationManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  onUpdate?: () => void;
}

export function RegistrationManagement({ 
  open, 
  onOpenChange, 
  tournament,
  onUpdate 
}: RegistrationManagementProps) {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    name: '',
    email: '',
    handicap: 0
  });
  const [saving, setSaving] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Registration | null>(null);
  const [editPlayer, setEditPlayer] = useState({
    name: '',
    email: '',
    handicap: 0
  });
  const [sortBy, setSortBy] = useState<'handicap' | 'name' | 'date'>('handicap');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && tournament) {
      fetchRegistrations();
    }
  }, [open, tournament]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_registrations_new')
        .select(`
          id,
          player_id,
          registered_at,
          position,
          player:players_new (
            id,
            name,
            email,
            handicap,
            created_at
          )
        `)
        .eq('tournament_id', tournament.id);

      if (error) throw error;

      const filteredRegistrations = (data || [])
        .filter(reg => reg.player) // Filter out registrations without player data
        .sort((a, b) => {
          // Sort by position if available, otherwise by handicap
          if (a.position && b.position) return a.position - b.position;
          if (a.position && !b.position) return -1;
          if (!a.position && b.position) return 1;
          return (a.player?.handicap || 0) - (b.player?.handicap || 0);
        });

      setRegistrations(filteredRegistrations as Registration[]);
      setManualOrder([]); // Reset manual order when data is refreshed
    } catch (error) {
      console.error('Error fetching registrations:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Anmeldungen.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRegistration = async (registrationId: string, playerName: string) => {
    if (!confirm(`Möchten Sie ${playerName} wirklich aus dem Turnier entfernen?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('tournament_registrations_new')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;

      toast({
        title: "Spieler entfernt",
        description: `${playerName} wurde erfolgreich aus dem Turnier entfernt.`,
      });

      fetchRegistrations();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error deleting registration:', error);
      toast({
        title: "Löschen fehlgeschlagen",
        description: error.message || "Fehler beim Entfernen des Spielers.",
        variant: "destructive",
      });
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayer.name.trim()) {
      toast({
        title: "Ungültige Eingabe",
        description: "Spielername ist erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Erstelle Spieler
      const { data: playerData, error: playerError } = await supabase
        .from('players_new')
        .insert({
          name: newPlayer.name.trim(),
          email: newPlayer.email.trim() || null,
          handicap: newPlayer.handicap
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Registriere Spieler für Turnier
      const { error: registrationError } = await supabase
        .from('tournament_registrations_new')
        .insert({
          tournament_id: tournament.id,
          player_id: playerData.id
        });

      if (registrationError) throw registrationError;

      toast({
        title: "Spieler hinzugefügt",
        description: `${newPlayer.name} wurde erfolgreich zum Turnier hinzugefügt.`,
      });

      setNewPlayer({ name: '', email: '', handicap: 0 });
      setShowAddForm(false);
      fetchRegistrations();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding player:', error);
      toast({
        title: "Hinzufügen fehlgeschlagen",
        description: error.message || "Fehler beim Hinzufügen des Spielers.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditPlayer = (registration: Registration) => {
    setEditingPlayer(registration);
    setEditPlayer({
      name: registration.player?.name || '',
      email: registration.player?.email || '',
      handicap: registration.player?.handicap || 0
    });
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayer || !editPlayer.name.trim()) {
      toast({
        title: "Ungültige Eingabe",
        description: "Spielername ist erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('players_new')
        .update({
          name: editPlayer.name.trim(),
          email: editPlayer.email.trim() || null,
          handicap: editPlayer.handicap
        })
        .eq('id', editingPlayer.player_id);

      if (error) throw error;

      toast({
        title: "Spieler aktualisiert",
        description: `${editPlayer.name} wurde erfolgreich aktualisiert.`,
      });

      setEditingPlayer(null);
      setEditPlayer({ name: '', email: '', handicap: 0 });
      fetchRegistrations();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating player:', error);
      toast({
        title: "Aktualisierung fehlgeschlagen",
        description: error.message || "Fehler beim Aktualisieren des Spielers.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const sortedRegistrations = (() => {
    if (manualOrder.length > 0) {
      // Use manual order if available
      const orderedRegs = manualOrder.map(id => registrations.find(reg => reg.id === id)).filter(Boolean) as Registration[];
      const unorderedRegs = registrations.filter(reg => !manualOrder.includes(reg.id));
      return [...orderedRegs, ...unorderedRegs];
    }
    
    // Use automatic sorting
    return [...registrations].sort((a, b) => {
      switch (sortBy) {
        case 'handicap':
          return (a.player?.handicap || 0) - (b.player?.handicap || 0);
        case 'name':
          return (a.player?.name || '').localeCompare(b.player?.name || '');
        case 'date':
          return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
        default:
          return 0;
      }
    });
  })();

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const currentOrder = sortedRegistrations.map(reg => reg.id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex >= 0 && targetIndex < currentOrder.length) {
      [currentOrder[index], currentOrder[targetIndex]] = [currentOrder[targetIndex], currentOrder[index]];
      setManualOrder(currentOrder);
    }
  };

  const handleSortChange = (newSortBy: 'handicap' | 'name' | 'date') => {
    setSortBy(newSortBy);
    setManualOrder([]); // Reset manual order when changing sort
  };

  const saveOrder = async () => {
    try {
      setSaving(true);
      const updates = sortedRegistrations.map((registration, index) => ({
        id: registration.id,
        position: index + 1
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('tournament_registrations_new')
          .update({ position: update.position })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: "Reihenfolge gespeichert",
        description: "Die Spielerreihenfolge wurde erfolgreich gespeichert.",
      });

      fetchRegistrations(); // Reload to show saved positions
    } catch (error: any) {
      console.error('Error saving order:', error);
      toast({
        title: "Speichern fehlgeschlagen",
        description: error.message || "Fehler beim Speichern der Reihenfolge.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Anmeldungen verwalten - {tournament.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Statistiken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Anmeldungen</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{registrations.length}</div>
                <p className="text-xs text-muted-foreground">
                  von {tournament.max_players} möglich
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Durchschnitt Handicap</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {registrations.length > 0 
                    ? (registrations.reduce((sum, reg) => sum + (reg.player?.handicap || 0), 0) / registrations.length).toFixed(1)
                    : '0.0'
                  }
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Freie Plätze</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {tournament.max_players - registrations.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aktionen */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Angemeldete Spieler</h3>
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4" />
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sortierung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handicap">Nach Handicap</SelectItem>
                    <SelectItem value="name">Alphabetisch</SelectItem>
                    <SelectItem value="date">Nach Anmeldedatum</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={saveOrder}
                  disabled={saving || manualOrder.length === 0}
                  variant="outline"
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {saving ? 'Speichern...' : 'Reihenfolge speichern'}
                </Button>
              </div>
              <Button
                onClick={() => setShowAddForm(true)}
                disabled={registrations.length >= tournament.max_players}
                className="bg-success hover:bg-success/90"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Spieler hinzufügen
              </Button>
            </div>
          </div>

          {/* Spieler hinzufügen Form */}
          {showAddForm && (
            <Card className="border-success/20">
              <CardHeader>
                <CardTitle className="text-base">Neuen Spieler hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="playerName">Name *</Label>
                    <Input
                      id="playerName"
                      value={newPlayer.name}
                      onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                      placeholder="Spielername"
                    />
                  </div>
                  <div>
                    <Label htmlFor="playerEmail">E-Mail</Label>
                    <Input
                      id="playerEmail"
                      type="email"
                      value={newPlayer.email}
                      onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                      placeholder="E-Mail (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="playerHandicap">Handicap</Label>
                    <Input
                      id="playerHandicap"
                      type="number"
                      step="0.1"
                      value={newPlayer.handicap}
                      onChange={(e) => setNewPlayer({ ...newPlayer, handicap: parseFloat(e.target.value) || 0 })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleAddPlayer} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Spieler hinzufügen'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spieler bearbeiten Form */}
          {editingPlayer && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Spieler bearbeiten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="editPlayerName">Name *</Label>
                    <Input
                      id="editPlayerName"
                      value={editPlayer.name}
                      onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })}
                      placeholder="Spielername"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPlayerEmail">E-Mail</Label>
                    <Input
                      id="editPlayerEmail"
                      type="email"
                      value={editPlayer.email}
                      onChange={(e) => setEditPlayer({ ...editPlayer, email: e.target.value })}
                      placeholder="E-Mail (optional)"
                    />
                  </div>
                  <div>
                    <Label htmlFor="editPlayerHandicap">Handicap</Label>
                    <Input
                      id="editPlayerHandicap"
                      type="number"
                      step="0.1"
                      value={editPlayer.handicap}
                      onChange={(e) => setEditPlayer({ ...editPlayer, handicap: parseFloat(e.target.value) || 0 })}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleUpdatePlayer} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Änderungen speichern'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingPlayer(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Spielerliste */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : registrations.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Keine Anmeldungen</h3>
                <p className="text-muted-foreground">
                  Es sind noch keine Spieler für dieses Turnier angemeldet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Handicap</TableHead>
                    <TableHead>Anmeldedatum</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRegistrations.map((registration, index) => (
                    <TableRow key={registration.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => movePlayer(index, 'up')}
                              disabled={index === 0}
                              className="h-6 w-6 p-0"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => movePlayer(index, 'down')}
                              disabled={index === sortedRegistrations.length - 1}
                              className="h-6 w-6 p-0"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {registration.player?.name || 'Unbekannt'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {registration.player?.email || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {registration.player?.handicap?.toFixed(1) || '0.0'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(registration.registered_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditPlayer(registration)}
                            className="text-primary hover:text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteRegistration(registration.id, registration.player?.name || 'Unbekannt')}
                            className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}