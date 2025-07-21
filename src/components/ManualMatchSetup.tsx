import { useState, useEffect } from "react";
import { Save, Trash2, Users } from "lucide-react";
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
        
        return updated;
      }
      return match;
    }));
  };

  const getPlayerName = (playerId: string | undefined) => {
    if (!playerId) return undefined;
    return players.find(p => p.id === playerId)?.name;
  };

  const saveMatches = async () => {
    try {
      // Calculate tournament structure
      const totalRounds = Math.ceil(Math.log2(maxPlayers));
      const allMatches: any[] = [];

      // Create first round matches
      for (const setup of matchSetups) {
        const matchData = {
          tournament_id: tournamentId,
          type: format === "matchplay" && setup.matchNumber === 1 ? "foursome" : "singles",
          round: "Round 1",
          status: setup.isCompleted ? "completed" : "scheduled",
          match_date: new Date().toISOString().split('T')[0],
          match_time: "09:00:00",
          tee: setup.matchNumber,
          winner_id: setup.winnerId || null
        };

        const { data: matchResult, error: matchError } = await supabase
          .from('matches')
          .insert(matchData)
          .select()
          .single();

        if (matchError) throw matchError;

        allMatches.push(matchResult);

        // Add participants
        const participants = [];
        if (setup.player1Id) {
          participants.push({
            match_id: matchResult.id,
            player_id: setup.player1Id,
            position: 1
          });
        }
        if (setup.player2Id) {
          participants.push({
            match_id: matchResult.id,
            player_id: setup.player2Id,
            position: 2
          });
        }

        if (participants.length > 0) {
          const { error: participantError } = await supabase
            .from('match_participants')
            .insert(participants);

          if (participantError) throw participantError;
        }
      }

      // Create subsequent rounds with proper connections
      let currentRoundMatches = allMatches;
      
      for (let round = 2; round <= totalRounds; round++) {
        const roundName = getRoundName(round, totalRounds);
        const matchesInRound = Math.pow(2, totalRounds - round);
        const roundMatches = [];

        for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
          const prevMatch1 = currentRoundMatches[matchIndex * 2];
          const prevMatch2 = currentRoundMatches[matchIndex * 2 + 1];

          const matchData = {
            tournament_id: tournamentId,
            type: "singles",
            round: roundName,
            status: "scheduled",
            match_date: new Date().toISOString().split('T')[0],
            match_time: "09:00:00",
            tee: matchIndex + 1,
            previous_match_1_id: prevMatch1?.id,
            previous_match_2_id: prevMatch2?.id
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

      toast({
        title: "Tournament Created!",
        description: `Successfully created ${allMatches.length} first round matches and ${currentRoundMatches.length - allMatches.length} subsequent round matches.`,
      });

      onMatchesCreated();
    } catch (error) {
      console.error('Error creating matches:', error);
      toast({
        title: "Error",
        description: "Failed to create tournament matches.",
        variant: "destructive"
      });
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
      return `Auto-completed: ${winner} advances (No opponent)`;
    }
    return "Ready for play";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Manual First Round Setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-3">
          <Button 
            onClick={saveMatches}
            disabled={matchSetups.length === 0}
            className="flex-1"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings & Create Matches
          </Button>
          <Button 
            variant="destructive"
            onClick={deleteAllMatches}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete All Matches
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
                      <div className="text-sm text-muted-foreground bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">
                        Auto-completed
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