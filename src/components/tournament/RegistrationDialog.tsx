import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, UserPlus, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
  max_players: number;
}

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  onRegistrationComplete: () => void;
}

interface PlayerFormData {
  name: string;
  email: string;
  handicap: string;
}

interface TeamFormData {
  teamName: string;
  player1Name: string;
  player1Email: string;
  player1Handicap: string;
  player2Name: string;
  player2Email: string;
  player2Handicap: string;
}

export function RegistrationDialog({ 
  open, 
  onOpenChange, 
  tournament,
  onRegistrationComplete 
}: RegistrationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [playerForm, setPlayerForm] = useState<PlayerFormData>({
    name: '',
    email: '',
    handicap: '',
  });
  const [teamForm, setTeamForm] = useState<TeamFormData>({
    teamName: '',
    player1Name: '',
    player1Email: '',
    player1Handicap: '',
    player2Name: '',
    player2Email: '',
    player2Handicap: '',
  });

  const handlePlayerRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!playerForm.name || !playerForm.email || !playerForm.handicap) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // First, create or get the player
      const { data: existingPlayer } = await supabase
        .from('players_new')
        .select('id')
        .eq('email', playerForm.email)
        .single();

      let playerId = existingPlayer?.id;

      if (!playerId) {
        const { data: newPlayer, error: playerError } = await supabase
          .from('players_new')
          .insert({
            name: playerForm.name,
            email: playerForm.email,
            handicap: parseFloat(playerForm.handicap),
          })
          .select('id')
          .single();

        if (playerError) throw playerError;
        playerId = newPlayer.id;
      }

      // Register for tournament
      const { error } = await supabase
        .from('tournament_registrations_new')
        .insert({
          tournament_id: tournament.id,
          player_id: playerId,
        });

      if (error) throw error;

      toast({
        title: "Registration Successful",
        description: `${playerForm.name} has been registered for the tournament.`,
      });

      setPlayerForm({ name: '', email: '', handicap: '' });
      onRegistrationComplete();
      
    } catch (error: any) {
      console.error('Error registering player:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTeamRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamForm.teamName || !teamForm.player1Name || !teamForm.player2Name || 
        !teamForm.player1Email || !teamForm.player2Email || 
        !teamForm.player1Handicap || !teamForm.player2Handicap) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      // Create or get player 1
      const { data: existingPlayer1 } = await supabase
        .from('players_new')
        .select('id')
        .eq('email', teamForm.player1Email)
        .single();

      let player1Id = existingPlayer1?.id;

      if (!player1Id) {
        const { data: newPlayer1, error: player1Error } = await supabase
          .from('players_new')
          .insert({
            name: teamForm.player1Name,
            email: teamForm.player1Email,
            handicap: parseFloat(teamForm.player1Handicap),
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
        .eq('email', teamForm.player2Email)
        .single();

      let player2Id = existingPlayer2?.id;

      if (!player2Id) {
        const { data: newPlayer2, error: player2Error } = await supabase
          .from('players_new')
          .insert({
            name: teamForm.player2Name,
            email: teamForm.player2Email,
            handicap: parseFloat(teamForm.player2Handicap),
          })
          .select('id')
          .single();

        if (player2Error) throw player2Error;
        player2Id = newPlayer2.id;
      }

      // Create team
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({
          tournament_id: tournament.id,
          name: teamForm.teamName,
          player1_id: player1Id,
          player2_id: player2Id,
        })
        .select('id')
        .single();

      if (teamError) throw teamError;

      // Register team for tournament
      const { error } = await supabase
        .from('tournament_registrations_new')
        .insert({
          tournament_id: tournament.id,
          team_id: team.id,
        });

      if (error) throw error;

      toast({
        title: "Team Registration Successful",
        description: `Team ${teamForm.teamName} has been registered for the tournament.`,
      });

      setTeamForm({
        teamName: '',
        player1Name: '',
        player1Email: '',
        player1Handicap: '',
        player2Name: '',
        player2Email: '',
        player2Handicap: '',
      });
      onRegistrationComplete();
      
    } catch (error: any) {
      console.error('Error registering team:', error);
      toast({
        title: "Registration Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      setLoading(true);

      for (const row of jsonData) {
        const name = row.Name || row.name;
        const email = row.Email || row.email;
        const handicap = row.Handicap || row.handicap;

        if (name && email && handicap !== undefined) {
          // Create or get player
          const { data: existingPlayer } = await supabase
            .from('players_new')
            .select('id')
            .eq('email', email)
            .single();

          let playerId = existingPlayer?.id;

          if (!playerId) {
            const { data: newPlayer, error: playerError } = await supabase
              .from('players_new')
              .insert({
                name,
                email,
                handicap: parseFloat(handicap),
              })
              .select('id')
              .single();

            if (!playerError) {
              playerId = newPlayer.id;
            }
          }

          if (playerId) {
            // Register for tournament
            await supabase
              .from('tournament_registrations_new')
              .insert({
                tournament_id: tournament.id,
                player_id: playerId,
              });
          }
        }
      }

      toast({
        title: "Bulk Registration Successful",
        description: `Imported ${jsonData.length} players from Excel file.`,
      });

      onRegistrationComplete();

    } catch (error) {
      console.error('Error importing Excel:', error);
      toast({
        title: "Import Failed",
        description: "Please check your Excel file format.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Register for {tournament.type === 'singles' ? 'Singles' : 'Foursome'} Tournament
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue={tournament.type === 'singles' ? 'player' : 'team'} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="player" disabled={tournament.type === 'foursome'}>
              <UserPlus className="h-4 w-4 mr-2" />
              {tournament.type === 'singles' ? 'Register Player' : 'Individual'}
            </TabsTrigger>
            <TabsTrigger value="team" disabled={tournament.type === 'singles'}>
              <Users className="h-4 w-4 mr-2" />
              Register Team
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </TabsTrigger>
          </TabsList>

          {tournament.type === 'singles' && (
            <TabsContent value="player" className="space-y-4">
              <form onSubmit={handlePlayerRegistration} className="space-y-4">
                <div>
                  <Label htmlFor="playerName">Player Name *</Label>
                  <Input
                    id="playerName"
                    value={playerForm.name}
                    onChange={(e) => setPlayerForm({ ...playerForm, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <Label htmlFor="playerEmail">Email Address *</Label>
                  <Input
                    id="playerEmail"
                    type="email"
                    value={playerForm.email}
                    onChange={(e) => setPlayerForm({ ...playerForm, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="playerHandicap">Handicap *</Label>
                  <Input
                    id="playerHandicap"
                    type="number"
                    step="0.1"
                    value={playerForm.handicap}
                    onChange={(e) => setPlayerForm({ ...playerForm, handicap: e.target.value })}
                    placeholder="18.5"
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary">
                  {loading ? 'Registering...' : 'Register Player'}
                </Button>
              </form>
            </TabsContent>
          )}

          <TabsContent value="team" className="space-y-4">
              <form onSubmit={handleTeamRegistration} className="space-y-4">
                <div>
                  <Label htmlFor="teamName">Team Name *</Label>
                  <Input
                    id="teamName"
                    value={teamForm.teamName}
                    onChange={(e) => setTeamForm({ ...teamForm, teamName: e.target.value })}
                    placeholder="Eagle Squad"
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Player 1
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="player1Name">Name *</Label>
                      <Input
                        id="player1Name"
                        value={teamForm.player1Name}
                        onChange={(e) => setTeamForm({ ...teamForm, player1Name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <Label htmlFor="player1Handicap">Handicap *</Label>
                      <Input
                        id="player1Handicap"
                        type="number"
                        step="0.1"
                        value={teamForm.player1Handicap}
                        onChange={(e) => setTeamForm({ ...teamForm, player1Handicap: e.target.value })}
                        placeholder="18.5"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="player1Email">Email *</Label>
                    <Input
                      id="player1Email"
                      type="email"
                      value={teamForm.player1Email}
                      onChange={(e) => setTeamForm({ ...teamForm, player1Email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Player 2
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="player2Name">Name *</Label>
                      <Input
                        id="player2Name"
                        value={teamForm.player2Name}
                        onChange={(e) => setTeamForm({ ...teamForm, player2Name: e.target.value })}
                        placeholder="Jane Smith"
                      />
                    </div>
                    <div>
                      <Label htmlFor="player2Handicap">Handicap *</Label>
                      <Input
                        id="player2Handicap"
                        type="number"
                        step="0.1"
                        value={teamForm.player2Handicap}
                        onChange={(e) => setTeamForm({ ...teamForm, player2Handicap: e.target.value })}
                        placeholder="14.2"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="player2Email">Email *</Label>
                    <Input
                      id="player2Email"
                      type="email"
                      value={teamForm.player2Email}
                      onChange={(e) => setTeamForm({ ...teamForm, player2Email: e.target.value })}
                      placeholder="jane@example.com"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary">
                  {loading ? 'Registering...' : 'Register Team'}
                </Button>
              </form>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Import Players from Excel</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload an Excel file with columns: Name, Email, Handicap
              </p>
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="max-w-xs mx-auto"
                disabled={loading}
              />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}