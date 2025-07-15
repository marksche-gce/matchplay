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

    // Step 2: Fill matches with players using proper seeding (best vs worst)
    const playersToAssign = [...sortedPlayers];
    let matchIndex = 0;
    
    while (playersToAssign.length >= 2 && matchIndex < firstRoundMatches) {
      const bestPlayer = playersToAssign.shift()!; // Remove first (best handicap)
      const worstPlayer = playersToAssign.pop()!;  // Remove last (worst handicap)
      
      newMatches[matchIndex].player1 = {
        name: bestPlayer.name,
        handicap: bestPlayer.handicap
      };
      newMatches[matchIndex].player2 = {
        name: worstPlayer.name,
        handicap: worstPlayer.handicap
      };
      
      matchIndex++;
    }
    
    // If there's one player left, assign them to the next available match
    if (playersToAssign.length === 1 && matchIndex < firstRoundMatches) {
      newMatches[matchIndex].player1 = {
        name: playersToAssign[0].name,
        handicap: playersToAssign[0].handicap
      };
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

    // Calculate how many players got effective byes (empty first round matches)
    const playersWithMatches = newMatches.filter(m => m.round === "Round 1" && m.player1 && m.player2).length * 2;
    const playersWithByes = sortedPlayers.length - playersWithMatches;

    toast({
      title: "Bracket Generated!",
      description: `Tournament bracket created with ${firstRoundMatches} first-round matches. ${playersWithByes > 0 ? `${playersWithByes} players have effective byes.` : 'No byes needed.'}`,
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

  return {
    generateTournamentBracket
  };
}