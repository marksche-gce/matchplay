import { useToast } from "@/hooks/use-toast";

interface Player {
  id: string;
  name: string;
  handicap: number;
}

interface MatchPlayer {
  name: string;
  handicap: number;
  score?: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  player1?: MatchPlayer;
  player2?: MatchPlayer;
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
  nextMatchId?: string;
  previousMatch1Id?: string;
  previousMatch2Id?: string;
}

export function useBracketGeneration() {
  const { toast } = useToast();

  const generateTournamentBracket = (
    tournamentId: string,
    players: Player[],
    maxPlayers: number
  ): Match[] => {
    if (players.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "At least 2 players are required to generate a bracket.",
        variant: "destructive"
      });
      return [];
    }

    // Sort players by handicap (best handicaps first - lowest values)
    const sortedPlayers = [...players].sort((a, b) => a.handicap - b.handicap);

    // Calculate tournament structure based on max players (always fixed)
    const totalRounds = calculateTotalRounds(maxPlayers);
    const firstRoundMatches = calculateFirstRoundMatches(maxPlayers);
    
    console.log(`Tournament setup: maxPlayers=${maxPlayers}, actualPlayers=${sortedPlayers.length}, firstRoundMatches=${firstRoundMatches}`);
    
    const newMatches: Match[] = [];
    let matchIdCounter = Date.now();
    
    // Step 1: Generate all empty first round matches (maxPlayers/2)
    console.log(`Creating ${firstRoundMatches} first round matches`);
    for (let i = 0; i < firstRoundMatches; i++) {
      const match: Match = {
        id: (matchIdCounter++).toString(),
        tournamentId,
        type: "singles",
        round: "Round 1",
        status: "scheduled",
        date: new Date().toISOString().split('T')[0],
        time: "09:00",
        tee: (i + 1).toString()
      };
      newMatches.push(match);
    }

    // Step 2: Calculate byes and assign players
    // For a 16-player tournament: need 8 players in second round
    // If we have 12 players: 4 best get byes, 8 worst play in first round
    const secondRoundSlots = maxPlayers / 2;
    const byeCount = Math.max(0, secondRoundSlots - (sortedPlayers.length - secondRoundSlots));
    const actualByeCount = Math.min(byeCount, sortedPlayers.length);
    
    // Best players get byes
    const byePlayers = sortedPlayers.slice(0, actualByeCount);
    const firstRoundPlayers = sortedPlayers.slice(actualByeCount);
    
    console.log(`Byes: ${actualByeCount}, First round players: ${firstRoundPlayers.length}`);
    
    // Step 3: Assign first round players to matches (ensure each match gets at least 1 player)
    // Start with worst players and work up, ensuring fair distribution
    for (let i = 0; i < firstRoundPlayers.length; i++) {
      const player = firstRoundPlayers[i];
      const matchIndex = i % firstRoundMatches; // Distribute evenly across matches
      
      if (!newMatches[matchIndex].player1) {
        newMatches[matchIndex].player1 = {
          name: player.name,
          handicap: player.handicap
        };
      } else if (!newMatches[matchIndex].player2) {
        newMatches[matchIndex].player2 = {
          name: player.name,
          handicap: player.handicap
        };
      }
    }

    // Generate subsequent rounds
    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = Math.pow(2, totalRounds - round);
      const roundName = getRoundName(round, totalRounds);

      for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        const match: Match = {
          id: (matchIdCounter++).toString(),
          tournamentId,
          type: "singles",
          round: roundName,
          status: "scheduled",
          date: new Date().toISOString().split('T')[0],
          time: "09:00",
          tee: (matchIndex + 1).toString()
        };

        // Set up connections to previous matches
        const prevRoundMatchIndex1 = matchIndex * 2;
        const prevRoundMatchIndex2 = matchIndex * 2 + 1;
        const prevRoundMatches = newMatches.filter(m => m.round === getRoundName(round - 1, totalRounds));
        
        if (prevRoundMatches[prevRoundMatchIndex1]) {
          match.previousMatch1Id = prevRoundMatches[prevRoundMatchIndex1].id;
        }
        if (prevRoundMatches[prevRoundMatchIndex2]) {
          match.previousMatch2Id = prevRoundMatches[prevRoundMatchIndex2].id;
        }

        newMatches.push(match);
      }
    }

    // Show bye information
    if (actualByeCount > 0) {
      const byePlayerNames = byePlayers.map(p => p.name).join(", ");
      toast({
        title: "Byes Assigned",
        description: `${actualByeCount} best players received byes: ${byePlayerNames}`,
      });
    }

    toast({
      title: "Bracket Generated!",
      description: `Tournament bracket created with ${firstRoundMatches} first-round matches. Each match has at least one player.`,
    });

    return newMatches;
  };

  const calculateFirstRoundMatches = (maxPlayers: number): number => {
    return maxPlayers / 2;
  };

  const calculateTotalRounds = (maxPlayers: number): number => {
    return Math.ceil(Math.log2(maxPlayers));
  };


  const getRoundName = (round: number, totalRounds: number): string => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semifinals";
    if (round === totalRounds - 2) return "Quarterfinals";
    return `Round ${round}`;
  };

  const fillFirstRoundMatches = (
    tournamentId: string,
    players: Player[],
    existingMatches: Match[]
  ): Match[] => {
    if (players.length < 1) {
      toast({
        title: "No Players",
        description: "At least 1 player is required to fill brackets.",
        variant: "destructive"
      });
      return existingMatches;
    }

    // Sort players by handicap (best handicaps first - lowest values)
    const sortedPlayers = [...players].sort((a, b) => a.handicap - b.handicap);
    
    // Get only first round matches for this tournament
    const firstRoundMatches = existingMatches.filter(
      m => m.tournamentId === tournamentId && m.round === "Round 1"
    );
    
    if (firstRoundMatches.length === 0) {
      toast({
        title: "No First Round Matches",
        description: "Generate the bracket structure first.",
        variant: "destructive"
      });
      return existingMatches;
    }

    // Ensure we have enough players for all first round matches
    if (sortedPlayers.length < firstRoundMatches.length) {
      toast({
        title: "Not Enough Players",
        description: `Need at least ${firstRoundMatches.length} players to fill all first round matches. Current: ${sortedPlayers.length}`,
        variant: "destructive"
      });
      return existingMatches;
    }

    // Calculate byes: best players who skip first round entirely
    // We need enough players in first round to fill all matches (at least 1 per match)
    const minPlayersForFirstRound = firstRoundMatches.length;
    const maxPlayersForFirstRound = firstRoundMatches.length * 2;
    
    // If we have more players than can fit in first round, give byes to the best
    let byeCount = 0;
    let firstRoundPlayerCount = sortedPlayers.length;
    
    if (sortedPlayers.length > maxPlayersForFirstRound) {
      byeCount = sortedPlayers.length - maxPlayersForFirstRound;
      firstRoundPlayerCount = maxPlayersForFirstRound;
    }
    
    const byePlayers = sortedPlayers.slice(0, byeCount);
    const firstRoundPlayers = sortedPlayers.slice(byeCount, byeCount + firstRoundPlayerCount);
    
    console.log(`Filling first round: ${firstRoundPlayers.length} players, ${byeCount} byes, ${firstRoundMatches.length} matches`);
    
    // Clear existing players from first round matches
    const updatedMatches = existingMatches.map(match => {
      if (match.tournamentId === tournamentId && match.round === "Round 1") {
        return {
          ...match,
          player1: undefined,
          player2: undefined
        };
      }
      return match;
    });
    
    // Get matches to fill
    const matchesToFill = updatedMatches.filter(
      m => m.tournamentId === tournamentId && m.round === "Round 1"
    );
    
    // CRITICAL: Ensure EVERY match gets at least one player
    // First pass: give each match exactly one player
    for (let i = 0; i < matchesToFill.length; i++) {
      if (i < firstRoundPlayers.length) {
        const player = firstRoundPlayers[i];
        const matchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[i].id);
        if (matchIndex !== -1) {
          updatedMatches[matchIndex].player1 = {
            name: player.name,
            handicap: player.handicap
          };
        }
      }
    }
    
    // Second pass: fill remaining players into matches that still have space
    for (let i = matchesToFill.length; i < firstRoundPlayers.length; i++) {
      const player = firstRoundPlayers[i];
      
      // Find a match that only has player1 but no player2
      const matchIndex = updatedMatches.findIndex(m => 
        m.tournamentId === tournamentId && 
        m.round === "Round 1" && 
        m.player1 && 
        !m.player2
      );
      
      if (matchIndex !== -1) {
        updatedMatches[matchIndex].player2 = {
          name: player.name,
          handicap: player.handicap
        };
      }
    }

    // Verify all matches have at least one player
    const emptyMatches = updatedMatches.filter(m => 
      m.tournamentId === tournamentId && 
      m.round === "Round 1" && 
      !m.player1
    );
    
    if (emptyMatches.length > 0) {
      toast({
        title: "Error",
        description: `${emptyMatches.length} matches still empty. This should not happen.`,
        variant: "destructive"
      });
      return existingMatches;
    }

    // Show bye information
    if (byeCount > 0) {
      const byePlayerNames = byePlayers.map(p => p.name).join(", ");
      toast({
        title: "Byes Assigned",
        description: `${byeCount} best players received byes to second round: ${byePlayerNames}`,
      });
    }

    toast({
      title: "First Round Filled!",
      description: `All ${matchesToFill.length} first-round matches now have at least one player.`,
    });

    return updatedMatches;
  };

  return {
    generateTournamentBracket,
    fillFirstRoundMatches
  };
}