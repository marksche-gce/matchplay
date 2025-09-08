import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAdminCheck } from '@/hooks/useAdminCheck';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { SetWinnerDialog } from './SetWinnerDialog';
import { AssignParticipantsDialog } from './AssignParticipantsDialog';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
}

interface Match {
  id: string;
  tournament_id: string;
  round_number: number;
  match_number: number;
  status: 'pending' | 'scheduled' | 'completed';
  player1_id?: string;
  player2_id?: string;
  team1_id?: string;
  team2_id?: string;
  winner_player_id?: string;
  winner_team_id?: string;
  feeds_to_match_id?: string;
  feeds_to_position?: number;
}

interface Player {
  id: string;
  name: string;
  email: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1?: Player;
  player2?: Player;
}

interface MatchCardProps {
  match: Match;
  tournament: Tournament;
  onMatchUpdate: () => void;
  embedded?: boolean;
}

export function MatchCard({ match, tournament, onMatchUpdate, embedded = false }: MatchCardProps) {
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  const { isSystemAdmin, loading: systemAdminLoading } = useSystemAdminCheck();
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [winner, setWinner] = useState<Player | Team | null>(null);
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatchData();
  }, [match]);

  const fetchMatchData = async () => {
    try {
      if (tournament.type === 'singles') {
        // Fetch players
        if (match.player1_id) {
          const { data: p1 } = await supabase
            .from('players_new')
            .select('*')
            .eq('id', match.player1_id)
            .single();
          setPlayer1(p1);
        }
        
        if (match.player2_id) {
          const { data: p2 } = await supabase
            .from('players_new')
            .select('*')
            .eq('id', match.player2_id)
            .single();
          setPlayer2(p2);
        }

        // Fetch winner
        if (match.winner_player_id) {
          const { data: winnerData } = await supabase
            .from('players_new')
            .select('*')
            .eq('id', match.winner_player_id)
            .single();
          setWinner(winnerData);
        }
      } else {
        // Fetch teams with players
        if (match.team1_id) {
          const { data: t1 } = await supabase
            .from('teams')
            .select(`
              *,
              player1:players_new!teams_player1_id_fkey(*),
              player2:players_new!teams_player2_id_fkey(*)
            `)
            .eq('id', match.team1_id)
            .single();
          setTeam1(t1);
        }
        
        if (match.team2_id) {
          const { data: t2 } = await supabase
            .from('teams')
            .select(`
              *,
              player1:players_new!teams_player1_id_fkey(*),
              player2:players_new!teams_player2_id_fkey(*)
            `)
            .eq('id', match.team2_id)
            .single();
          setTeam2(t2);
        }

        // Fetch winner team
        if (match.winner_team_id) {
          const { data: winnerData } = await supabase
            .from('teams')
            .select(`
              *,
              player1:players_new!teams_player1_id_fkey(*),
              player2:players_new!teams_player2_id_fkey(*)
            `)
            .eq('id', match.winner_team_id)
            .single();
          setWinner(winnerData);
        }
      }
    } catch (error) {
      console.error('Error fetching match data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success/10 text-success border-success/30';
      case 'scheduled': return 'bg-primary/10 text-primary border-primary/30';
      case 'pending': return 'bg-warning/10 text-warning border-warning/30';
      default: return 'bg-secondary/10 text-secondary-foreground border-secondary/30';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'scheduled': return 'Geplant';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
  };

  const canSetWinner = () => {
    const hasWinner = match.winner_player_id || match.winner_team_id;
    
    // If embedded view: can only set winner once, cannot change existing winners
    if (embedded) {
      if (hasWinner) return false; // Cannot change existing winners in embedded view
      // In embedded view, allow setting winner for scheduled matches with participants
      if (tournament.type === 'singles') {
        return match.status === 'scheduled' && player1 && player2;
      } else {
        return match.status === 'scheduled' && team1 && team2;
      }
    }
    
    // In manager view:
    if (hasWinner) {
      // If match has winner, only admins or system admins can change it (regardless of status)
      return isAdmin || isSystemAdmin;
    } else {
      // If no winner, allow setting for scheduled matches with participants
      if (tournament.type === 'singles') {
        return match.status === 'scheduled' && player1 && player2;
      } else {
        return match.status === 'scheduled' && team1 && team2;
      }
    }
  };

  const canAssignParticipants = () => {
    // If embedded view, don't allow any management
    if (embedded) return false;
    return match.round_number === 1; // Only allow assignment in first round
  };

  const needsParticipants = () => {
    if (tournament.type === 'singles') {
      return !match.player1_id || !match.player2_id;
    } else {
      return !match.team1_id || !match.team2_id;
    }
  };

  const isClickableForAssignment = () => {
    return canAssignParticipants() && needsParticipants();
  };

  const handleCardClick = () => {
    if (isClickableForAssignment()) {
      setShowAssignDialog(true);
    }
  };

  const handleSetWinner = async (winnerId: string) => {
    try {
      const updateData: any = {
        status: 'completed'
      };

      if (tournament.type === 'singles') {
        updateData.winner_player_id = winnerId;
      } else {
        updateData.winner_team_id = winnerId;
      }

      const { error } = await supabase
        .from('matches_new')
        .update(updateData)
        .eq('id', match.id);

      if (error) throw error;

      // If this match feeds into another match, update that match
      if (match.feeds_to_match_id && match.feeds_to_position) {
        const feedsToUpdate: any = {};
        
        if (tournament.type === 'singles') {
          feedsToUpdate[`player${match.feeds_to_position}_id`] = winnerId;
        } else {
          feedsToUpdate[`team${match.feeds_to_position}_id`] = winnerId;
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
            feedsToUpdate.status = 'scheduled';
          }
        }

        await supabase
          .from('matches_new')
          .update(feedsToUpdate)
          .eq('id', match.feeds_to_match_id);
      }

      toast({
         title: "Gewinner gesetzt",
         description: "Das Spielergebnis wurde erfolgreich gespeichert.",
      });

      onMatchUpdate();
      setShowWinnerDialog(false);
      
    } catch (error) {
      console.error('Error setting winner:', error);
      toast({
         title: "Fehler",
         description: "Gewinner konnte nicht gesetzt werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card className="bg-card shadow-card animate-pulse">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card 
        className={`bg-card ${embedded ? 'shadow-sm' : 'shadow-card'} transition-all duration-300 ${
          match.status === 'completed' ? 'ring-1 ring-success/30' : ''
        } ${
          isClickableForAssignment() 
            ? 'cursor-pointer hover:shadow-elevated hover:ring-1 hover:ring-primary/30 border-dashed border-primary/50' 
            : 'hover:shadow-elevated'
        }`}
        onClick={handleCardClick}
      >
        <CardHeader className={embedded ? 'pb-2 p-3' : 'pb-3 p-6'}>
          <div className="flex items-center justify-between">
             <CardTitle className={`${embedded ? 'text-xs' : 'text-sm'}`}>Spiel {match.match_number}</CardTitle>
            <Badge className={`${getStatusColor(match.status)} ${embedded ? 'text-xs px-2 py-1' : ''}`}>
              {getStatusText(match.status)}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className={`pt-0 ${embedded ? 'space-y-2 p-3' : 'space-y-3 p-6'}`}>

          {tournament.type === 'singles' ? (
            <>
              {/* Player 1 */}
              <div className={`${embedded ? 'p-2' : 'p-3'} rounded-lg border ${
                match.winner_player_id === player1?.id ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium text-foreground ${embedded ? 'text-sm' : ''}`}>
                      {player1?.name || 'Unbekannt'}
                      {match.winner_player_id === player1?.id && (
                        <Crown className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'} inline ml-2 text-success`} />
                      )}
                    </p>
                    {player1?.handicap && (
                      <p className="text-xs text-muted-foreground">HCP: {player1.handicap}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className={`text-center text-xs text-muted-foreground ${embedded ? 'py-0' : ''}`}>gegen</div>

              {/* Player 2 */}
              <div className={`${embedded ? 'p-2' : 'p-3'} rounded-lg border ${
                match.winner_player_id === player2?.id ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium text-foreground ${embedded ? 'text-sm' : ''}`}>
                      {player2?.name || 'Unbekannt'}
                      {match.winner_player_id === player2?.id && (
                        <Crown className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'} inline ml-2 text-success`} />
                      )}
                    </p>
                    {player2?.handicap && (
                      <p className="text-xs text-muted-foreground">HCP: {player2.handicap}</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Team 1 */}
              <div className={`${embedded ? 'p-2' : 'p-3'} rounded-lg border ${
                match.winner_team_id === team1?.id ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium text-foreground flex items-center gap-2 ${embedded ? 'text-sm' : ''}`}>
                      <Users className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'}`} />
                      {team1?.name || 'Unbekannt'}
                      {match.winner_team_id === team1?.id && (
                        <Crown className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'} text-success`} />
                      )}
                    </p>
                    {team1?.player1 && team1?.player2 && (
                      <p className="text-xs text-muted-foreground">
                        {team1.player1.name} & {team1.player2.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className={`text-center text-xs text-muted-foreground ${embedded ? 'py-0' : ''}`}>gegen</div>

              {/* Team 2 */}
              <div className={`${embedded ? 'p-2' : 'p-3'} rounded-lg border ${
                match.winner_team_id === team2?.id ? 'bg-success/10 border-success/30' : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-medium text-foreground flex items-center gap-2 ${embedded ? 'text-sm' : ''}`}>
                      <Users className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'}`} />
                      {team2?.name || 'Unbekannt'}
                      {match.winner_team_id === team2?.id && (
                        <Crown className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'} text-success`} />
                      )}
                    </p>
                    {team2?.player1 && team2?.player2 && (
                      <p className="text-xs text-muted-foreground">
                        {team2.player1.name} & {team2.player2.name}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {canSetWinner() && (
            <Button 
              onClick={(e) => {
                e.stopPropagation(); // Prevent card click when clicking button
                setShowWinnerDialog(true);
              }}
              variant="default"
              size={embedded ? "sm" : "sm"}
              className={`w-full ${embedded ? 'text-xs py-1' : ''}`}
            >
              <Trophy className={`${embedded ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
               {!embedded && (match.winner_player_id || match.winner_team_id) ? 'Gewinner ändern' : 'Gewinner setzen'}
            </Button>
          )}

          {match.status === 'completed' && winner && (
            <div className={`text-center ${embedded ? 'p-1.5' : 'p-2'} bg-success/10 rounded-lg border border-success/30`}>
              <p className="text-xs text-success font-medium">
                Gewinner: {(winner as any).name}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <SetWinnerDialog 
        open={showWinnerDialog}
        onOpenChange={setShowWinnerDialog}
        match={match}
        tournament={tournament}
        player1={player1}
        player2={player2}
        team1={team1}
        team2={team2}
        onSetWinner={handleSetWinner}
      />

      <AssignParticipantsDialog
        open={showAssignDialog}
        onOpenChange={setShowAssignDialog}
        match={match}
        tournament={tournament}
        onAssignmentComplete={onMatchUpdate}
      />
    </>
  );
}