// Centralized tournament utilities for consistent round naming and bracket logic

/**
 * Standard tournament round naming based on total rounds
 * Always uses: Round 1 → Round 2 → Round 3 → Round 4 for consistency
 */
export const getRoundName = (round: number, totalRounds: number): string => {
  return `Round ${round}`;
};

/**
 * Get display name for rounds (for UI purposes)
 */
export const getRoundDisplayName = (round: number, totalRounds: number): string => {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";  
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
};

/**
 * Calculate total rounds needed for a tournament
 */
export const calculateTotalRounds = (maxPlayers: number): number => {
  return Math.ceil(Math.log2(maxPlayers));
};

/**
 * Calculate number of first round matches
 */
export const calculateFirstRoundMatches = (maxPlayers: number): number => {
  return maxPlayers / 2;
};

/**
 * Standard round progression mapping
 */
export const ROUND_PROGRESSION: { [key: string]: string | null } = {
  "Round 1": "Round 2",
  "Round 2": "Round 3", 
  "Round 3": "Round 4",
  "Round 4": null // Final round
};

/**
 * Get next round name
 */
export const getNextRoundName = (currentRound: string): string | null => {
  return ROUND_PROGRESSION[currentRound] || null;
};