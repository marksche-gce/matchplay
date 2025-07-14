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

    // Calculate first round matches based on tournament size
    const firstRoundMatches = calculateFirstRoundMatches(maxPlayers);
    const totalRounds = calculateTotalRounds(maxPlayers);

    // Determine which players get byes
    const { matchPlayers, byePlayers } = assignByes(sortedPlayers, firstRoundMatches);

    const newMatches: Match[] = [];
    let matchIdCounter = Date.now();

    // Generate first round matches
    for (let i = 0; i < firstRoundMatches; i++) {
      const player1Index = i * 2;
      const player2Index = i * 2 + 1;

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

      // Assign players to match
      if (player1Index < matchPlayers.length) {
        match.player1 = {
          name: matchPlayers[player1Index].name,
          handicap: matchPlayers[player1Index].handicap
        };
      }
      if (player2Index < matchPlayers.length) {
        match.player2 = {
          name: matchPlayers[player2Index].name,
          handicap: matchPlayers[player2Index].handicap
        };
      }

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
        if (round === 2) {
          // Second round connects to first round matches and bye players
          const prevMatchIndex1 = matchIndex * 2;
          const prevMatchIndex2 = matchIndex * 2 + 1;
          
          if (prevMatchIndex1 < firstRoundMatches) {
            match.previousMatch1Id = newMatches[prevMatchIndex1].id;
          }
          if (prevMatchIndex2 < firstRoundMatches) {
            match.previousMatch2Id = newMatches[prevMatchIndex2].id;
          }

          // Handle bye players advancing directly to second round
          const byeIndex = matchIndex - firstRoundMatches;
          if (byeIndex >= 0 && byeIndex < byePlayers.length) {
            // Assign bye player directly to this match
            if (!match.player1) {
              match.player1 = {
                name: byePlayers[byeIndex].name,
                handicap: byePlayers[byeIndex].handicap
              };
            } else if (!match.player2) {
              match.player2 = {
                name: byePlayers[byeIndex].name,
                handicap: byePlayers[byeIndex].handicap
              };
            }
          }
        } else {
          // Later rounds connect to previous round matches
          const prevRoundMatchIndex1 = matchIndex * 2;
          const prevRoundMatchIndex2 = matchIndex * 2 + 1;
          const prevRoundMatches = newMatches.filter(m => m.round === getRoundName(round - 1, totalRounds));
          
          if (prevRoundMatches[prevRoundMatchIndex1]) {
            match.previousMatch1Id = prevRoundMatches[prevRoundMatchIndex1].id;
          }
          if (prevRoundMatches[prevRoundMatchIndex2]) {
            match.previousMatch2Id = prevRoundMatches[prevRoundMatchIndex2].id;
          }
        }

        newMatches.push(match);
      }
    }

    // Show information about bye assignments
    if (byePlayers.length > 0) {
      const byePlayerNames = byePlayers.map(p => p.name).join(", ");
      toast({
        title: "Byes Assigned",
        description: `${byePlayers.length} players with best handicaps received byes: ${byePlayerNames}`,
      });
    }

    toast({
      title: "Bracket Generated!",
      description: `Tournament bracket created with ${firstRoundMatches} first-round matches. ${byePlayers.length} players received byes.`,
    });

    return newMatches;
  };

  const calculateFirstRoundMatches = (maxPlayers: number): number => {
    return maxPlayers / 2;
  };

  const calculateTotalRounds = (maxPlayers: number): number => {
    return Math.ceil(Math.log2(maxPlayers));
  };

  const assignByes = (
    sortedPlayers: Player[],
    firstRoundMatches: number
  ): { matchPlayers: Player[]; byePlayers: Player[] } => {
    const playersInFirstRound = firstRoundMatches * 2;
    
    if (sortedPlayers.length <= playersInFirstRound) {
      // No byes needed
      return {
        matchPlayers: sortedPlayers,
        byePlayers: []
      };
    }

    // Players with best handicaps get byes
    const byeCount = sortedPlayers.length - playersInFirstRound;
    const byePlayers = sortedPlayers.slice(0, byeCount);
    const matchPlayers = sortedPlayers.slice(byeCount);

    return { matchPlayers, byePlayers };
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