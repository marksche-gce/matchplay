import { useState, useEffect } from "react";
import { Plus, Trophy, Users, Calendar, Filter, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TournamentHeader } from "./TournamentHeader";
import { PlayerCard } from "./PlayerCard";
import { MatchCard } from "./MatchCard";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { EditMatchDialog } from "./EditMatchDialog";
import { CreateTournamentDialog } from "./CreateTournamentDialog";
import { CreatePlayerDialog } from "./CreatePlayerDialog";
import { TournamentSelector } from "./TournamentSelector";
import { TournamentManagement } from "./TournamentManagement";
import { HeaderImageUpload } from "./HeaderImageUpload";
import { TournamentBracket } from "./TournamentBracket";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  start_date: string;
  end_date: string;
  max_players: number;
  format: "matchplay" | "strokeplay" | "scramble";
  status: "upcoming" | "active" | "completed";
  registration_open: boolean;
  entry_fee?: number;
  players: string[];
}

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
}

interface MatchPlayer {
  name: string;
  handicap: number;
  score?: number;
}

interface Team {
  player1: MatchPlayer;
  player2: MatchPlayer;
  teamScore?: number;
}

interface Match {
  id: string;
  tournamentId: string;
  type: "singles" | "foursome";
  // For singles matches
  player1?: MatchPlayer;
  player2?: MatchPlayer;
  // For foursome matches
  team1?: Team;
  team2?: Team;
  round: string;
  status: "scheduled" | "completed";
  date: string;
  time: string | null;
  tee?: string;
  winner?: string;
}

