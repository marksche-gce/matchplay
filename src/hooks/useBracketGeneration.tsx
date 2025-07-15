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
    // Calculate tournament structure based on max players (always fixed)
    const totalRounds = calculateTotalRounds(maxPlayers);
    const firstRoundMatches = calculateFirstRoundMatches(maxPlayers);
    
    console.log(`Tournament setup: maxPlayers=${maxPlayers}, firstRoundMatches=${firstRoundMatches}`);
    
    const newMatches: Match[] = [];
    let matchIdCounter = 0;
    
    // Generate all empty first round matches (maxPlayers/2)
    console.log(`Creating ${firstRoundMatches} empty first round matches`);
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

    toast({
      title: "Bracket Generated!",
      description: `Empty tournament bracket created with ${firstRoundMatches} first-round matches.`,
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

    const totalMatches = firstRoundMatches.length;
    const totalPlayers = sortedPlayers.length;
    
    console.log(`First round setup: ${totalMatches} total matches, ${totalPlayers} total players`);
    
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
    
    // Ensure every bracket gets at least one player
    // First, assign one player to each bracket
    for (let matchIndex = 0; matchIndex < totalMatches && matchIndex < totalPlayers; matchIndex++) {
      const targetMatchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[matchIndex].id);
      
      if (targetMatchIndex !== -1) {
        updatedMatches[targetMatchIndex].player1 = {
          name: sortedPlayers[matchIndex].name,
          handicap: sortedPlayers[matchIndex].handicap
        };
      }
    }
    
    // Now do optimal pairing for remaining players (lowest vs highest handicap)
    if (totalPlayers > totalMatches) {
      const remainingPlayers = sortedPlayers.slice(totalMatches);
      const remainingCount = remainingPlayers.length;
      
      // Start pairing from the end, working backwards to pair with highest handicaps
      for (let i = 0; i < remainingCount; i++) {
        // Find the best match: pair with a bracket that only has one player
        // Prefer pairing with players that have different handicap levels
        let bestMatchIndex = -1;
        let bestHandicapDiff = -1;
        
        for (let matchIndex = 0; matchIndex < totalMatches; matchIndex++) {
          const targetMatchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[matchIndex].id);
          
          if (targetMatchIndex !== -1 && 
              updatedMatches[targetMatchIndex].player1 && 
              !updatedMatches[targetMatchIndex].player2) {
            
            const existingHandicap = updatedMatches[targetMatchIndex].player1!.handicap;
            const newHandicap = remainingPlayers[i].handicap;
            const handicapDiff = Math.abs(existingHandicap - newHandicap);
            
            // Prefer larger handicap differences for better competition
            if (handicapDiff > bestHandicapDiff) {
              bestHandicapDiff = handicapDiff;
              bestMatchIndex = targetMatchIndex;
            }
          }
        }
        
        // Assign the remaining player to the best match found
        if (bestMatchIndex !== -1) {
          updatedMatches[bestMatchIndex].player2 = {
            name: remainingPlayers[i].name,
            handicap: remainingPlayers[i].handicap
          };
        }
      }
    }

    // Count matches with players
    const matchesWithTwoPlayers = updatedMatches.filter(m => 
      m.tournamentId === tournamentId && 
      m.round === "Round 1" && 
      m.player1 && m.player2
    ).length;
    
    const matchesWithOnePlayer = updatedMatches.filter(m => 
      m.tournamentId === tournamentId && 
      m.round === "Round 1" && 
      m.player1 && !m.player2
    ).length;

    toast({
      title: "First Round Filled!",
      description: `${matchesWithTwoPlayers} matches with 2 players, ${matchesWithOnePlayer} matches with 1 player (free pass).`,
    });

    return updatedMatches;
  };

  return {
    generateTournamentBracket,
    fillFirstRoundMatches
  };
}