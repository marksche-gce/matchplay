import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
}

interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  player1_id?: string;
  player2_id?: string;
  team1_id?: string;
  team2_id?: string;
  feeds_to_match_id?: string;
  feeds_to_position?: number;
}

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1_id?: string;
  player2_id?: string;
  player1?: Player;
  player2?: Player;
}

interface AssignParticipantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match;
  tournament: Tournament;
  onAssignmentComplete: () => void;
}

export function AssignParticipantsDialog({
  open,
  onOpenChange,
  match,
  tournament,
  onAssignmentComplete
}: AssignParticipantsDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableParticipants, setAvailableParticipants] = useState<(Player | Team)[]>([]);
  const [participant1Id, setParticipant1Id] = useState<string>('');
  const [participant2Id, setParticipant2Id] = useState<string>('');

  useEffect(() => {
    if (open) {
      fetchAvailableParticipants();
      // Set current assignments if they exist
      if (tournament.type === 'singles') {
        setParticipant1Id(match.player1_id || 'none');
        setParticipant2Id(match.player2_id || 'none');
      } else {
        setParticipant1Id(match.team1_id || 'none');
        setParticipant2Id(match.team2_id || 'none');
      }
    }
  }, [open, match, tournament.type]);

  const fetchAvailableParticipants = async () => {
    try {
      if (tournament.type === 'singles') {
        // Fetch registered players
        const { data: registrations } = await supabase
          .from('tournament_registrations_new')
          .select(`
            player_id,
            player:players_new(*)
          `)
          .eq('tournament_id', tournament.id)
          .not('player_id', 'is', null);

        const players = registrations?.map(reg => reg.player).filter(Boolean) || [];
        // Sort players by handicap (lowest first, highest last)
        const sortedPlayers = players.sort((a, b) => (a.handicap || 0) - (b.handicap || 0));
        setAvailableParticipants(sortedPlayers);
      } else {
        // Fetch registered teams
        const { data: registrations } = await supabase
          .from('tournament_registrations_new')
          .select(`
            team_id,
            team:teams(
              *,
              player1:players_new!teams_player1_id_fkey(*),
              player2:players_new!teams_player2_id_fkey(*)
            )
          `)
          .eq('tournament_id', tournament.id)
          .not('team_id', 'is', null);

        const teams = registrations?.map(reg => reg.team).filter(Boolean) || [];
        // Sort teams by average handicap of their players
        const sortedTeams = teams.sort((a, b) => {
          const avgHandicapA = ((a.player1?.handicap || 0) + (a.player2?.handicap || 0)) / 2;
          const avgHandicapB = ((b.player1?.handicap || 0) + (b.player2?.handicap || 0)) / 2;
          return avgHandicapA - avgHandicapB;
        });
        setAvailableParticipants(sortedTeams);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast({
        title: "Fehler",
        description: "Verfügbare Teilnehmer konnten nicht geladen werden.",
        variant: "destructive",
      });
    }
  };

  const handleAssign = async () => {
    const hasParticipant1 = participant1Id && participant1Id !== 'none';
    const hasParticipant2 = participant2Id && participant2Id !== 'none';
    
    if (!hasParticipant1 && !hasParticipant2) {
      toast({
        title: "Keine Zuweisung",
        description: "Bitte wählen Sie mindestens einen Teilnehmer aus.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const updateData: any = {};
      
      if (tournament.type === 'singles') {
        if (hasParticipant1) updateData.player1_id = participant1Id;
        if (hasParticipant2) updateData.player2_id = participant2Id;
      } else {
        if (hasParticipant1) updateData.team1_id = participant1Id;
        if (hasParticipant2) updateData.team2_id = participant2Id;
      }

      // Update match status based on assignments
      if (hasParticipant1 && hasParticipant2) {
        updateData.status = 'scheduled';
      } else if (hasParticipant1 || hasParticipant2) {
        // Only one participant - automatic bye (winner)
        updateData.status = 'completed';
        
        // Set the winner
        const winnerId = hasParticipant1 ? participant1Id : participant2Id;
        if (tournament.type === 'singles') {
          updateData.winner_player_id = winnerId;
        } else {
          updateData.winner_team_id = winnerId;
        }
      }

      const { error } = await supabase
        .from('matches_new')
        .update(updateData)
        .eq('id', match.id);

      if (error) throw error;

      // If there's a winner (bye scenario), advance them to next round
      if (updateData.status === 'completed' && match.feeds_to_match_id && match.feeds_to_position) {
        const winnerId = hasParticipant1 ? participant1Id : participant2Id;
        const nextRoundUpdate: any = {};
        
        if (tournament.type === 'singles') {
          nextRoundUpdate[`player${match.feeds_to_position}_id`] = winnerId;
        } else {
          nextRoundUpdate[`team${match.feeds_to_position}_id`] = winnerId;
        }
        
        // Check if the receiving match should be marked as scheduled
        const { data: nextMatch } = await supabase
          .from('matches_new')
          .select('*')
          .eq('id', match.feeds_to_match_id)
          .single();

        if (nextMatch) {
          const hasPosition1 = tournament.type === 'singles' ? 
            nextMatch.player1_id || (match.feeds_to_position === 1 ? winnerId : null) :
            nextMatch.team1_id || (match.feeds_to_position === 1 ? winnerId : null);
          
          const hasPosition2 = tournament.type === 'singles' ? 
            nextMatch.player2_id || (match.feeds_to_position === 2 ? winnerId : null) :
            nextMatch.team2_id || (match.feeds_to_position === 2 ? winnerId : null);

          if (hasPosition1 && hasPosition2) {
            nextRoundUpdate.status = 'scheduled';
          }
        }

        await supabase
          .from('matches_new')
          .update(nextRoundUpdate)
          .eq('id', match.feeds_to_match_id);
      }

      const message = updateData.status === 'completed' 
        ? `Teilnehmer zugewiesen und automatisch in die nächste Runde weitergeleitet (Freilos).`
        : `Spielteilnehmer wurden erfolgreich zugewiesen.`;

      toast({
        title: "Teilnehmer zugewiesen",
        description: message,
      });

      onAssignmentComplete();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error assigning participants:', error);
      toast({
        title: "Fehler",
        description: "Teilnehmer konnten nicht zugewiesen werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getParticipantName = (participant: Player | Team) => {
    if (tournament.type === 'singles') {
      const player = participant as Player;
      return `${player.name} (HCP: ${player.handicap || 0})`;
    } else {
      const team = participant as Team;
      const playerNames = [];
      if (team.player1?.name) playerNames.push(team.player1.name);
      if (team.player2?.name) playerNames.push(team.player2.name);
      const avgHandicap = ((team.player1?.handicap || 0) + (team.player2?.handicap || 0)) / 2;
      return `${team.name} (${playerNames.join(' & ')}) - Avg HCP: ${avgHandicap.toFixed(1)}`;
    }
  };

  const getAvailableOptions = (excludeId?: string) => {
    return availableParticipants.filter(p => p.id !== excludeId && p.id !== 'none');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {tournament.type === 'singles' ? (
              <User className="h-5 w-5" />
            ) : (
              <Users className="h-5 w-5" />
            )}
            {tournament.type === 'singles' ? 'Spieler zuweisen' : 'Teams zuweisen'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Teilnehmer zu Spiel {match.match_number} in Runde {match.round_number} zuweisen
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="participant1">
              {tournament.type === 'singles' ? 'Spieler 1' : 'Team 1'}
            </Label>
            <Select value={participant1Id} onValueChange={setParticipant1Id}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`${tournament.type === 'singles' ? 'Spieler' : 'Team'} 1 auswählen`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Zuweisung</SelectItem>
                {getAvailableOptions(participant2Id).map(participant => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {getParticipantName(participant)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="participant2">
              {tournament.type === 'singles' ? 'Spieler 2' : 'Team 2'}
            </Label>
            <Select value={participant2Id} onValueChange={setParticipant2Id}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`${tournament.type === 'singles' ? 'Spieler' : 'Team'} 2 auswählen`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Zuweisung</SelectItem>
                {getAvailableOptions(participant1Id).map(participant => (
                  <SelectItem key={participant.id} value={participant.id}>
                    {getParticipantName(participant)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {availableParticipants.length === 0 && (
            <div className="text-center p-4 bg-warning/10 rounded-lg border border-warning/30">
              <p className="text-sm text-warning">
                Keine {tournament.type === 'singles' ? 'Spieler' : 'Teams'} sind für dieses Turnier registriert.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={loading || availableParticipants.length === 0}
          >
            {loading ? 'Wird zugewiesen...' : 'Teilnehmer zuweisen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}