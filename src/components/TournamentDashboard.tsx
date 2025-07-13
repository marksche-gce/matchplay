import { useState, useEffect } from "react";
import { Plus, Trophy, Users, Calendar, Filter, Settings, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TournamentHeader } from "./TournamentHeader";
import { PlayerCard } from "./PlayerCard";
import { MatchCard } from "./MatchCard";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { CreateTournamentDialog } from "./CreateTournamentDialog";
import { CreatePlayerDialog } from "./CreatePlayerDialog";
import { TournamentSelector } from "./TournamentSelector";
import { TournamentManagement } from "./TournamentManagement";
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
  status: "scheduled" | "in-progress" | "completed";
  date: string;
  time: string;
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

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        players: [] // Will be populated when needed
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

      setPlayers(tournamentPlayers);
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
            players (
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
        
        if (match.type === 'singles') {
          const player1 = participants.find((p: any) => p.position === 1);
          const player2 = participants.find((p: any) => p.position === 2);
          
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
            status: match.status as "scheduled" | "in-progress" | "completed",
            date: new Date(match.match_date || new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            time: match.match_time || "TBD",
            tee: match.tee ? `Tee ${match.tee}` : undefined,
            winner: match.winner_id ? participants.find((p: any) => p.players.id === match.winner_id)?.players.name : undefined
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
            status: match.status as "scheduled" | "in-progress" | "completed",
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
        .update({ status: 'active' })
        .eq('id', tournamentId);

      if (error) throw error;

      toast({
        title: "Tournament Activated",
        description: "Tournament is now active and ready for matches.",
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
          match_date: new Date().toISOString().split('T')[0],
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

  const handleAutoScheduleMatches = async () => {
    if (!selectedTournament) {
      toast({
        title: "No Tournament Selected",
        description: "Please select a tournament before auto-scheduling matches.",
        variant: "destructive"
      });
      return;
    }

    const activePlayers = tournamentPlayers.filter(p => p.status === "active");
    
    if (activePlayers.length < 2) {
      toast({
        title: "Not Enough Players",
        description: "At least 2 active players are required to schedule matches.",
        variant: "destructive"
      });
      return;
    }

    // Sort players by handicap (best to worst)
    const sortedPlayers = [...activePlayers].sort((a, b) => a.handicap - b.handicap);
    
    // Create matches pairing best vs worst handicap
    const newMatches: Match[] = [];
    const usedPlayers = new Set<string>();
    
    for (let i = 0; i < Math.floor(sortedPlayers.length / 2); i++) {
      const bestPlayer = sortedPlayers[i];
      const worstPlayer = sortedPlayers[sortedPlayers.length - 1 - i];
      
      // Skip if either player is already used (shouldn't happen with this algorithm, but safety check)
      if (usedPlayers.has(bestPlayer.id) || usedPlayers.has(worstPlayer.id)) {
        continue;
      }
      
      usedPlayers.add(bestPlayer.id);
      usedPlayers.add(worstPlayer.id);
      
      const match: Match = {
        id: (Date.now() + i).toString(),
        tournamentId: selectedTournament,
        type: "singles",
        player1: {
          name: bestPlayer.name,
          handicap: bestPlayer.handicap
        },
        player2: {
          name: worstPlayer.name,
          handicap: worstPlayer.handicap
        },
        round: `Round ${Math.floor(tournamentMatches.length / (activePlayers.length / 2)) + 1}`,
        status: "scheduled",
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        time: `${9 + i}:00 AM`,
        tee: `Tee ${(i % 2) === 0 ? '1' : '10'}`
      };
      
      // Create each match using the existing handleCreateMatch function
      await handleCreateMatch(match);
      newMatches.push(match);
    }
    
    if (newMatches.length === 0) {
      toast({
        title: "No Matches Created",
        description: "Unable to create any matches with current player selection.",
        variant: "destructive"
      });
      return;
    }
    
    const oddPlayerCount = activePlayers.length % 2;
    const message = oddPlayerCount === 1 
      ? `${newMatches.length} matches scheduled! Note: ${sortedPlayers[Math.floor(sortedPlayers.length / 2)].name} has a bye.`
      : `${newMatches.length} matches scheduled successfully!`;
    
    toast({
      title: "Auto-Schedule Complete",
      description: message,
    });
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
        onMatchUpdate={setMatches}
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
            onCreateNew={() => setSelectedTournament(null)}
            onDeleteTournament={handleDeleteTournament}
            onActivateTournament={handleActivateTournament}
          />
          <div className="mt-6 text-center">
            <CreateTournamentDialog onTournamentCreate={handleCreateTournament} />
          </div>
        </div>
      </div>
    );
  }

  const tournamentHeaderData = {
    name: currentTournament.name,
    course: currentTournament.course,
    date: `${new Date(currentTournament.start_date).toLocaleDateString()}${currentTournament.end_date ? ` - ${new Date(currentTournament.end_date).toLocaleDateString()}` : ''}`,
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
            <Button 
              variant="outline" 
              onClick={() => setShowManagement(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Manage Tournament
            </Button>
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
                  <p className="text-2xl font-bold">{tournamentMatches.filter(m => m.status === "in-progress").length}</p>
                  <p className="text-sm text-muted-foreground">In Progress</p>
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
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            </TabsList>
            
            <div className="flex gap-2">
              <CreatePlayerDialog 
                onPlayerCreate={handleCreatePlayer} 
                onBulkPlayerCreate={handleBulkCreatePlayers}
              />
              <CreateMatchDialog
                tournamentId={selectedTournament}
                availablePlayers={tournamentPlayers}
                onMatchCreate={handleCreateMatch}
                trigger={
                  <Button variant="fairway">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule Match
                  </Button>
                }
              />
              <Button 
                variant="premium" 
                onClick={handleAutoScheduleMatches}
                disabled={activePlayers.length < 2}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Auto-Schedule
              </Button>
            </div>
          </div>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="shadow-card">
                <CardHeader>
                  <CardTitle>Recent Matches</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {tournamentMatches.length === 0 ? (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No matches scheduled yet</p>
                    </div>
                  ) : (
                    tournamentMatches.slice(0, 3).map(match => (
                      <MatchCard 
                        key={match.id} 
                        match={match}
                        onScoreUpdate={() => console.log("Update score for", match.id)}
                        onViewDetails={() => console.log("View details for", match.id)}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {tournamentMatches.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Matches Scheduled</h3>
                  <p className="text-muted-foreground mb-4">Schedule matches to start the tournament</p>
                  <div className="flex gap-2 justify-center">
                    <CreateMatchDialog
                      tournamentId={selectedTournament}
                      availablePlayers={tournamentPlayers}
                      onMatchCreate={handleCreateMatch}
                      trigger={
                        <Button variant="fairway">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule First Match
                        </Button>
                      }
                    />
                    {activePlayers.length >= 2 && (
                      <Button 
                        variant="premium" 
                        onClick={handleAutoScheduleMatches}
                        className="flex items-center gap-2"
                      >
                        <Zap className="h-4 w-4" />
                        Auto-Schedule Round
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                tournamentMatches.map(match => (
                  <MatchCard 
                    key={match.id} 
                    match={match}
                    onScoreUpdate={() => console.log("Update score for", match.id)}
                    onViewDetails={() => console.log("View details for", match.id)}
                  />
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="bracket" className="space-y-6">
            <Card className="shadow-card">
              <CardContent className="p-8">
                <div className="text-center">
                  <Trophy className="h-16 w-16 text-warning mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Tournament Bracket</h3>
                  <p className="text-muted-foreground">
                    Interactive bracket view coming soon! Track the tournament progression through each round.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}