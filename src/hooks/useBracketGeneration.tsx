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
        type: "foursome", // First round is foursome
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
    console.log("fillFirstRoundMatches called with:", { tournamentId, playersCount: players.length, matchesCount: existingMatches.length });
    console.log("All existing matches:", existingMatches);
    
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
    console.log("Sorted players:", sortedPlayers);
    
    // Get only first round matches for this tournament
    const firstRoundMatches = existingMatches.filter(
      m => m.tournamentId === tournamentId && m.round === "Round 1"
    );
    console.log("First round matches found:", firstRoundMatches);
    console.log("Unique rounds in matches:", [...new Set(existingMatches.map(m => m.round))]);
    
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
    
    // Calculate how many players need to compete in first round vs get free passes
    const maxTournamentPlayers = totalMatches * 2; // e.g., 16 matches = 32 max players
    const freePassPlayers = Math.min(6, Math.max(0, maxTournamentPlayers - totalPlayers));
    const competingPlayers = totalPlayers - freePassPlayers;
    
    // Best handicappers get free passes, worst handicappers compete
    const playersWithFreePasses = sortedPlayers.slice(0, freePassPlayers);
    const playersToCompete = sortedPlayers.slice(freePassPlayers);
    
    console.log(`First round setup: ${totalMatches} total matches, ${totalPlayers} total players`);
    console.log(`Free pass players (${freePassPlayers}):`, playersWithFreePasses.map(p => `${p.name} (${p.handicap})`));
    console.log(`Competing players (${competingPlayers}):`, playersToCompete.length);
    
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
    
    let playerIndex = 0;
    let matchIndex = 0;
    
    // First, fill matches with pairs of competing players
    while (playerIndex < playersToCompete.length - 1 && matchIndex < totalMatches) {
      const targetMatchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[matchIndex].id);
      
      if (targetMatchIndex !== -1) {
        updatedMatches[targetMatchIndex].player1 = {
          name: playersToCompete[playerIndex].name,
          handicap: playersToCompete[playerIndex].handicap
        };
        
        updatedMatches[targetMatchIndex].player2 = {
          name: playersToCompete[playerIndex + 1].name,
          handicap: playersToCompete[playerIndex + 1].handicap
        };
        
        playerIndex += 2;
      }
      matchIndex++;
    }
    
    // If there's one remaining competing player, assign to next match
    if (playerIndex < playersToCompete.length && matchIndex < totalMatches) {
      const targetMatchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[matchIndex].id);
      
      if (targetMatchIndex !== -1) {
        updatedMatches[targetMatchIndex].player1 = {
          name: playersToCompete[playerIndex].name,
          handicap: playersToCompete[playerIndex].handicap
        };
      }
      matchIndex++;
    }
    
    // Fill remaining matches with free pass players (one per match)
    let freePassIndex = 0;
    while (freePassIndex < playersWithFreePasses.length && matchIndex < totalMatches) {
      const targetMatchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[matchIndex].id);
      
      if (targetMatchIndex !== -1) {
        updatedMatches[targetMatchIndex].player1 = {
          name: playersWithFreePasses[freePassIndex].name,
          handicap: playersWithFreePasses[freePassIndex].handicap
        };
      }
      
      freePassIndex++;
      matchIndex++;
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
      description: `${matchesWithTwoPlayers} matches with 2 players, ${matchesWithOnePlayer} matches with free passes.`,
    });

    return updatedMatches;
  };

  return {
    generateTournamentBracket,
    fillFirstRoundMatches
  };
}