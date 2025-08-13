import { useState, useEffect } from "react";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Player {
  id: string;
  name: string;
  handicap: number;
}

interface MatchSetup {
  matchNumber: number;
  player1Id?: string;
  player2Id?: string;
  isCompleted?: boolean;
  winnerId?: string;
}

interface ManualMatchSetupProps {
  tournamentId: string;
  players: Player[];
  maxPlayers: number;
  onMatchesCreated: () => void;
  format: "matchplay" | "strokeplay" | "scramble";
}

export function ManualMatchSetup({
  tournamentId,
  players,
  maxPlayers,
  onMatchesCreated,
  format
}: ManualMatchSetupProps) {
  const [matchSetups, setMatchSetups] = useState<MatchSetup[]>([]);
  const [availablePlayerIds, setAvailablePlayerIds] = useState<Set<string>>(new Set());
  const [tournamentCreated, setTournamentCreated] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    initializeMatches();
  }, [maxPlayers]);

  useEffect(() => {
    updateAvailablePlayers();
  }, [matchSetups, players]);

  const initializeMatches = () => {
    const firstRoundMatches = maxPlayers / 2;
    const initialMatches: MatchSetup[] = [];
    
    for (let i = 1; i <= firstRoundMatches; i++) {
      initialMatches.push({
        matchNumber: i,
        player1Id: undefined,
        player2Id: undefined,
        isCompleted: false
      });
    }
    
    setMatchSetups(initialMatches);
  };

  const updateAvailablePlayers = () => {
    const usedPlayerIds = new Set<string>();
    
    matchSetups.forEach(match => {
      if (match.player1Id) usedPlayerIds.add(match.player1Id);
      if (match.player2Id) usedPlayerIds.add(match.player2Id);
    });
    
    const available = new Set(
      players
        .filter(player => !usedPlayerIds.has(player.id))
        .map(player => player.id)
    );
    
    setAvailablePlayerIds(available);
  };

  const getAvailablePlayersForMatch = (matchNumber: number) => {
    const currentMatch = matchSetups.find(m => m.matchNumber === matchNumber);
    const currentPlayerIds = new Set([currentMatch?.player1Id, currentMatch?.player2Id].filter(Boolean));
    
    // Get all used player IDs across all matches
    const usedPlayerIds = new Set<string>();
    matchSetups.forEach(match => {
      if (match.player1Id) usedPlayerIds.add(match.player1Id);
      if (match.player2Id) usedPlayerIds.add(match.player2Id);
    });
    
    // Return players that are either not used anywhere, or are used in the current match
    return players.filter(player => 
      !usedPlayerIds.has(player.id) || currentPlayerIds.has(player.id)
    );
  };

  const getSortedPlayers = () => {
    return [...players].sort((a, b) => Number(a.handicap) - Number(b.handicap));
  };

  const updateMatch = (matchNumber: number, field: 'player1Id' | 'player2Id', value: string | undefined) => {
    setMatchSetups(prev => prev.map(match => {
      if (match.matchNumber === matchNumber) {
        const updated = { ...match, [field]: value || undefined };
        
        // Auto-complete if only one player and the other is empty
        const hasOnlyOnePlayer = (updated.player1Id && !updated.player2Id) || 
                                 (!updated.player1Id && updated.player2Id);
        
        if (hasOnlyOnePlayer) {
          updated.isCompleted = true;
          updated.winnerId = updated.player1Id || updated.player2Id;
        } else {
          updated.isCompleted = false;
          updated.winnerId = undefined;
        }
        
        // Auto-save this match to database
        autoSaveMatch(updated);
        
        return updated;
      }
      return match;
    }));
  };

  const getPlayerName = (playerId: string | undefined) => {
    if (!playerId) return undefined;
    return players.find(p => p.id === playerId)?.name;
  };

  // Auto-save individual match when it changes
  const autoSaveMatch = async (matchSetup: MatchSetup) => {
    try {
      // Create tournament structure if not created yet
      if (!tournamentCreated) {
        await createTournamentStructure();
        setTournamentCreated(true);
      }

      // Check if match already exists in database
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('tournament_id', tournamentId)
        .eq('round', 'Round 1')
        .eq('tee', matchSetup.matchNumber)
        .maybeSingle();

      if (existingMatch) {
        // Update existing match
        const { error: matchError } = await supabase
          .from('matches')
          .update({
            status: matchSetup.isCompleted ? "completed" : "scheduled",
            winner_id: matchSetup.winnerId || null
          })
          .eq('id', existingMatch.id);

        if (matchError) throw matchError;

        // Update participants
        await updateMatchParticipants(existingMatch.id, matchSetup);

        // If match is completed, advance winner
        if (matchSetup.isCompleted && matchSetup.winnerId) {
          await autoAdvanceWinner(existingMatch.id, matchSetup.winnerId);
        }
      } else {
        // Create new match
        const matchData = {
          tournament_id: tournamentId,
          type: "singles",
          round: "Round 1",
          status: matchSetup.isCompleted ? "completed" : "scheduled",
          match_date: new Date().toISOString().split('T')[0],
          match_time: "09:00:00",
          tee: matchSetup.matchNumber,
          winner_id: matchSetup.winnerId || null
        };

        const { data: newMatch, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        // Add participants
        await updateMatchParticipants(newMatch.id, matchSetup);

        // If match is completed, advance winner
        if (matchSetup.isCompleted && matchSetup.winnerId) {
          await autoAdvanceWinner(newMatch.id, matchSetup.winnerId);
        }
      }

      // Trigger bracket refresh
      onMatchesCreated();

    } catch (error) {
      console.error('Auto-save error:', error);
      toast({
        title: "Save Error",
        description: "Failed to save match automatically.",
        variant: "destructive"
      });
    }
  };

  // Create the full tournament structure once
  const createTournamentStructure = async () => {
    try {
      const totalRounds = Math.ceil(Math.log2(maxPlayers));
      let currentRoundMatches: any[] = [];
      
      // Create subsequent rounds structure
      for (let round = 2; round <= totalRounds; round++) {
        const roundName = getRoundName(round, totalRounds);
        const matchesInRound = Math.pow(2, totalRounds - round);
        const roundMatches = [];

        for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
          const matchData = {
            tournament_id: tournamentId,
            type: "singles",
            round: roundName,
            status: "scheduled",
            match_date: new Date().toISOString().split('T')[0],
            match_time: "09:00:00",
            tee: matchIndex + 1
          };

          const { data: matchResult, error: matchError } = await supabase
            .from('matches')
            .insert(matchData)
            .select()
            .single();

          if (matchError) throw matchError;
          roundMatches.push(matchResult);
        }

        currentRoundMatches = roundMatches;
      }

      // Set up relationships between rounds
      await setupRoundRelationships();

    } catch (error) {
      console.error('Tournament structure creation error:', error);
      throw error;
    }
  };

  // Set up relationships between tournament rounds
  const setupRoundRelationships = async () => {
    try {
      const { data: allMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('tee');

      if (!allMatches) return;

      // Group by round
      const matchesByRound = allMatches.reduce((acc, match) => {
        if (!acc[match.round]) acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
      }, {} as Record<string, any[]>);

      const totalRounds = Math.ceil(Math.log2(maxPlayers));
      
      // Set up previous match relationships
      for (let round = 2; round <= totalRounds; round++) {
        const roundName = getRoundName(round, totalRounds);
        const currentRoundMatches = matchesByRound[roundName] || [];
        const previousRoundName = getRoundName(round - 1, totalRounds);
        const previousRoundMatches = matchesByRound[previousRoundName] || [];

        for (let i = 0; i < currentRoundMatches.length; i++) {
          const currentMatch = currentRoundMatches[i];
          const prevMatch1 = previousRoundMatches[i * 2];
          const prevMatch2 = previousRoundMatches[i * 2 + 1];

          if (prevMatch1 || prevMatch2) {
            await supabase
              .from('matches')
              .update({
                previous_match_1_id: prevMatch1?.id || null,
                previous_match_2_id: prevMatch2?.id || null
              })
              .eq('id', currentMatch.id);
          }
        }
      }
    } catch (error) {
      console.error('Setup relationships error:', error);
    }
  };

  // Update match participants
  const updateMatchParticipants = async (matchId: string, matchSetup: MatchSetup) => {
    try {
      // Delete existing participants
      await supabase
        .from('match_participants')
        .delete()
        .eq('match_id', matchId);

      // Add new participants
      const participants = [];
      
      if (matchSetup.player1Id) {
        participants.push({
          match_id: matchId,
          player_id: matchSetup.player1Id,
          position: 1
        });
      } else {
        participants.push({
          match_id: matchId,
          player_id: null,
          position: 1,
          is_placeholder: true,
          placeholder_name: "No opponent"
        });
      }
      
      if (matchSetup.player2Id) {
        participants.push({
          match_id: matchId,
          player_id: matchSetup.player2Id,
          position: 2
        });
      } else {
        participants.push({
          match_id: matchId,
          player_id: null,
          position: 2,
          is_placeholder: true,
          placeholder_name: "No opponent"
        });
      }

      if (participants.length > 0) {
        const { error } = await supabase
          .from('match_participants')
          .insert(participants);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Update participants error:', error);
      throw error;
    }
  };

  // Auto-advance winner to next round
  const autoAdvanceWinner = async (matchId: string, winnerId: string) => {
    try {
      // Find the next round match
      const { data: nextMatch } = await supabase
        .from('matches')
        .select('*')
        .or(`previous_match_1_id.eq.${matchId},previous_match_2_id.eq.${matchId}`)
        .maybeSingle();

      if (nextMatch) {
        const position = nextMatch.previous_match_1_id === matchId ? 1 : 2;
        
        // Check if participant already exists
        const { data: existingParticipant } = await supabase
          .from('match_participants')
          .select('*')
          .eq('match_id', nextMatch.id)
          .eq('position', position)
          .maybeSingle();

        if (existingParticipant) {
          // Update existing participant
          await supabase
            .from('match_participants')
            .update({
              player_id: winnerId,
              is_placeholder: false,
              placeholder_name: null
            })
            .eq('id', existingParticipant.id);
        } else {
          // Insert new participant
          await supabase
            .from('match_participants')
            .insert({
              match_id: nextMatch.id,
              player_id: winnerId,
              position: position,
              is_placeholder: false
            });
        }

        console.log(`Auto-advanced winner to Round 2, position ${position}`);
      }
    } catch (error) {
      console.error('Auto-advance error:', error);
    }
  };


  const deleteAllMatches = async () => {
    try {
      // Delete match participants first
      const { error: participantError } = await supabase
        .from('match_participants')
        .delete()
        .in('match_id', 
          (await supabase
            .from('matches')
            .select('id')
            .eq('tournament_id', tournamentId)
          ).data?.map(m => m.id) || []
        );

      if (participantError) throw participantError;

      // Delete matches
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournamentId);

      if (matchError) throw matchError;

      // Reset local state
      setMatchSetups([]);
      setTournamentCreated(false);
      initializeMatches();

      toast({
        title: "All Matches Deleted",
        description: "All tournament matches and settings have been removed.",
      });

      onMatchesCreated();
    } catch (error) {
      console.error('Error deleting matches:', error);
      toast({
        title: "Error",
        description: "Failed to delete matches.",
        variant: "destructive"
      });
    }
  };

  const getRoundName = (round: number, totalRounds: number): string => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semifinals";
    if (round === totalRounds - 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  const getMatchStatusText = (match: MatchSetup) => {
    if (match.isCompleted) {
      const winner = getPlayerName(match.winnerId);
      return `Winner: ${winner} (automatically advanced)`;
    }
    if (match.player1Id && match.player2Id) {
      return "Ready for play";
    }
    return "Waiting for player assignment";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Tournament Setup - Assign Players
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Select players for each match. Winners will automatically advance to the next round.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Button 
            variant="destructive"
            onClick={deleteAllMatches}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset Tournament
          </Button>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-4">
            {matchSetups.map(match => {
              const availablePlayers = getAvailablePlayersForMatch(match.matchNumber);
              const player1 = players.find(p => p.id === match.player1Id);
              const player2 = players.find(p => p.id === match.player2Id);
              
              return (
                <Card key={match.matchNumber} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-semibold">Match {match.matchNumber}</Label>
                    {match.isCompleted && (
                      <div className="text-sm text-muted-foreground bg-green-100 dark:bg-green-900 px-2 py-1 rounded">
                        ✓ Winner: {getPlayerName(match.winnerId)}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="space-y-2">
                      <Label>Player 1</Label>
                      <Select 
                        value={match.player1Id || "no-player"} 
                        onValueChange={(value) => updateMatch(match.matchNumber, 'player1Id', value === "no-player" ? undefined : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player 1" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="no-player">No Player</SelectItem>
                          {getAvailablePlayersForMatch(match.matchNumber)
                            .filter(player => player.id !== match.player2Id)
                            .slice()
                            .sort((a, b) => a.handicap - b.handicap)
                            .map(player => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name} (HC: {player.handicap})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Player 2 / Opponent</Label>
                      <Select 
                        value={match.player2Id || "no-opponent"} 
                        onValueChange={(value) => updateMatch(match.matchNumber, 'player2Id', value === "no-opponent" ? undefined : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Player 2" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border z-50">
                          <SelectItem value="no-opponent">No Opponent</SelectItem>
                          {getAvailablePlayersForMatch(match.matchNumber)
                            .filter(player => player.id !== match.player1Id)
                            .slice()
                            .sort((a, b) => a.handicap - b.handicap)
                            .map(player => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name} (HC: {player.handicap})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground">
                    Status: {getMatchStatusText(match)}
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}