import { supabase } from '@/integrations/supabase/client';

interface Tournament {
  id: string;
  name?: string;
  type: 'singles' | 'foursome';
  max_players: number;
  max_rounds: number;
}

export class BracketGenerator {
  async generateBracket(tournamentId: string, tournament: Tournament) {
    try {
      // Get registrations (optional - bracket can be generated without them)
      const { data: registrations, error: regError } = await supabase
        .from('tournament_registrations_new')
        .select(`
          *,
          player:players_new(*),
          team:teams(*)
        `)
        .eq('tournament_id', tournamentId);

      if (regError) throw regError;

      console.log('Generating bracket for tournament:', tournament.name);
      console.log('Max players:', tournament.max_players);
      console.log('Current registrations:', registrations?.length || 0);

      // Generate the bracket structure based on max_players (not current registrations)
      const matches = this.generateBracketStructure(tournament, registrations || []);
      
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
    console.log('Expected rounds:', totalRounds);
    
    // Generate all matches with proper IDs first
    const allMatches: any[] = [];
    
    // Generate all rounds
    for (let round = 1; round <= totalRounds; round++) {
      // Calculate matches in this round: for round 1 = max_players/2, then divide by 2 each round
      const matchesInRound = tournament.max_players / Math.pow(2, round);
      
      console.log(`Round ${round}: ${matchesInRound} matches`);
      
      for (let matchNum = 1; matchNum <= matchesInRound; matchNum++) {
        const matchId = crypto.randomUUID();
        const match: any = {
          id: matchId,
          tournament_id: tournament.id,
          round_number: round,
          match_number: matchNum,
          status: 'pending'
        };

        // Initialize with placeholder to satisfy check constraints
        if (tournament.type === 'singles') {
          // For singles, we'll use null players but need to handle the constraint
          // We'll set these properly when assigning participants
        } else {
          // For foursome, we'll use null teams but need to handle the constraint
          // We'll set these properly when assigning participants
        }

        allMatches.push(match);
      }
    }

    // Now set up feeding relationships using actual match IDs
    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];
      
      if (match.round_number < totalRounds) {
        const nextRoundMatchNumber = Math.ceil(match.match_number / 2);
        const position = match.match_number % 2 === 1 ? 1 : 2;
        
        // Find the actual next round match
        const nextRoundMatch = allMatches.find(m => 
          m.round_number === match.round_number + 1 && 
          m.match_number === nextRoundMatchNumber
        );
        
        if (nextRoundMatch) {
          match.feeds_to_match_id = nextRoundMatch.id;
          match.feeds_to_position = position;
        }
      }
    }

    // Assign participants to first round - this will handle the check constraints
    this.assignFirstRoundParticipants(allMatches, registrations, tournament);
    
    return allMatches;
  }

  private assignFirstRoundParticipants(matches: any[], registrations: any[], tournament: Tournament) {
    // Get first round matches
    const firstRoundMatches = matches.filter(m => m.round_number === 1);
    
    console.log('First round matches:', firstRoundMatches.length);
    console.log('Available registrations:', registrations.length);
    
    // For each first round match, we need to satisfy the check constraint
    // by ensuring either player OR team fields are set (not both, and not neither)
    
    if (registrations.length === 0) {
      console.log('No registrations yet - creating placeholder matches');
      // Create placeholder matches that satisfy the constraint
      firstRoundMatches.forEach((match, index) => {
        if (tournament.type === 'singles') {
          // Set placeholder player IDs (these will be null, which violates constraint)
          // Instead, we'll create the match without any player assignments for now
          // The constraint requires at least one player or team to be set
          // We can't create truly empty matches due to the constraint
          // So we'll skip creating these matches until we have participants
        } else {
          // Same issue for teams
        }
      });
      
      // Since we can't create empty matches that satisfy the constraints,
      // we'll return an empty array and only create matches when we have participants
      return [];
    }
    
    // Shuffle registrations for fair bracket seeding
    const shuffledRegistrations = [...registrations].sort(() => Math.random() - 0.5);
    
    // Assign participants to matches
    for (let i = 0; i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const participant1 = shuffledRegistrations[i * 2];
      const participant2 = shuffledRegistrations[i * 2 + 1];
      
      console.log(`Match ${i + 1}: participant1=`, participant1?.player?.name || 'Empty', `participant2=`, participant2?.player?.name || 'Empty');
      
      // We need to ensure the check constraint is satisfied
      if (participant1) {
        if (tournament.type === 'singles') {
          match.player1_id = participant1.player_id;
          // Set team fields to null to satisfy constraint
          match.team1_id = null;
          match.team2_id = null;
        } else {
          match.team1_id = participant1.team_id;
          // Set player fields to null to satisfy constraint
          match.player1_id = null;
          match.player2_id = null;
        }
      } else {
        // No participants - we need to create a placeholder that satisfies constraints
        if (tournament.type === 'singles') {
          // We'll create an empty match but this will fail the constraint
          // So instead, we'll mark this match as not ready
          match.status = 'not_ready';
          match.player1_id = null;
          match.team1_id = null;
        } else {
          match.status = 'not_ready';
          match.team1_id = null;
          match.player1_id = null;
        }
      }
      
      if (participant2) {
        if (tournament.type === 'singles') {
          match.player2_id = participant2.player_id;
        } else {
          match.team2_id = participant2.team_id;
        }
        if (participant1) {
          match.status = 'scheduled'; // Both participants assigned
        }
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
                nextMatch.team1_id = null;
              } else {
                nextMatch.player2_id = participant1.player_id;
                nextMatch.team2_id = null;
              }
            } else {
              if (match.feeds_to_position === 1) {
                nextMatch.team1_id = participant1.team_id;
                nextMatch.player1_id = null;
              } else {
                nextMatch.team2_id = participant1.team_id;
                nextMatch.player2_id = null;
              }
            }
          }
        }
      }
    }
  }
}