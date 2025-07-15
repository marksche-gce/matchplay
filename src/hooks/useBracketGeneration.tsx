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
    
    // Create proper tournament seeding: lowest handicap vs highest handicap
    // Split players into pairs for seeding
    const totalPlayersForPairing = Math.min(totalPlayers, totalMatches * 2);
    const playersToUse = sortedPlayers.slice(0, totalPlayersForPairing);
    
    // Create seeded pairs: pair lowest handicap with highest handicap
    const seededPairs: Array<{ player1: MatchPlayer; player2?: MatchPlayer }> = [];
    
    if (playersToUse.length <= totalMatches) {
      // Fewer players than matches - each player gets their own match (bye rounds)
      playersToUse.forEach(player => {
        seededPairs.push({ 
          player1: { name: player.name, handicap: player.handicap } 
        });
      });
    } else {
      // More players than matches - create proper seeding pairs
      const lowHandicapPlayers = playersToUse.slice(0, Math.ceil(playersToUse.length / 2));
      const highHandicapPlayers = playersToUse.slice(Math.ceil(playersToUse.length / 2)).reverse(); // Reverse to start with highest
      
      // Pair each low handicap player with a high handicap player
      for (let i = 0; i < Math.min(totalMatches, lowHandicapPlayers.length); i++) {
        const pair = {
          player1: { name: lowHandicapPlayers[i].name, handicap: lowHandicapPlayers[i].handicap },
          player2: highHandicapPlayers[i] ? { 
            name: highHandicapPlayers[i].name, 
            handicap: highHandicapPlayers[i].handicap 
          } : undefined
        };
        seededPairs.push(pair);
      }
    }
    
    // Assign seeded pairs to matches
    for (let i = 0; i < Math.min(totalMatches, seededPairs.length); i++) {
      const matchIndex = updatedMatches.findIndex(m => m.id === matchesToFill[i].id);
      
      if (matchIndex !== -1) {
        updatedMatches[matchIndex].player1 = seededPairs[i].player1;
        updatedMatches[matchIndex].player2 = seededPairs[i].player2;
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