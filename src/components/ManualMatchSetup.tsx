import { useState, useEffect } from "react";
import { Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getRoundName, getRoundDisplayName, calculateTotalRounds } from '@/lib/tournamentUtils';

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
        
        // Force create tournament structure on first match assignment
        console.log('🎯 Match updated, triggering save and structure creation');
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
  // Retry function for network errors
  const retryWithBackoff = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        if (attempt === maxRetries || !error.message?.includes('NetworkError')) {
          throw error;
        }
        console.log(`🔄 Retry attempt ${attempt}/${maxRetries} after network error`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000)); // Exponential backoff
      }
    }
  };

  const autoSaveMatch = async (matchSetup: MatchSetup) => {
    try {
      console.log('💾 Auto-saving match:', matchSetup.matchNumber, 'isCompleted:', matchSetup.isCompleted, 'winnerId:', matchSetup.winnerId);
      
      // Create tournament structure if not created yet - check if Round 2 exists
      const round2Matches = await retryWithBackoff(async () => {
        const { data } = await supabase
          .from('matches')
          .select('id')
          .eq('tournament_id', tournamentId)
          .neq('round', 'Round 1')
          .limit(1);
        return data;
      });

      if (!round2Matches || round2Matches.length === 0) {
        console.log('🏗️ Creating tournament structure - no Round 2 matches found');
        await createTournamentStructure();
        setTournamentCreated(true);
      }

      // Check if match already exists in database
      const existingMatch = await retryWithBackoff(async () => {
        const { data } = await supabase
          .from('matches')
          .select('id')
          .eq('tournament_id', tournamentId)
          .eq('round', 'Round 1')
          .eq('tee', matchSetup.matchNumber)
          .maybeSingle();
        return data;
      });

      console.log('🔍 Existing match found:', existingMatch?.id);

      if (existingMatch) {
        // Update existing match with retry
        console.log('📝 Updating existing match with winner_id:', matchSetup.winnerId);
        await retryWithBackoff(async () => {
          const { error } = await supabase
            .from('matches')
            .update({
              status: matchSetup.isCompleted ? "completed" : 
                     (matchSetup.player1Id || matchSetup.player2Id) ? "pending" : "pending",
              winner_id: matchSetup.winnerId || null
            })
            .eq('id', existingMatch.id);

          if (error) throw error;
        });

        console.log('✅ Match updated successfully');

        // Update participants
        await updateMatchParticipants(existingMatch.id, matchSetup);

        // If match is completed, advance winner
        if (matchSetup.isCompleted && matchSetup.winnerId) {
          console.log('🏆 Auto-advancing winner:', matchSetup.winnerId);
          await autoAdvanceWinner(existingMatch.id, matchSetup.winnerId);
        }
      } else {
        // Create new match with retry
        console.log('🆕 Creating new match with winner_id:', matchSetup.winnerId);
        const matchData = {
          tournament_id: tournamentId,
          type: "singles",
          round: "Round 1",
          status: matchSetup.isCompleted ? "completed" : 
                 (matchSetup.player1Id || matchSetup.player2Id) ? "pending" : "pending",
          match_date: new Date().toISOString().split('T')[0],
          match_time: "09:00:00",
          tee: matchSetup.matchNumber,
          winner_id: matchSetup.winnerId || null
        };

        const newMatch = await retryWithBackoff(async () => {
          const { data, error } = await supabase
            .from('matches')
            .insert(matchData)
            .select()
            .single();

          if (error) throw error;
          return data;
        });

        console.log('✅ New match created:', newMatch.id);

        // Add participants
        await updateMatchParticipants(newMatch.id, matchSetup);

        // If match is completed, advance winner
        if (matchSetup.isCompleted && matchSetup.winnerId) {
          console.log('🏆 Auto-advancing winner:', matchSetup.winnerId);
          await autoAdvanceWinner(newMatch.id, matchSetup.winnerId);
        }
      }

      // Trigger bracket refresh
      onMatchesCreated();

      toast({
        title: "Match Saved",
        description: "Match updated successfully.",
        variant: "default"
      });

    } catch (error: any) {
      console.error('💥 Auto-save error:', error);
      toast({
        title: "Save Error",
        description: error.message?.includes('NetworkError') 
          ? "Network connection failed. Please check your internet connection and try again."
          : "Failed to save match updates. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Create the full tournament structure once
  const createTournamentStructure = async () => {
    try {
      console.log('🏗️ Creating tournament structure for', maxPlayers, 'players');
      const totalRounds = calculateTotalRounds(maxPlayers);
      console.log('Total rounds needed:', totalRounds);
      
      // Create subsequent rounds structure (Round 2, Semifinals, Final)
      for (let round = 2; round <= totalRounds; round++) {
        const roundName = getRoundName(round, totalRounds);
        const matchesInRound = Math.pow(2, totalRounds - round);
        console.log(`Creating ${roundName} with ${matchesInRound} matches`);

        for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
          const matchData = {
            tournament_id: tournamentId,
            type: "singles",
            round: roundName,
            status: "pending",
            match_date: new Date().toISOString().split('T')[0],
            match_time: "09:00:00",
            tee: matchIndex + 1
          };

          const { data: matchResult, error: matchError } = await supabase
            .from('matches')
            .insert(matchData)
            .select()
            .single();

          if (matchError) {
            console.error('Error creating match:', matchError);
            throw matchError;
          }
          
          console.log(`✅ Created ${roundName} match ${matchIndex + 1}:`, matchResult.id);
        }
      }

      // Wait a moment for database consistency
      await new Promise(resolve => setTimeout(resolve, 500));

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

      const totalRounds = calculateTotalRounds(maxPlayers);
      
      console.log('Setting up relationships for', totalRounds, 'rounds');
      console.log('Matches by round:', matchesByRound);
      
      // Set up previous match relationships
      for (let round = 2; round <= totalRounds; round++) {
        const roundName = getRoundName(round, totalRounds);
        const currentRoundMatches = matchesByRound[roundName] || [];
        const previousRoundName = getRoundName(round - 1, totalRounds);
        const previousRoundMatches = matchesByRound[previousRoundName] || [];

        console.log(`Setting up ${roundName}: ${currentRoundMatches.length} matches, previous ${previousRoundName}: ${previousRoundMatches.length} matches`);

        // Sort matches by tee number to ensure correct pairing
        currentRoundMatches.sort((a, b) => (a.tee || 0) - (b.tee || 0));
        previousRoundMatches.sort((a, b) => (a.tee || 0) - (b.tee || 0));

        for (let i = 0; i < currentRoundMatches.length; i++) {
          const currentMatch = currentRoundMatches[i];
          const prevMatch1 = previousRoundMatches[i * 2];
          const prevMatch2 = previousRoundMatches[i * 2 + 1];

          console.log(`Match ${i + 1} in ${roundName} gets winners from matches ${prevMatch1?.tee || 'none'} and ${prevMatch2?.tee || 'none'} from ${previousRoundName}`);

          if (prevMatch1 || prevMatch2) {
            const { error } = await supabase
              .from('matches')
              .update({
                previous_match_1_id: prevMatch1?.id || null,
                previous_match_2_id: prevMatch2?.id || null
              })
              .eq('id', currentMatch.id);

            if (error) {
              console.error('Error updating match relationships:', error);
            } else {
              console.log(`✅ Updated ${roundName} match ${currentMatch.tee} with previous matches: ${prevMatch1?.id || 'none'}, ${prevMatch2?.id || 'none'}`);
            }
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
      // First get existing participants to avoid constraint violations
      const { data: existingParticipants } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', matchId);

      // Delete existing participants if any exist
      if (existingParticipants && existingParticipants.length > 0) {
        const { error: deleteError } = await supabase
          .from('match_participants')
          .delete()
          .eq('match_id', matchId);
        
        if (deleteError) {
          console.error('Delete participants error:', deleteError);
          // Continue anyway, we'll handle upserts below
        }
      }

      // Prepare new participants
      const participants = [];
      
      if (matchSetup.player1Id) {
        participants.push({
          match_id: matchId,
          player_id: matchSetup.player1Id,
          position: 1,
          is_placeholder: false,
          placeholder_name: null
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
          position: 2,
          is_placeholder: false,
          placeholder_name: null
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

      // Insert new participants with better error handling
      if (participants.length > 0) {
        for (const participant of participants) {
          const { error: insertError } = await supabase
            .from('match_participants')
            .insert(participant);
          
          if (insertError) {
            // If it's a duplicate key error, try to update instead
            if (insertError.code === '23505') {
              const { error: updateError } = await supabase
                .from('match_participants')
                .update({
                  player_id: participant.player_id,
                  is_placeholder: participant.is_placeholder,
                  placeholder_name: participant.placeholder_name
                })
                .eq('match_id', matchId)
                .eq('position', participant.position);
              
              if (updateError) {
                console.error('Update participant error:', updateError);
              }
            } else {
              throw insertError;
            }
          }
        }
      }
    } catch (error) {
      console.error('Update participants error:', error);
      // Don't throw error to prevent blocking the auto-save flow
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