export function TournamentDashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showManagement, setShowManagement] = useState(false);
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [editableSchedule, setEditableSchedule] = useState<{[key: string]: string}>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch tournaments, players, and matches from database
  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      fetchPlayers();
      fetchMatches();
    }
  }, [selectedTournament]);

  // Set up realtime subscriptions for automatic updates
  useEffect(() => {
    if (!selectedTournament) return;

    // Listen for match updates
    const matchChannel = supabase
      .channel('match-updates')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'matches',
          filter: `tournament_id=eq.${selectedTournament}`
        },
        (payload) => {
          console.log('=== REALTIME MATCH UPDATE ===');
          console.log('Match update received:', payload);
          console.log('Refreshing matches due to realtime update...');
          fetchMatches(); // Refresh matches when any match changes
          console.log('=== END REALTIME MATCH UPDATE ===');
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public', 
          table: 'match_participants'
        },
        (payload) => {
          console.log('Match participant update received:', payload);
          fetchMatches(); // Refresh matches when participants change
        }
      )
      .subscribe();

    // Listen for player registration updates
    const playerChannel = supabase
      .channel('player-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_registrations',
          filter: `tournament_id=eq.${selectedTournament}`
        },
        (payload) => {
          console.log('Player registration update received:', payload);
          fetchPlayers(); // Refresh players when registrations change
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players'
        },
        (payload) => {
          console.log('Player update received:', payload);
          fetchPlayers(); // Refresh players when player data changes
        }
      )
      .subscribe();

    // Cleanup subscriptions
    return () => {
      supabase.removeChannel(matchChannel);
      supabase.removeChannel(playerChannel);
    };
  }, [selectedTournament]);

  // Listen for tournament updates
  useEffect(() => {
    const tournamentChannel = supabase
      .channel('tournament-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournaments'
        },
        (payload) => {
          console.log('Tournament update received:', payload);
          fetchTournaments(); // Refresh tournaments when any tournament changes
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(tournamentChannel);
    };
  }, []);

  // Function to get available players for a specific match (excluding already assigned players)
  const getAvailablePlayersForMatch = (matchId: string) => {
    if (!selectedTournament) {
      console.log("No selected tournament, returning all players");
      return players;
    }

    // Since matches are already filtered by tournament when fetched from database,
    // we just need to exclude the current match being edited
    const otherMatches = matches.filter(m => m.id !== matchId);
    
    console.log("=== PLAYER FILTERING DEBUG ===");
    console.log("Match ID being edited:", matchId);
    console.log("Selected tournament:", selectedTournament);
    console.log("Total matches:", matches.length);
    console.log("Other matches (excluding current):", otherMatches.length);
    console.log("Other matches details:", otherMatches.map(m => ({ 
      id: m.id, 
      type: m.type,
      player1: m.player1?.name, 
      player2: m.player2?.name,
      team1: m.team1 ? `${m.team1.player1?.name} & ${m.team1.player2?.name}` : null,
      team2: m.team2 ? `${m.team2.player1?.name} & ${m.team2.player2?.name}` : null
    })));
    
    // Get all assigned player names from other matches in this tournament
    const assignedPlayerNames = new Set<string>();
    otherMatches.forEach(match => {
      // Singles match players
      if (match.player1?.name) {
        assignedPlayerNames.add(match.player1.name);
      }
      if (match.player2?.name) {
        assignedPlayerNames.add(match.player2.name);
      }
      // Team match players
      if (match.team1) {
        if (match.team1.player1?.name) {
          assignedPlayerNames.add(match.team1.player1.name);
        }
        if (match.team1.player2?.name) {
          assignedPlayerNames.add(match.team1.player2.name);
        }
      }
      if (match.team2) {
        if (match.team2.player1?.name) {
          assignedPlayerNames.add(match.team2.player1.name);
        }
        if (match.team2.player2?.name) {
          assignedPlayerNames.add(match.team2.player2.name);
        }
      }
    });
    
    console.log("Assigned player names from other matches:", Array.from(assignedPlayerNames));
    console.log("Total players available:", players.length);
    
    // Return players not assigned to other matches
    const availablePlayers = players.filter(player => !assignedPlayerNames.has(player.name));
    console.log("Available players after filtering:", availablePlayers.map(p => p.name));
    console.log("=== END DEBUG ===");
    
    return availablePlayers;
  };

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get player counts for each tournament
      const { data: registrationData } = await supabase
        .from('tournament_registrations')
        .select('tournament_id, player_id')
        .eq('status', 'registered');

      const playerCounts = (registrationData || []).reduce((acc, reg) => {
        acc[reg.tournament_id] = (acc[reg.tournament_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const formattedTournaments: Tournament[] = (data || []).map(t => ({
        id: t.id,
        name: t.name,
        course: t.course,
        description: t.description,
        start_date: t.start_date,
        end_date: t.end_date,
        max_players: t.max_players,
        format: t.format as "matchplay" | "strokeplay" | "scramble",
        status: t.status as "upcoming" | "active" | "completed",
        registration_open: t.registration_open,
        entry_fee: t.entry_fee,
        players: Array(playerCounts[t.id] || 0).fill('') // Populate with actual player count
      }));

      setTournaments(formattedTournaments);
      
      if (formattedTournaments.length > 0 && !selectedTournament) {
        setSelectedTournament(formattedTournaments[0].id);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      toast({
        title: "Error",
        description: "Failed to load tournaments.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    if (!selectedTournament) return;

    try {
      // Get players registered for this tournament
      const { data, error } = await supabase
        .from('tournament_registrations')
        .select(`
          player_id,
          players (
            id,
            name,
            email,
            handicap
          )
        `)
        .eq('tournament_id', selectedTournament);

      if (error) throw error;

      const tournamentPlayers: Player[] = (data || []).map((reg: any) => ({
        id: reg.players.id,
        name: reg.players.name,
        email: reg.players.email,
        handicap: reg.players.handicap,
        wins: 0, // These would need to be calculated from match results
        losses: 0,
        status: "active" as const
      }));

      // Sort players by handicap (lowest to highest) immediately after fetching
      const sortedTournamentPlayers = tournamentPlayers.sort((a, b) => Number(a.handicap) - Number(b.handicap));

      setPlayers(sortedTournamentPlayers);
    } catch (error) {
      console.error('Error fetching players:', error);
      toast({
        title: "Error",
        description: "Failed to load players.",
        variant: "destructive"
      });
    }
  };

  const fetchMatches = async () => {
    if (!selectedTournament) return;

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          match_participants (
            position,
            score,
            team_number,
            player_id,
            players (
              id,
              name,
              handicap
            )
          )
        `)
        .eq('tournament_id', selectedTournament)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform database matches to frontend format
      const formattedMatches: Match[] = (data || []).map((match: any) => {
        const participants = match.match_participants || [];
        console.log("Processing match:", match.id, "winner_id:", match.winner_id, "participants:", participants.map(p => ({ player_id: p.player_id, id: p.players?.id, name: p.players?.name })));
        
        if (match.type === 'singles') {
          const player1 = participants.find((p: any) => p.position === 1);
          const player2 = participants.find((p: any) => p.position === 2);
          // Fix winner lookup - use player_id from match_participants table
          const winner = match.winner_id ? participants.find((p: any) => p.player_id === match.winner_id)?.players?.name : undefined;
          
          console.log("Singles match winner lookup:", {
            winner_id: match.winner_id,
            found_winner: winner,
            participants: participants.map(p => ({ player_id: p.player_id, name: p.players?.name }))
          });
          
          return {
            id: match.id,
            tournamentId: match.tournament_id,
            type: "singles",
            player1: player1 ? {
              name: player1.players.name,
              handicap: player1.players.handicap,
              score: player1.score
            } : undefined,
            player2: player2 ? {
              name: player2.players.name,
              handicap: player2.players.handicap,
              score: player2.score
            } : undefined,
            round: match.round,
            status: match.status as "scheduled" | "completed",
            date: new Date(match.match_date || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: match.match_time || "TBD",
            tee: match.tee ? `Tee ${match.tee}` : undefined,
            winner: winner
          };
        } else {
          // Handle foursome matches
          const team1Players = participants.filter((p: any) => p.team_number === 1);
          const team2Players = participants.filter((p: any) => p.team_number === 2);
          
          return {
            id: match.id,
            tournamentId: match.tournament_id,
            type: "foursome",
            team1: team1Players.length >= 2 ? {
              player1: {
                name: team1Players[0].players.name,
                handicap: team1Players[0].players.handicap
              },
              player2: {
                name: team1Players[1].players.name,
                handicap: team1Players[1].players.handicap
              },
              teamScore: team1Players[0].score
            } : undefined,
            team2: team2Players.length >= 2 ? {
              player1: {
                name: team2Players[0].players.name,
                handicap: team2Players[0].players.handicap
              },
              player2: {
                name: team2Players[1].players.name,
                handicap: team2Players[1].players.handicap
              },
              teamScore: team2Players[0].score
            } : undefined,
            round: match.round,
            status: match.status as "scheduled" | "completed",
            date: new Date(match.match_date || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: match.match_time || "TBD",
            tee: match.tee ? `Tee ${match.tee}` : undefined
          };
        }
      });

      setMatches(formattedMatches);
    } catch (error) {
      console.error('Error fetching matches:', error);
      toast({
        title: "Error",
        description: "Failed to load matches.",
        variant: "destructive"
      });
    }
  };

  
  const getNextRoundDate = (): string => {
    // Find the next scheduled match date
    const scheduledMatches = tournamentMatches.filter(m => m.status === "scheduled");
    
    if (scheduledMatches.length === 0) {
      return "TBD";
    }
    
    // Get all unique dates from scheduled matches and sort them
    const matchDates = scheduledMatches
      .map(m => m.date)
      .filter(date => date && date !== "TBD")
      .sort();
    
    if (matchDates.length === 0) {
      return "TBD";
    }
    
    // Return the earliest scheduled date
    return matchDates[0];
  };

  const currentTournament = tournaments.find(t => t.id === selectedTournament);
  const tournamentPlayers = players; // Use all fetched players since they're already filtered by tournament
  const tournamentMatches = matches.filter(m => m.tournamentId === selectedTournament);

  const handleCreateTournament = async (tournamentData: any) => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .insert({
          name: tournamentData.name,
          course: tournamentData.course,
          description: tournamentData.description,
          start_date: tournamentData.startDate,
          end_date: tournamentData.endDate,
          max_players: tournamentData.maxPlayers,
          format: tournamentData.format,
          status: "upcoming",
          registration_open: true,
          entry_fee: tournamentData.entry_fee || 0
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tournament Created!",
        description: `${tournamentData.name} has been successfully created.`,
      });

      // Refresh tournaments list
      await fetchTournaments();
      setSelectedTournament(data.id);
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast({
        title: "Error",
        description: "Failed to create tournament.",
        variant: "destructive"
      });
    }
  };

  const handleCreatePlayer = async (playerData: Omit<Player, "id">) => {
    if (!selectedTournament || !user) {
      toast({
        title: "Cannot Add Player",
        description: "Please select a tournament and ensure you're logged in.",
        variant: "destructive"
      });
      return;
    }

    try {
      // First create or find the player
      let playerId: string;
      
      // Check if player already exists
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('name', playerData.name)
        .eq('email', playerData.email)
        .maybeSingle();

      if (existingPlayer) {
        playerId = existingPlayer.id;
      } else {
        // Create new player
        const { data: newPlayer, error: playerError } = await supabase
          .from('players')
          .insert({
            name: playerData.name,
            email: playerData.email,
            handicap: playerData.handicap,
            user_id: user.id
          })
          .select()
          .single();

        if (playerError) throw playerError;
        playerId = newPlayer.id;
      }

      // Register player for tournament
      const { error: registrationError } = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: selectedTournament,
          player_id: playerId,
          status: 'registered'
        });

      if (registrationError) throw registrationError;

      toast({
        title: "Player Added!",
        description: `${playerData.name} has been added to the tournament.`,
      });

      // Refresh players list
      await fetchPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      toast({
        title: "Error",
        description: "Failed to add player to tournament.",
        variant: "destructive"
      });
    }
  };

  const handleBulkCreatePlayers = async (playersData: Omit<Player, "id">[]) => {
    if (!selectedTournament || !user) {
      toast({
        title: "Cannot Add Players",
        description: "Please select a tournament and ensure you're logged in.",
        variant: "destructive"
      });
      return;
    }

    try {
      let successCount = 0;
      
      for (const playerData of playersData) {
        try {
          // Create player
          const { data: newPlayer, error: playerError } = await supabase
            .from('players')
            .insert({
              name: playerData.name,
              email: playerData.email,
              handicap: playerData.handicap,
              user_id: user.id
            })
            .select()
            .single();

          if (playerError) throw playerError;

          // Register player for tournament
          const { error: registrationError } = await supabase
            .from('tournament_registrations')
            .insert({
              tournament_id: selectedTournament,
              player_id: newPlayer.id,
              status: 'registered'
            });

          if (registrationError) throw registrationError;
          successCount++;
        } catch (error) {
          console.error(`Error adding player ${playerData.name}:`, error);
        }
      }

      toast({
        title: "Players Added!",
        description: `${successCount} players have been added to the tournament.`,
      });

      // Refresh players list
      await fetchPlayers();
    } catch (error) {
      console.error('Error adding players:', error);
      toast({
        title: "Error",
        description: "Failed to add players to tournament.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .delete()
        .eq('id', tournamentId);

      if (error) throw error;

      toast({
        title: "Tournament Deleted",
        description: "Tournament and all associated data have been removed.",
      });

      // Refresh tournaments list
      await fetchTournaments();
      
      if (selectedTournament === tournamentId) {
        setSelectedTournament(null);
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast({
        title: "Error",
        description: "Failed to delete tournament.",
        variant: "destructive"
      });
    }
  };

  const handleActivateTournament = async (tournamentId: string) => {
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ 
          status: 'active',
          registration_open: false 
        })
        .eq('id', tournamentId);

      if (error) throw error;

      toast({
        title: "Tournament Activated",
        description: "Tournament is now active and registration is closed.",
      });

      // Refresh tournaments list
      await fetchTournaments();
    } catch (error) {
      console.error('Error activating tournament:', error);
      toast({
        title: "Error",
        description: "Failed to activate tournament.",
        variant: "destructive"
      });
    }
  };

  const handleCreateMatch = async (matchData: Omit<Match, "id">) => {
    try {
      // Create match in database
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          tournament_id: matchData.tournamentId,
          type: matchData.type,
          round: matchData.round,
          status: matchData.status,
          match_date: matchData.date || currentTournament?.start_date || new Date().toISOString().split('T')[0],
          match_time: matchData.time,
          tee: matchData.tee ? parseInt(matchData.tee.replace('Tee ', '')) : null
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Add match participants
      const participants = [];
      
      if (matchData.type === "singles") {
        if (matchData.player1) {
          // Find player ID by name
          const player1 = players.find(p => p.name === matchData.player1?.name);
          if (player1) {
            participants.push({
              match_id: newMatch.id,
              player_id: player1.id,
              position: 1
            });
          }
        }
        
        if (matchData.player2) {
          const player2 = players.find(p => p.name === matchData.player2?.name);
          if (player2) {
            participants.push({
              match_id: newMatch.id,
              player_id: player2.id,
              position: 2
            });
          }
        }
      } else if (matchData.type === "foursome") {
        // Handle foursome participants
        if (matchData.team1) {
          const team1Player1 = players.find(p => p.name === matchData.team1?.player1.name);
          const team1Player2 = players.find(p => p.name === matchData.team1?.player2.name);
          
          if (team1Player1) {
            participants.push({
              match_id: newMatch.id,
              player_id: team1Player1.id,
              team_number: 1,
              position: 1
            });
          }
          
          if (team1Player2) {
            participants.push({
              match_id: newMatch.id,
              player_id: team1Player2.id,
              team_number: 1,
              position: 2
            });
          }
        }
        
        if (matchData.team2) {
          const team2Player1 = players.find(p => p.name === matchData.team2?.player1.name);
          const team2Player2 = players.find(p => p.name === matchData.team2?.player2.name);
          
          if (team2Player1) {
            participants.push({
              match_id: newMatch.id,
              player_id: team2Player1.id,
              team_number: 2,
              position: 1
            });
          }
          
          if (team2Player2) {
            participants.push({
              match_id: newMatch.id,
              player_id: team2Player2.id,
              team_number: 2,
              position: 2
            });
          }
        }
      }

      if (participants.length > 0) {
        const { error: participantsError } = await supabase
          .from('match_participants')
          .insert(participants);

        if (participantsError) throw participantsError;
      }

      toast({
        title: "Match Created!",
        description: `${matchData.type === "singles" ? "Singles" : "Foursome"} match has been scheduled.`,
      });

      // Refresh matches list
      await fetchMatches();
    } catch (error) {
      console.error('Error creating match:', error);
      toast({
        title: "Error",
        description: "Failed to create match.",
        variant: "destructive"
      });
    }
  };


  const handleBracketMatchUpdate = async (updatedMatches: Match[]) => {
    console.log("handleBracketMatchUpdate called with:", updatedMatches.length, "matches");
    
    // Find matches that were updated and persist them to database first
    const currentMatchMap = new Map(matches.map(m => [m.id, m]));
    const updatedMatchMap = new Map(updatedMatches.map(m => [m.id, m]));
    
    const savePromises = [];
    
    for (const [matchId, updatedMatch] of updatedMatchMap) {
      // Skip matches with non-UUID IDs (these are generated matches not yet in database)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matchId)) {
        console.log("Skipping non-UUID match:", matchId);
        continue;
      }
      
      const currentMatch = currentMatchMap.get(matchId);
      
      // Check if this match was actually updated
      if (currentMatch && (
        currentMatch.status !== updatedMatch.status ||
        currentMatch.winner !== updatedMatch.winner ||
        currentMatch.player1?.score !== updatedMatch.player1?.score ||
        currentMatch.player2?.score !== updatedMatch.player2?.score
      )) {
        console.log("Match updated, saving to database:", {
          matchId,
          oldStatus: currentMatch.status,
          newStatus: updatedMatch.status,
          oldWinner: currentMatch.winner,
          newWinner: updatedMatch.winner
        });
        
        // Add to promises but use database-only update function
        savePromises.push(handleEditMatchDatabase(matchId, updatedMatch));
      } else {
        console.log("No changes detected for match:", matchId);
      }
    }
    
    // Wait for all database updates to complete
    if (savePromises.length > 0) {
      try {
        await Promise.all(savePromises);
        console.log("All database updates completed successfully");
        
        toast({
          title: "Matches Updated!",
          description: "All match updates have been saved successfully.",
        });
      } catch (error) {
        console.error('Error updating matches:', error);
        toast({
          title: "Error Saving Matches",
          description: "Failed to save some match updates",
          variant: "destructive"
        });
        return; // Don't update state if database save failed
      }
    }
    
    // Only refresh from database if we have database matches to avoid clearing generated matches
    const hasUuidMatches = updatedMatches.some(m => 
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.id)
    );
    
    if (hasUuidMatches) {
      // We have database matches, refresh from database to ensure consistency
      await fetchMatches();
    } else {
      // Only generated matches, keep them in state
      setMatches(updatedMatches);
    }
  };

  // Database-only update function (doesn't refresh matches from DB)
  const handleEditMatchDatabase = async (matchId: string, updates: Partial<Match>) => {
    console.log("handleEditMatchDatabase called for:", matchId, "with updates:", updates);
    
    // First, update the match details
    const matchUpdates: any = {
      round: updates.round,
      status: updates.status
    };

    // Set winner_id based on winner name
    if (updates.winner && updates.winner !== "no-winner") {
      const winnerPlayer = players.find(p => p.name === updates.winner);
      console.log("Looking for winner player:", updates.winner, "found:", winnerPlayer);
      if (winnerPlayer) {
        matchUpdates.winner_id = winnerPlayer.id;
        console.log("Setting winner_id to:", winnerPlayer.id);
      } else {
        console.warn("Winner player not found in players list:", updates.winner);
        console.log("Available player names:", players.map(p => p.name));
      }
    } else {
      console.log("No winner specified or winner is 'no-winner'");
      matchUpdates.winner_id = null;
    }

    console.log("About to update match with:", matchUpdates);

    // Update match in database
    const { data, error: matchError } = await supabase
      .from('matches')
      .update(matchUpdates)
      .eq('id', matchId)
      .select();

    if (matchError) {
      console.error("Database error updating match:", matchError);
      throw matchError;
    }

    console.log("Successfully updated match in database. Updated data:", data);

    // Update match participants if it's a singles match with score updates
    if (updates.player1?.score !== undefined || updates.player2?.score !== undefined) {
      // Get current match participants
      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .select('*')
        .eq('match_id', matchId);

      if (participantsError) throw participantsError;

      // Update scores for each participant
      const updatePromises = [];
      
      if (updates.player1?.score !== undefined) {
        const player1Participant = participants.find(p => p.position === 1);
        if (player1Participant) {
          updatePromises.push(
            supabase
              .from('match_participants')
              .update({ score: updates.player1.score })
              .eq('id', player1Participant.id)
          );
        }
      }

      if (updates.player2?.score !== undefined) {
        const player2Participant = participants.find(p => p.position === 2);
        if (player2Participant) {
          updatePromises.push(
            supabase
              .from('match_participants')
              .update({ score: updates.player2.score })
              .eq('id', player2Participant.id)
          );
        }
      }

      // Execute all score updates
      if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        const scoreErrors = results.filter(result => result.error);
        if (scoreErrors.length > 0) {
          throw new Error('Failed to update some scores');
        }
      }
    }
  };

  const handleEditMatch = async (matchId: string, updates: Partial<Match>) => {
    console.log("handleEditMatch called for:", matchId, "with updates:", updates);
    console.log("Available players for winner lookup:", players.map(p => ({ id: p.id, name: p.name })));
    
    try {
      await handleEditMatchDatabase(matchId, updates);

      toast({
        title: "Match Updated!",
        description: "Match details have been successfully updated.",
      });

      // Only refresh matches for individual match edits (not bracket updates)
      await fetchMatches();
    } catch (error) {
      console.error('Error updating match:', error);
      toast({
        title: "Error",
        description: "Failed to update match details.",
        variant: "destructive"
      });
    }
  };


  const handleGenerateFirstRoundMatches = async () => {
    if (!selectedTournament || !currentTournament) {
      toast({
        title: "Error",
        description: "Please select a tournament first.",
        variant: "destructive"
      });
      return;
    }

    try {
      // Check if first round matches already exist
      const existingFirstRoundMatches = matches.filter(m => m.round === "Round 1");
      if (existingFirstRoundMatches.length > 0) {
        toast({
          title: "First Round Already Exists",
          description: "First round matches have already been generated.",
          variant: "destructive"
        });
        return;
      }

      // Get active players
      const activePlayers = players.filter(p => p.status === "active");
      
      if (activePlayers.length < 2) {
        toast({
          title: "Not Enough Players",
          description: "At least 2 players are needed to generate matches.",
          variant: "destructive"
        });
        return;
      }

      // Sort players by handicap (lowest to highest)
      const sortedPlayers = [...activePlayers].sort((a, b) => a.handicap - b.handicap);
      
      // Create strategic pairings: lowest vs highest handicap
      const matchPromises = [];
      const numMatches = Math.floor(sortedPlayers.length / 2);
      
      for (let i = 0; i < numMatches; i++) {
        const player1 = sortedPlayers[i]; // Lower handicap player
        const player2 = sortedPlayers[sortedPlayers.length - 1 - i]; // Higher handicap player
        
        // Create match in database
        const matchData = {
          tournament_id: selectedTournament,
          type: "singles",
          round: "Round 1",
          status: "scheduled",
          match_date: currentTournament.start_date,
          match_time: null,
          tee: null
        };

        matchPromises.push(
          supabase
            .from('matches')
            .insert(matchData)
            .select()
            .single()
            .then(async ({ data: newMatch, error: matchError }) => {
              if (matchError) throw matchError;

              // Add match participants
              const participants = [
                {
                  match_id: newMatch.id,
                  player_id: player1.id,
                  position: 1
                },
                {
                  match_id: newMatch.id,
                  player_id: player2.id,
                  position: 2
                }
              ];

              const { error: participantsError } = await supabase
                .from('match_participants')
                .insert(participants);

              if (participantsError) throw participantsError;
              
              return newMatch;
            })
        );
      }

      // Wait for all matches to be created
      await Promise.all(matchPromises);

      toast({
        title: "First Round Generated!",
        description: `${numMatches} strategically paired first round matches have been created.`,
      });

      // Refresh matches list
      await fetchMatches();
    } catch (error) {
      console.error('Error generating first round matches:', error);
      toast({
        title: "Error",
        description: "Failed to generate first round matches.",
        variant: "destructive"
      });
    }
  };

  // Helper function to get round names
  const getRoundName = (playersRemaining: number): string => {
    if (playersRemaining <= 2) return "Final";
    if (playersRemaining <= 4) return "Semi-Final";
    if (playersRemaining <= 8) return "Quarter-Final";
    if (playersRemaining <= 16) return "Round of 16";
    if (playersRemaining <= 32) return "Round of 32";
    return `Round ${Math.ceil(Math.log2(playersRemaining))}`;
  };

  // Generate tournament schedule based on player count and tournament dates
  const generateTournamentSchedule = () => {
    if (!currentTournament || !tournamentPlayers.length) return [];

    const totalPlayers = tournamentPlayers.length;
    const startDate = new Date(currentTournament.start_date);
    const endDate = new Date(currentTournament.end_date);
    
    // Calculate tournament days
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    // Determine rounds needed
    const rounds = [];
    let playersRemaining = totalPlayers;
    
    // First round with all players
    if (totalPlayers > 1) {
      rounds.push({
        name: "Round 1",
        matches: Math.floor(totalPlayers / 2),
        playersAdvancing: Math.floor(totalPlayers / 2) + (totalPlayers % 2)
      });
      playersRemaining = Math.floor(totalPlayers / 2) + (totalPlayers % 2);
    }
    
    // Generate elimination rounds
    while (playersRemaining > 1) {
      const roundName = getRoundName(playersRemaining);
      const matches = Math.floor(playersRemaining / 2);
      const advancing = Math.floor(playersRemaining / 2) + (playersRemaining % 2);
      
      rounds.push({
        name: roundName,
        matches,
        playersAdvancing: advancing
      });
      
      playersRemaining = advancing;
    }

    // Distribute rounds across tournament days
    const schedule = rounds.map((round, index) => {
      let scheduleDate: Date;
      
      if (rounds.length === 1) {
        // Single round tournament
        scheduleDate = startDate;
      } else if (daysDiff === 1) {
        // Single day tournament - distribute by time
        scheduleDate = startDate;
      } else {
        // Multi-day tournament - distribute evenly
        const dayIndex = Math.floor((index / rounds.length) * daysDiff);
        scheduleDate = new Date(startDate);
        scheduleDate.setDate(startDate.getDate() + dayIndex);
      }
      
      // Check if we have custom date for this round
      const customDate = editableSchedule[round.name];
      if (customDate) {
        scheduleDate = new Date(customDate);
      }
      
      // Assign times based on round and day
      let timeSlot = "TBD";
      if (daysDiff === 1) {
        // Single day - different times
        const hour = 8 + (index * 2); // Start at 8 AM, 2 hours apart
        timeSlot = `${hour}:00 AM`;
      } else if (index === rounds.length - 1) {
        // Final round gets afternoon slot
        timeSlot = "2:00 PM";
      } else if (index === 0) {
        // First round gets morning slot
        timeSlot = "8:00 AM";
      } else {
        // Other rounds get mid-day slots
        timeSlot = "12:00 PM";
      }

      return {
        ...round,
        date: scheduleDate.toLocaleDateString('en-US', { 
          weekday: 'long',
          month: 'long', 
          day: 'numeric',
          year: 'numeric'
        }),
        time: timeSlot,
        dateObj: scheduleDate,
        dateInput: scheduleDate.toISOString().split('T')[0] // For date input
      };
    });

    return schedule;
  };

  // Handle schedule editing
  const handleScheduleDateChange = (roundName: string, newDate: string) => {
    setEditableSchedule(prev => ({
      ...prev,
      [roundName]: newDate
    }));
  };

  // Save schedule changes
  const handleSaveSchedule = async () => {
    if (!selectedTournament) return;

    try {
      const schedule = generateTournamentSchedule();
      const updatePromises = [];

      // Update matches for each round with custom dates
      for (const round of schedule) {
        if (editableSchedule[round.name]) {
          const roundMatches = matches.filter(m => m.round === round.name);
          
          for (const match of roundMatches) {
            updatePromises.push(
              supabase
                .from('matches')
                .update({ match_date: editableSchedule[round.name] })
                .eq('id', match.id)
            );
          }
        }
      }

      // Execute all updates
      if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        const errors = results.filter(result => result.error);
        
        if (errors.length > 0) {
          throw new Error('Failed to update some matches');
        }
      }

      toast({
        title: "Schedule Updated!",
        description: "Tournament schedule has been successfully saved.",
      });

      setShowEditSchedule(false);
      // Refresh matches to get updated dates
      await fetchMatches();
    } catch (error) {
      console.error('Error saving schedule:', error);
      toast({
        title: "Error",
        description: "Failed to save schedule changes.",
        variant: "destructive"
      });
    }
  };

  const activePlayers = tournamentPlayers.filter(p => p.status === "active");

  // Show tournament management if requested
  if (showManagement && currentTournament) {
    return (
      <TournamentManagement
        tournament={currentTournament as any}
        players={players}
        matches={matches}
        onTournamentUpdate={async (updatedTournament) => {
          await fetchTournaments();
        }}
        onPlayerUpdate={setPlayers}
        onMatchUpdate={(updatedMatches) => {
          console.log("=== DASHBOARD onMatchUpdate CALLED ===");
          console.log("Received updated matches:", updatedMatches.length);
          console.log("Current matches count:", matches.length);
          
          // Update matches for this tournament while keeping matches from other tournaments
          const otherTournamentMatches = matches.filter(m => m.tournamentId !== selectedTournament);
          const allUpdatedMatches = [...otherTournamentMatches, ...updatedMatches];
          
          console.log("Final matches after merge:", allUpdatedMatches.length);
          console.log("Setting updated matches...");
          
          setMatches(allUpdatedMatches);
          
          console.log("=== DASHBOARD onMatchUpdate COMPLETE ===");
        }}
        onBack={() => setShowManagement(false)}
      />
    );
  }

  // Show tournament selector if no tournament is selected or no tournaments exist
  if (!selectedTournament || !currentTournament) {
    return (
      <div className="min-h-screen bg-gradient-course">
        <div className="container mx-auto px-4 py-6">
          <TournamentSelector
            tournaments={tournaments as any}
            selectedTournament={selectedTournament}
            onTournamentSelect={setSelectedTournament}
            onCreateNew={() => setShowCreateTournament(true)}
            onDeleteTournament={handleDeleteTournament}
            onActivateTournament={handleActivateTournament}
          />
          <div className="mt-6 text-center">
            <CreateTournamentDialog 
              onTournamentCreate={handleCreateTournament}
              open={showCreateTournament}
              onOpenChange={setShowCreateTournament}
            />
          </div>
        </div>
      </div>
    );
  }

  const tournamentHeaderData = {
    name: currentTournament.name,
    course: currentTournament.course,
    date: (() => {
      try {
        const startDate = new Date(currentTournament.start_date);
        const endDate = new Date(currentTournament.end_date);
        
        // Check if dates are valid
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return `${currentTournament.start_date} - ${currentTournament.end_date}`;
        }
        
        const startFormatted = startDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        const endFormatted = endDate.toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        });
        
        return startFormatted === endFormatted ? startFormatted : `${startFormatted} - ${endFormatted}`;
      } catch (error) {
        return `${currentTournament.start_date} - ${currentTournament.end_date}`;
      }
    })(),
    players: tournamentPlayers.length,
    status: currentTournament.status
  };

  return (
    <div className="min-h-screen bg-gradient-course">
      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <TournamentSelector
              tournaments={tournaments as any}
              selectedTournament={selectedTournament}
              onTournamentSelect={setSelectedTournament}
              onCreateNew={() => setSelectedTournament(null)}
              onDeleteTournament={handleDeleteTournament}
              onActivateTournament={handleActivateTournament}
            />
          </div>
        </div>
        
        <TournamentHeader tournament={tournamentHeaderData} />
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePlayers.length}</p>
                  <p className="text-sm text-muted-foreground">Active Players</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-success/10 rounded-lg">
                  <Trophy className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "completed").length}</p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-warning/10 rounded-lg">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{getNextRoundDate()}</p>
                  <p className="text-sm text-muted-foreground">Next Round</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 rounded-lg">
                  <Filter className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "scheduled").length}</p>
                  <p className="text-sm text-muted-foreground">Scheduled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-background/80 backdrop-blur-sm shadow-card">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="players">Players</TabsTrigger>
              <TabsTrigger value="matches">Matches</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <CreatePlayerDialog 
                onPlayerCreate={handleCreatePlayer} 
                onBulkPlayerCreate={handleBulkCreatePlayers}
              />
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Recent Matches</CardTitle>
                    {tournamentMatches.length > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowManagement(true)}
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        Edit Matches
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournamentMatches.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No matches scheduled yet</p>
                    </div>
                  ) : (
                  tournamentMatches.slice(0, 3).map(match => (
                      <EditMatchDialog
                        key={match.id}
                        match={match}
                        onMatchUpdate={handleEditMatch}
                        availablePlayers={getAvailablePlayersForMatch(match.id)}
                        tournamentStartDate={currentTournament?.start_date}
                        tournamentEndDate={currentTournament?.end_date}
                        trigger={
                          <div className="cursor-pointer">
                            <MatchCard 
                              match={match}
                              onScoreUpdate={() => console.log("Complete match", match.id)}
                              onViewDetails={() => console.log("View details for", match.id)}
                            />
                          </div>
                        }
                      />
                    ))
                  )}
                </CardContent>
              </Card>
              
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Top Players</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournamentPlayers.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No players added yet</p>
                    </div>
                  ) : (
                    tournamentPlayers
                      .sort((a, b) => (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1)))
                      .slice(0, 4)
                      .map(player => (
                        <PlayerCard 
                          key={player.id} 
                          player={player}
                          onSelect={() => setSelectedPlayer(player.id)}
                          selected={selectedPlayer === player.id}
                        />
                      ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {tournamentPlayers.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Players Yet</h3>
                  <p className="text-muted-foreground mb-4">Add players to start the tournament</p>
                  <CreatePlayerDialog 
                    onPlayerCreate={handleCreatePlayer}
                    onBulkPlayerCreate={handleBulkCreatePlayers}
                    trigger={
                      <Button variant="premium">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Player
                      </Button>
                    }
                  />
                </div>
              ) : (
                tournamentPlayers.map(player => (
                  <PlayerCard 
                    key={player.id} 
                    player={player}
                    onSelect={() => setSelectedPlayer(player.id)}
                    selected={selectedPlayer === player.id}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            {tournamentMatches.length === 0 ? (
              <div className="text-center py-8">
                <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Matches Scheduled</h3>
                <p className="text-muted-foreground mb-4">Schedule matches to start the tournament</p>
                <div className="flex gap-2 justify-center">
                  <CreateMatchDialog
                    tournamentId={selectedTournament}
                    availablePlayers={tournamentPlayers}
                    onMatchCreate={handleCreateMatch}
                    tournamentStartDate={currentTournament?.start_date}
                    tournamentEndDate={currentTournament?.end_date}
                    trigger={
                      <Button variant="fairway">
                        <Calendar className="h-4 w-4 mr-2" />
                        Schedule First Match
                      </Button>
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Add Match Button */}
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Tournament Matches</h3>
                  <CreateMatchDialog
                    tournamentId={selectedTournament}
                    availablePlayers={tournamentPlayers}
                    onMatchCreate={handleCreateMatch}
                    tournamentStartDate={currentTournament?.start_date}
                    tournamentEndDate={currentTournament?.end_date}
                    trigger={
                      <Button variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Match
                      </Button>
                    }
                  />
                </div>
                
                {/* Matches Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {tournamentMatches.map(match => (
                    <EditMatchDialog
                      key={match.id}
                      match={match}
                      onMatchUpdate={handleEditMatch}
                      availablePlayers={getAvailablePlayersForMatch(match.id)}
                      tournamentStartDate={currentTournament?.start_date}
                      tournamentEndDate={currentTournament?.end_date}
                      trigger={
                        <div className="cursor-pointer">
                          <MatchCard 
                            match={match}
                            onScoreUpdate={() => console.log("Complete match", match.id)}
                            onViewDetails={() => console.log("View details for", match.id)}
                          />
                        </div>
                      }
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Tournament Schedule
                  </CardTitle>
                  {tournamentPlayers.length > 0 && (
                    <div className="flex gap-2">
                      {showEditSchedule && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setShowEditSchedule(false);
                            setEditableSchedule({});
                          }}
                          className="flex items-center gap-2"
                        >
                          Cancel
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={showEditSchedule ? handleSaveSchedule : () => setShowEditSchedule(true)}
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4" />
                        {showEditSchedule ? "Save Schedule" : "Edit Schedule"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {tournamentPlayers.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Schedule Available</h3>
                    <p className="text-muted-foreground">Add players to generate the tournament schedule</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {generateTournamentSchedule().map((round, index) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-semibold text-lg">{round.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {round.matches} match{round.matches !== 1 ? 'es' : ''} • {round.playersAdvancing} player{round.playersAdvancing !== 1 ? 's' : ''} advance
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {showEditSchedule ? (
                            <div className="min-w-0">
                              <Input
                                type="date"
                                value={editableSchedule[round.name] || round.dateInput}
                                onChange={(e) => handleScheduleDateChange(round.name, e.target.value)}
                                className="w-40 mb-1"
                              />
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {round.time}
                              </p>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium">{round.date}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {round.time}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {generateTournamentSchedule().length > 0 && (
                      <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Trophy className="h-5 w-5 text-primary" />
                          <h4 className="font-semibold text-primary">Tournament Summary</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Total Players</p>
                            <p className="font-medium">{tournamentPlayers.length}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Rounds</p>
                            <p className="font-medium">{generateTournamentSchedule().length}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Matches</p>
                            <p className="font-medium">{generateTournamentSchedule().reduce((sum, round) => sum + round.matches, 0)}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bracket" className="space-y-6">
            <TournamentBracket
              tournamentId={currentTournament?.id || ""}
              matches={matches}
              players={players}
              onMatchUpdate={handleBracketMatchUpdate}
              onCreateMatch={handleCreateMatch}
              format={currentTournament?.format || "matchplay"}
              maxPlayers={currentTournament?.max_players || 32}
            />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HeaderImageUpload />
              
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Tournament Management
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => setShowManagement(true)}
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      Advanced Tournament Settings
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Access detailed tournament configuration, player management, and match scheduling options.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}