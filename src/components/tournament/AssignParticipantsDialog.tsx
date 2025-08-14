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
        setAvailableParticipants(players);
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
        setAvailableParticipants(teams);
      }
    } catch (error) {
      console.error('Error fetching participants:', error);
      toast({
        title: "Error",
        description: "Failed to fetch available participants.",
        variant: "destructive",
      });
    }
  };

  const handleAssign = async () => {
    const hasParticipant1 = participant1Id && participant1Id !== 'none';
    const hasParticipant2 = participant2Id && participant2Id !== 'none';
    
    if (!hasParticipant1 && !hasParticipant2) {
      toast({
        title: "No Assignment",
        description: "Please select at least one participant.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const updateData: any = {};
      
      if (tournament.type === 'singles') {
        if (participant1Id && participant1Id !== 'none') updateData.player1_id = participant1Id;
        if (participant2Id && participant2Id !== 'none') updateData.player2_id = participant2Id;
      } else {
        if (participant1Id && participant1Id !== 'none') updateData.team1_id = participant1Id;
        if (participant2Id && participant2Id !== 'none') updateData.team2_id = participant2Id;
      }

      // Update match status based on assignments
      const hasParticipant1 = participant1Id && participant1Id !== 'none';
      const hasParticipant2 = participant2Id && participant2Id !== 'none';
      
      if (hasParticipant1 && hasParticipant2) {
        updateData.status = 'scheduled';
      } else if (hasParticipant1 || hasParticipant2) {
        // One participant assigned - this could be a bye scenario
        updateData.status = 'pending';
      }

      const { error } = await supabase
        .from('matches_new')
        .update(updateData)
        .eq('id', match.id);

      if (error) throw error;

      toast({
        title: "Participants Assigned",
        description: "Match participants have been assigned successfully.",
      });

      onAssignmentComplete();
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error assigning participants:', error);
      toast({
        title: "Error",
        description: "Failed to assign participants. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getParticipantName = (participant: Player | Team) => {
    if (tournament.type === 'singles') {
      return (participant as Player).name;
    } else {
      const team = participant as Team;
      const playerNames = [];
      if (team.player1?.name) playerNames.push(team.player1.name);
      if (team.player2?.name) playerNames.push(team.player2.name);
      return `${team.name} (${playerNames.join(' & ')})`;
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
            Assign {tournament.type === 'singles' ? 'Players' : 'Teams'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign participants to Match {match.match_number} in Round {match.round_number}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="participant1">
              {tournament.type === 'singles' ? 'Player 1' : 'Team 1'}
            </Label>
            <Select value={participant1Id} onValueChange={setParticipant1Id}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`Select ${tournament.type === 'singles' ? 'player' : 'team'} 1`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignment</SelectItem>
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
              {tournament.type === 'singles' ? 'Player 2' : 'Team 2'}
            </Label>
            <Select value={participant2Id} onValueChange={setParticipant2Id}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={`Select ${tournament.type === 'singles' ? 'player' : 'team'} 2`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No assignment</SelectItem>
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
                No {tournament.type === 'singles' ? 'players' : 'teams'} are registered for this tournament.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={loading || availableParticipants.length === 0}
          >
            {loading ? 'Assigning...' : 'Assign Participants'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}