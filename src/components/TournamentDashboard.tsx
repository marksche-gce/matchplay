import { useState, useEffect } from "react";
import { Plus, Trophy, Users, Calendar, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TournamentHeader } from "./TournamentHeader";
import { PlayerCard } from "./PlayerCard";
import { CreateMatchDialog } from "./CreateMatchDialog";
import { EditMatchDialog } from "./EditMatchDialog";
import { CreateTournamentDialog } from "./CreateTournamentDialog";
import { CreatePlayerDialog } from "./CreatePlayerDialog";
import { TournamentSelector } from "./TournamentSelector";
import { TournamentBracket } from "./TournamentBracket";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTournament } from "@/hooks/useTournament";
import { usePlayers, Player } from "@/hooks/usePlayers";
import { useMatches, Match } from "@/hooks/useMatches";
import { supabase } from "@/integrations/supabase/client";

export function TournamentDashboard() {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Use new hooks
  const { 
    tournaments, 
    currentTournament, 
    setCurrentTournament, 
    createTournament: createTournamentFn, 
    deleteTournament 
  } = useTournament();
  
  const { 
    players, 
    loading: playersLoading, 
    error: playersError, 
    addPlayer 
  } = usePlayers({ 
    tournamentId: currentTournament?.id 
  });
  
  const { 
    matches, 
    loading: matchesLoading, 
    error: matchesError, 
    updateMatchResult, 
    createMatch 
  } = useMatches({ 
    tournamentId: currentTournament?.id || '' 
  });

  // Check user role
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();
          
        setIsOrganizer(data?.role === 'admin' || data?.role === 'organizer');
      } catch (error) {
        console.error('Error checking user role:', error);
        setIsOrganizer(false);
      }
    };

    checkUserRole();
  }, [user]);

  const handleCreateTournament = async (tournamentData: any) => {
    try {
      // Convert camelCase to snake_case for database
      const dbTournamentData = {
        name: tournamentData.name,
        course: tournamentData.course,
        description: tournamentData.description,
        start_date: tournamentData.startDate,
        end_date: tournamentData.endDate,
        max_players: tournamentData.maxPlayers,
        format: tournamentData.format,
        status: tournamentData.status,
        registration_open: true,
        entry_fee: 0
      };
      
      await createTournamentFn(dbTournamentData);
      setShowCreateTournament(false);
      toast({
        title: "Success",
        description: "Tournament created successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create tournament",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTournament = async (tournamentId: string) => {
    try {
      await deleteTournament(tournamentId);
      toast({
        title: "Success",
        description: "Tournament deleted successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tournament",
        variant: "destructive"
      });
    }
  };

  const handlePlayerRegistration = async (playerData: any) => {
    if (!currentTournament) return;

    try {
      // Create player first
      await addPlayer(playerData);
      
      // Then register them for the tournament
      const { data: newPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('email', playerData.email)
        .eq('user_id', user?.id)
        .single();

      if (newPlayer) {
        await supabase
          .from('tournament_registrations')
          .insert({
            tournament_id: currentTournament.id,
            player_id: newPlayer.id,
            status: 'registered'
          });
      }

      toast({
        title: "Success",
        description: "Player registered successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to register player",
        variant: "destructive"
      });
    }
  };

  const handleMatchUpdate = async (matchId: string, winnerId: string) => {
    try {
      await updateMatchResult(matchId, winnerId);
    } catch (error: any) {
      // Error handling is done in the hook
    }
  };

  const handleBracketMatchUpdate = (updatedMatches: any[]) => {
    // The matches will be automatically updated via the hook's realtime subscription
  };

  const handleCreateMatch = async (matchData: any) => {
    try {
      const newMatchData = {
        ...matchData,
        tournament_id: currentTournament?.id || '',
      };
      await createMatch(newMatchData);
      toast({
        title: "Success",
        description: "Match created successfully!"
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create match",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Please log in to access the tournament dashboard.</p>
        </CardContent>
      </Card>
    );
  }

  if (playersError || matchesError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">
            Error loading data: {playersError || matchesError}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <TournamentHeader tournament={{
        name: currentTournament?.name || '',
        course: currentTournament?.course || '',
        date: currentTournament?.start_date || '',
        players: players.length,
        status: currentTournament?.status || 'upcoming'
      }} />
      
      <div className="flex justify-between items-center">
        <TournamentSelector
          tournaments={tournaments.map(t => ({ ...t, players: [] }))}
          selectedTournament={currentTournament?.id || null}
          onTournamentSelect={(id) => {
            const tournament = tournaments.find(t => t.id === id);
            setCurrentTournament(tournament || null);
          }}
          onCreateNew={() => setShowCreateTournament(true)}
          onDeleteTournament={handleDeleteTournament}
          onActivateTournament={(id) => {
            // Add activation logic here if needed
          }}
        />
        
        {isOrganizer && (
          <div className="flex gap-2">
            <Button onClick={() => setShowCreateTournament(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        )}
      </div>

      {currentTournament && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{players.length}</div>
                  <p className="text-xs text-muted-foreground">
                    of {currentTournament.max_players} maximum
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{matches.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {matches.filter(m => m.status === 'completed').length} completed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tournament Status</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Badge variant={currentTournament.status === 'active' ? 'default' : 'secondary'}>
                      {currentTournament.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentTournament.format} format
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Registration</CardTitle>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Badge variant={currentTournament.registration_open ? 'default' : 'secondary'}>
                      {currentTournament.registration_open ? 'Open' : 'Closed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Entry fee: ${currentTournament.entry_fee || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tournament Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div><strong>Course:</strong> {currentTournament.course}</div>
                <div><strong>Start Date:</strong> {currentTournament.start_date}</div>
                <div><strong>End Date:</strong> {currentTournament.end_date}</div>
                {currentTournament.description && (
                  <div><strong>Description:</strong> {currentTournament.description}</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Players ({players.length})</h3>
              {isOrganizer && currentTournament.registration_open && (
                <CreatePlayerDialog onPlayerCreate={handlePlayerRegistration} />
              )}
            </div>

            {playersLoading ? (
              <div className="flex justify-center">
                <p>Loading players...</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    selected={selectedPlayer === player.id}
                    onSelect={() => setSelectedPlayer(player.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="matches" className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Matches ({matches.length})</h3>
              {isOrganizer && (
                <CreateMatchDialog
                  tournamentId={currentTournament.id}
                  availablePlayers={players}
                  onMatchCreate={handleCreateMatch}
                />
              )}
            </div>

            {matchesLoading ? (
              <div className="flex justify-center">
                <p>Loading matches...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <Card key={match.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold">Round: {match.round}</h4>
                          <p className="text-sm text-muted-foreground">
                            {match.type === 'singles' 
                              ? `${match.player1?.name || 'TBD'} vs ${match.player2?.name || 'TBD'}`
                              : `Team 1 vs Team 2`
                            }
                          </p>
                          <Badge variant={match.status === 'completed' ? 'default' : 'secondary'}>
                            {match.status}
                          </Badge>
                        </div>
                        
                        {isOrganizer && match.status !== 'completed' && (
                          <EditMatchDialog
                            match={{
                              ...match,
                              tournamentId: match.tournament_id,
                              date: match.match_date || '',
                              time: match.match_time || '',
                              winner: match.winner_id,
                              tee: match.tee?.toString() || '',
                              status: match.status === 'in_progress' ? 'scheduled' : match.status
                            }}
                            onMatchUpdate={(updatedMatch: any) => {
                              if (updatedMatch.winner_id) {
                                handleMatchUpdate(updatedMatch.id, updatedMatch.winner_id);
                              }
                            }}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bracket" className="space-y-6">
            <TournamentBracket
              tournamentId={currentTournament.id}
              matches={matches.map(m => ({
                ...m,
                tournamentId: m.tournament_id,
                date: m.match_date || '',
                time: m.match_time || '',
                winner: m.winner_id,
                tee: m.tee?.toString() || '',
                status: m.status === 'in_progress' ? 'scheduled' : m.status
              }))}
              players={players}
              onMatchUpdate={handleBracketMatchUpdate}
              onCreateMatch={handleCreateMatch}
              format={currentTournament.format}
              maxPlayers={currentTournament.max_players}
            />
          </TabsContent>
        </Tabs>
      )}

      {showCreateTournament && (
        <CreateTournamentDialog
          open={showCreateTournament}
          onOpenChange={setShowCreateTournament}
          onTournamentCreate={handleCreateTournament}
        />
      )}
    </div>
  );
}