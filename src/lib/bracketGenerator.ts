import { supabase } from '@/integrations/supabase/client';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
  max_players: number;
  max_rounds: number;
}

export class BracketGenerator {
  async generateBracket(tournamentId: string, tournament: Tournament) {
    try {
      // First, get all registrations
      const { data: registrations, error: regError } = await supabase
        .from('tournament_registrations_new')
        .select(`
          *,
          player:players_new(*),
          team:teams(*)
        `)
        .eq('tournament_id', tournamentId);

      if (regError) throw regError;

      if (!registrations || registrations.length === 0) {
        throw new Error('No registrations found for this tournament');
      }

      // Generate the bracket structure
      const matches = this.generateBracketStructure(tournament, registrations);
      
      // Insert all matches
      const { error: matchError } = await supabase
        .from('matches_new')
        .insert(matches);

      if (matchError) throw matchError;

      console.log('Bracket generated successfully');
      
    } catch (error) {
      console.error('Error generating bracket:', error);
      throw error;
    }
  }

  private generateBracketStructure(tournament: Tournament, registrations: any[]) {
    const matches: any[] = [];
    const totalRounds = tournament.max_rounds;
    
    console.log('Tournament details:', tournament);
    console.log('Total registrations:', registrations.length);
    
    // For a proper elimination tournament:
    // Round 1: max_players/2 matches (e.g., 32 players = 16 matches)
    // Round 2: Round1/2 matches (e.g., 16 -> 8 matches)  
    // etc.
    
    // Generate all rounds
    for (let round = 1; round <= totalRounds; round++) {
      // Calculate matches in this round: for round 1 = max_players/2, then divide by 2 each round
      const matchesInRound = tournament.max_players / Math.pow(2, round);
      
      for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
        const match: any = {
          tournament_id: tournament.id,
          round_number: round,
          match_number: matchNum,
          status: 'pending'
        };

        // Set up feeding relationships
        if (round < totalRounds) {
          const nextRoundMatchNumber = Math.ceil(matchNum / 2);
          const position = matchNum % 2 === 1 ? 1 : 2;
          
          match.feeds_to_position = position;
          match.next_round_match = nextRoundMatchNumber;
        }

        matches.push(match);
      }
    }

    // Update feeding relationships
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (match.next_round_match && match.round_number < totalRounds) {
        const nextRoundMatch = matches.find(m => 
          m.round_number === match.round_number + 1 && 
          m.match_number === match.next_round_match
        );
        if (nextRoundMatch) {
          match.feeds_to_match_id = nextRoundMatch.id || `${tournament.id}_r${match.round_number + 1}_m${match.next_round_match}`;
        }
      }
      delete match.next_round_match; // Remove temporary field
    }

    // Assign participants to first round
    this.assignFirstRoundParticipants(matches, registrations, tournament);
    
    return matches;
  }

  private assignFirstRoundParticipants(matches: any[], registrations: any[], tournament: Tournament) {
    // Get first round matches
    const firstRoundMatches = matches.filter(m => m.round_number === 1);
    
    console.log('First round matches:', firstRoundMatches.length);
    console.log('Registrations:', registrations.length);
    
    // Shuffle registrations for fair bracket seeding
    const shuffledRegistrations = [...registrations].sort(() => Math.random() - 0.5);
    
    // Assign participants to matches
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const participant1 = shuffledRegistrations[i * 2];
      const participant2 = shuffledRegistrations[i * 2 + 1];
      
      console.log(`Match ${i + 1}: participant1=`, participant1?.player?.name || 'BYE', `participant2=`, participant2?.player?.name || 'BYE');
      
      if (participant1) {
        if (tournament.type === 'singles') {
          match.player1_id = participant1.player_id;
        } else {
          match.team1_id = participant1.team_id;
        }
      }
      
      if (participant2) {
        if (tournament.type === 'singles') {
          match.player2_id = participant2.player_id;
        } else {
          match.team2_id = participant2.team_id;
        }
        match.status = 'scheduled'; // Both participants assigned
      } else if (participant1) {
        // Bye - participant 1 automatically advances
        match.status = 'completed';
        if (tournament.type === 'singles') {
          match.winner_player_id = participant1.player_id;
        } else {
          match.winner_team_id = participant1.team_id;
        }
        
        // Advance winner to next round if possible
        if (match.feeds_to_match_id) {
          const nextMatch = matches.find(m => 
            m.round_number === match.round_number + 1 && 
            m.match_number === Math.ceil(match.match_number / 2)
          );
          
          if (nextMatch) {
            if (tournament.type === 'singles') {
              if (match.feeds_to_position === 1) {
                nextMatch.player1_id = participant1.player_id;
              } else {
                nextMatch.player2_id = participant1.player_id;
              }
            } else {
              if (match.feeds_to_position === 1) {
                nextMatch.team1_id = participant1.team_id;
              } else {
                nextMatch.team2_id = participant1.team_id;
              }
            }
          }
        }
      }
    }
  }
}