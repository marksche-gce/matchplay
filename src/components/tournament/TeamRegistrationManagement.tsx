import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Trash2, UserPlus, Save, X, Mail, Edit, ArrowUp, ArrowDown, Filter, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1: Player;
  player2: Player;
  registered_at: string;
}

interface Tournament {
  id: string;
  name: string;
  max_players: number;
  type: 'singles' | 'foursome';
}

interface TeamRegistrationManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  onUpdate?: () => void;
}

export function TeamRegistrationManagement({ 
  open, 
  onOpenChange, 
  tournament,
  onUpdate 
}: TeamRegistrationManagementProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTeam, setNewTeam] = useState({
    teamName: '',
    player1Name: '',
    player1Email: '',
    player1Handicap: 0,
    player2Name: '',
    player2Email: '',
    player2Handicap: 0,
  });
  const [saving, setSaving] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editTeam, setEditTeam] = useState({
    teamName: '',
    player1Name: '',
    player1Email: '',
    player1Handicap: 0,
    player2Name: '',
    player2Email: '',
    player2Handicap: 0,
  });
  const [sortBy, setSortBy] = useState<'handicap' | 'name' | 'date'>('handicap');
  const [manualOrder, setManualOrder] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open && tournament) {
      fetchTeams();
    }
  }, [open, tournament]);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tournament_registrations_new')
        .select(`
          registered_at,
          position,
          teams (
            id,
            name,
            player1:players_new!teams_player1_id_fkey (
              id,
              name,
              email,
              handicap
            ),
            player2:players_new!teams_player2_id_fkey (
              id,
              name,
              email,
              handicap
            )
          )
        `)
        .eq('tournament_id', tournament.id)
        .not('team_id', 'is', null);

      if (error) throw error;

      const formattedTeams = (data || [])
        .filter(reg => reg.teams) // Filter out registrations without team data
        .map(reg => ({
          id: reg.teams.id,
          name: reg.teams.name,
          player1: reg.teams.player1,
          player2: reg.teams.player2,
          registered_at: reg.registered_at,
          position: reg.position,
        }))
        .sort((a, b) => {
          // Sort by position if available, otherwise by average handicap
          if (a.position && b.position) return a.position - b.position;
          if (a.position && !b.position) return -1;
          if (!a.position && b.position) return 1;
          const avgA = (a.player1.handicap + a.player2.handicap) / 2;
          const avgB = (b.player1.handicap + b.player2.handicap) / 2;
          return avgA - avgB;
        });

      setTeams(formattedTeams as Team[]);
      setManualOrder([]); // Reset manual order when data is refreshed
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Teams.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Möchten Sie das Team "${teamName}" wirklich aus dem Turnier entfernen?`)) {
      return;
    }

    try {
      // Delete tournament registration for the team
      const { error: registrationError } = await supabase
        .from('tournament_registrations_new')
        .delete()
        .eq('tournament_id', tournament.id)
        .eq('team_id', teamId);

      if (registrationError) throw registrationError;

      // Delete the team itself
      const { error: teamError } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);

      if (teamError) throw teamError;

      toast({
        title: "Team entfernt",
        description: `Team "${teamName}" wurde erfolgreich aus dem Turnier entfernt.`,
      });

      fetchTeams();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error deleting team:', error);
      toast({
        title: "Löschen fehlgeschlagen",
        description: error.message || "Fehler beim Entfernen des Teams.",
        variant: "destructive",
      });
    }
  };

  const handleAddTeam = async () => {
    if (!newTeam.teamName.trim() || !newTeam.player1Name.trim() || !newTeam.player2Name.trim()) {
      toast({
        title: "Ungültige Eingabe",
        description: "Teamname und beide Spielernamen sind erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Create or get player 1
      const { data: existingPlayer1 } = await supabase
        .from('players_new')
        .select('id')
        .eq('email', newTeam.player1Email)
        .maybeSingle();

      let player1Id = existingPlayer1?.id;

      if (!player1Id) {
        const { data: newPlayer1, error: player1Error } = await supabase
          .from('players_new')
          .insert({
            name: newTeam.player1Name.trim(),
            email: newTeam.player1Email.trim() || null,
            handicap: newTeam.player1Handicap
          })
          .select('id')
          .single();

        if (player1Error) throw player1Error;
        player1Id = newPlayer1.id;
      }

      // Create or get player 2
      const { data: existingPlayer2 } = await supabase
        .from('players_new')
        .select('id')
        .eq('email', newTeam.player2Email)
        .maybeSingle();

      let player2Id = existingPlayer2?.id;

      if (!player2Id) {
        const { data: newPlayer2, error: player2Error } = await supabase
          .from('players_new')
          .insert({
            name: newTeam.player2Name.trim(),
            email: newTeam.player2Email.trim() || null,
            handicap: newTeam.player2Handicap
          })
          .select('id')
          .single();

        if (player2Error) throw player2Error;
        player2Id = newPlayer2.id;
      }

      // Create team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournament.id,
          name: newTeam.teamName.trim(),
          player1_id: player1Id,
          player2_id: player2Id,
        })
        .select()
        .single();

      if (teamError) throw teamError;

      // Register team for tournament
      const { error: registrationError } = await supabase
        .from('tournament_registrations_new')
        .insert({
          tournament_id: tournament.id,
          team_id: teamData.id
        });

      if (registrationError) throw registrationError;

      toast({
        title: "Team hinzugefügt",
        description: `Team "${newTeam.teamName}" wurde erfolgreich zum Turnier hinzugefügt.`,
      });

      setNewTeam({
        teamName: '',
        player1Name: '',
        player1Email: '',
        player1Handicap: 0,
        player2Name: '',
        player2Email: '',
        player2Handicap: 0,
      });
      setShowAddForm(false);
      fetchTeams();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error adding team:', error);
      toast({
        title: "Hinzufügen fehlgeschlagen",
        description: error.message || "Fehler beim Hinzufügen des Teams.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setEditTeam({
      teamName: team.name,
      player1Name: team.player1.name,
      player1Email: team.player1.email || '',
      player1Handicap: team.player1.handicap,
      player2Name: team.player2.name,
      player2Email: team.player2.email || '',
      player2Handicap: team.player2.handicap,
    });
  };

  const handleUpdateTeam = async () => {
    if (!editingTeam || !editTeam.teamName.trim() || !editTeam.player1Name.trim() || !editTeam.player2Name.trim()) {
      toast({
        title: "Ungültige Eingabe",
        description: "Teamname und beide Spielernamen sind erforderlich.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Update team name
      const { error: teamError } = await supabase
        .from('teams')
        .update({
          name: editTeam.teamName.trim()
        })
        .eq('id', editingTeam.id);

      if (teamError) throw teamError;

      // Update player 1
      const { error: player1Error } = await supabase
        .from('players_new')
        .update({
          name: editTeam.player1Name.trim(),
          email: editTeam.player1Email.trim() || null,
          handicap: editTeam.player1Handicap
        })
        .eq('id', editingTeam.player1.id);

      if (player1Error) throw player1Error;

      // Update player 2
      const { error: player2Error } = await supabase
        .from('players_new')
        .update({
          name: editTeam.player2Name.trim(),
          email: editTeam.player2Email.trim() || null,
          handicap: editTeam.player2Handicap
        })
        .eq('id', editingTeam.player2.id);

      if (player2Error) throw player2Error;

      toast({
        title: "Team aktualisiert",
        description: `Team "${editTeam.teamName}" wurde erfolgreich aktualisiert.`,
      });

      setEditingTeam(null);
      setEditTeam({
        teamName: '',
        player1Name: '',
        player1Email: '',
        player1Handicap: 0,
        player2Name: '',
        player2Email: '',
        player2Handicap: 0,
      });
      fetchTeams();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error updating team:', error);
      toast({
        title: "Aktualisierung fehlgeschlagen",
        description: error.message || "Fehler beim Aktualisieren des Teams.",
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

  const getAverageHandicap = (team: Team) => {
    return ((team.player1.handicap + team.player2.handicap) / 2).toFixed(1);
  };

  const getOverallAverageHandicap = () => {
    if (teams.length === 0) return '0.0';
    const total = teams.reduce((sum, team) => {
      return sum + (team.player1.handicap + team.player2.handicap) / 2;
    }, 0);
    return (total / teams.length).toFixed(1);
  };

  const sortedTeams = (() => {
    if (manualOrder.length > 0) {
      // Use manual order if available
      const orderedTeams = manualOrder.map(id => teams.find(team => team.id === id)).filter(Boolean) as Team[];
      const unorderedTeams = teams.filter(team => !manualOrder.includes(team.id));
      return [...orderedTeams, ...unorderedTeams];
    }
    
    // Use automatic sorting
    return [...teams].sort((a, b) => {
      switch (sortBy) {
        case 'handicap':
          const avgA = (a.player1.handicap + a.player2.handicap) / 2;
          const avgB = (b.player1.handicap + b.player2.handicap) / 2;
          return avgA - avgB;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime();
        default:
          return 0;
      }
    });
  })();

  const moveTeam = (index: number, direction: 'up' | 'down') => {
    const currentOrder = sortedTeams.map(team => team.id);
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
      console.log('Saving order for teams:', sortedTeams.map(t => t.id));
      
      const updates = sortedTeams.map((team, index) => ({
        team_id: team.id,
        position: index + 1
      }));

      console.log('Updates to apply:', updates);

      for (const update of updates) {
        console.log(`Updating team ${update.team_id} to position ${update.position}`);
        const { data, error } = await supabase
          .from('tournament_registrations_new')
          .update({ position: update.position })
          .eq('tournament_id', tournament.id)
          .eq('team_id', update.team_id)
          .select();

        if (error) {
          console.error('Error updating team registration:', error);
          throw error;
        }
        console.log('Update result:', data);
      }

      toast({
        title: "Reihenfolge gespeichert",
        description: "Die Teamreihenfolge wurde erfolgreich gespeichert.",
      });

      fetchTeams(); // Reload to show saved positions
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
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Teams verwalten - {tournament.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Statistiken */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Gesamt Teams</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{teams.length}</div>
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
                  {getOverallAverageHandicap()}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Freie Plätze</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">
                  {tournament.max_players - teams.length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aktionen */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Angemeldete Teams</h3>
            <div className="flex gap-2 items-center">
              <div className="flex gap-2 items-center">
                <Filter className="h-4 w-4" />
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Sortierung wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="handicap">Nach Ø Handicap</SelectItem>
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
                disabled={teams.length >= tournament.max_players}
                className="bg-success hover:bg-success/90"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Team hinzufügen
              </Button>
            </div>
          </div>

          {/* Team hinzufügen Form */}
          {showAddForm && (
            <Card className="border-success/20">
              <CardHeader>
                <CardTitle className="text-base">Neues Team hinzufügen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="teamName">Teamname *</Label>
                  <Input
                    id="teamName"
                    value={newTeam.teamName}
                    onChange={(e) => setNewTeam({ ...newTeam, teamName: e.target.value })}
                    placeholder="Teamname"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Spieler 1 */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Spieler 1</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="player1Name">Name *</Label>
                        <Input
                          id="player1Name"
                          value={newTeam.player1Name}
                          onChange={(e) => setNewTeam({ ...newTeam, player1Name: e.target.value })}
                          placeholder="Spielername"
                        />
                      </div>
                      <div>
                        <Label htmlFor="player1Email">E-Mail</Label>
                        <Input
                          id="player1Email"
                          type="email"
                          value={newTeam.player1Email}
                          onChange={(e) => setNewTeam({ ...newTeam, player1Email: e.target.value })}
                          placeholder="E-Mail (optional)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="player1Handicap">Handicap</Label>
                        <Input
                          id="player1Handicap"
                          type="number"
                          step="0.1"
                          value={newTeam.player1Handicap}
                          onChange={(e) => setNewTeam({ ...newTeam, player1Handicap: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spieler 2 */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Spieler 2</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="player2Name">Name *</Label>
                        <Input
                          id="player2Name"
                          value={newTeam.player2Name}
                          onChange={(e) => setNewTeam({ ...newTeam, player2Name: e.target.value })}
                          placeholder="Spielername"
                        />
                      </div>
                      <div>
                        <Label htmlFor="player2Email">E-Mail</Label>
                        <Input
                          id="player2Email"
                          type="email"
                          value={newTeam.player2Email}
                          onChange={(e) => setNewTeam({ ...newTeam, player2Email: e.target.value })}
                          placeholder="E-Mail (optional)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="player2Handicap">Handicap</Label>
                        <Input
                          id="player2Handicap"
                          type="number"
                          step="0.1"
                          value={newTeam.player2Handicap}
                          onChange={(e) => setNewTeam({ ...newTeam, player2Handicap: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleAddTeam} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Team hinzufügen'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Team bearbeiten Form */}
          {editingTeam && (
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">Team bearbeiten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="editTeamName">Teamname *</Label>
                  <Input
                    id="editTeamName"
                    value={editTeam.teamName}
                    onChange={(e) => setEditTeam({ ...editTeam, teamName: e.target.value })}
                    placeholder="Teamname"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Spieler 1 */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Spieler 1</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="editPlayer1Name">Name *</Label>
                        <Input
                          id="editPlayer1Name"
                          value={editTeam.player1Name}
                          onChange={(e) => setEditTeam({ ...editTeam, player1Name: e.target.value })}
                          placeholder="Spielername"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editPlayer1Email">E-Mail</Label>
                        <Input
                          id="editPlayer1Email"
                          type="email"
                          value={editTeam.player1Email}
                          onChange={(e) => setEditTeam({ ...editTeam, player1Email: e.target.value })}
                          placeholder="E-Mail (optional)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editPlayer1Handicap">Handicap</Label>
                        <Input
                          id="editPlayer1Handicap"
                          type="number"
                          step="0.1"
                          value={editTeam.player1Handicap}
                          onChange={(e) => setEditTeam({ ...editTeam, player1Handicap: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Spieler 2 */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Spieler 2</h4>
                    <div className="space-y-2">
                      <div>
                        <Label htmlFor="editPlayer2Name">Name *</Label>
                        <Input
                          id="editPlayer2Name"
                          value={editTeam.player2Name}
                          onChange={(e) => setEditTeam({ ...editTeam, player2Name: e.target.value })}
                          placeholder="Spielername"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editPlayer2Email">E-Mail</Label>
                        <Input
                          id="editPlayer2Email"
                          type="email"
                          value={editTeam.player2Email}
                          onChange={(e) => setEditTeam({ ...editTeam, player2Email: e.target.value })}
                          placeholder="E-Mail (optional)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editPlayer2Handicap">Handicap</Label>
                        <Input
                          id="editPlayer2Handicap"
                          type="number"
                          step="0.1"
                          value={editTeam.player2Handicap}
                          onChange={(e) => setEditTeam({ ...editTeam, player2Handicap: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button onClick={handleUpdateTeam} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Speichern...' : 'Änderungen speichern'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingTeam(null)}>
                    <X className="h-4 w-4 mr-2" />
                    Abbrechen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Teamliste */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : teams.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Keine Teams</h3>
                <p className="text-muted-foreground">
                  Es sind noch keine Teams für dieses Turnier angemeldet.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rang</TableHead>
                    <TableHead>Teamname</TableHead>
                    <TableHead>Spieler 1</TableHead>
                    <TableHead>Spieler 2</TableHead>
                    <TableHead>Ø HCP</TableHead>
                    <TableHead>Anmeldedatum</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedTeams.map((team, index) => (
                    <TableRow key={team.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{index + 1}</Badge>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveTeam(index, 'up')}
                              disabled={index === 0}
                              className="h-6 w-6 p-0"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => moveTeam(index, 'down')}
                              disabled={index === sortedTeams.length - 1}
                              className="h-6 w-6 p-0"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {team.name}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{team.player1.name}</div>
                          {team.player1.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {team.player1.email}
                            </div>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            HCP: {team.player1.handicap}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{team.player2.name}</div>
                          {team.player2.email && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {team.player2.email}
                            </div>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            HCP: {team.player2.handicap}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {getAverageHandicap(team)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(team.registered_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTeam(team)}
                            className="text-primary hover:text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTeam(team.id, team.name)}
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