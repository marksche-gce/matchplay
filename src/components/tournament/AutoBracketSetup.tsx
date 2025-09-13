import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Trophy, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Tournament {
  id: string;
  type: 'singles' | 'foursome';
  max_players: number;
}

interface Player {
  id: string;
  name: string;
  handicap: number;
}

interface Team {
  id: string;
  name: string;
  player1_id?: string;
  player2_id?: string;
  player1?: Player;
  player2?: Player;
}

interface Registration {
  id: string;
  position: number;
  player_id?: string;
  team_id?: string;
  player?: Player;
  team?: Team;
}

interface Match {
  id: string;
  round_number: number;
  match_number: number;
  feeds_to_match_id?: string;
  feeds_to_position?: number;
}

interface AutoBracketSetupProps {
  tournament: Tournament;
  onSetupComplete: () => void;
}

export function AutoBracketSetup({ tournament, onSetupComplete }: AutoBracketSetupProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [firstRoundMatches, setFirstRoundMatches] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, tournament.id]);

  const fetchData = async () => {
    try {
      // Fetch registrations in saved order
      const { data: regs } = await supabase
        .from('tournament_registrations_new')
        .select(`
          id,
          position,
          player_id,
          team_id,
          player:players_new(*),
          team:teams(
            *,
            player1:players_new!teams_player1_id_fkey(*),
            player2:players_new!teams_player2_id_fkey(*)
          )
        `)
        .eq('tournament_id', tournament.id)
        .order('position', { nullsFirst: false });

      setRegistrations(regs || []);

      // Fetch first round matches
      const { data: matches } = await supabase
        .from('matches_new')
        .select('*')
        .eq('tournament_id', tournament.id)
        .eq('round_number', 1)
        .order('match_number');

      setFirstRoundMatches(matches || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const calculateByes = () => {
    return tournament.max_players - registrations.length;
  };

  const getParticipantName = (reg: Registration) => {
    if (tournament.type === 'singles' && reg.player) {
      return `${reg.player.name} (HCP: ${reg.player.handicap})`;
    } else if (tournament.type === 'foursome' && reg.team) {
      const playerNames = [];
      if (reg.team.player1?.name) playerNames.push(reg.team.player1.name);
      if (reg.team.player2?.name) playerNames.push(reg.team.player2.name);
      const avgHandicap = ((reg.team.player1?.handicap || 0) + (reg.team.player2?.handicap || 0)) / 2;
      return `${reg.team.name} (${playerNames.join(' & ')}) - Avg HCP: ${avgHandicap.toFixed(1)}`;
    }
    return 'Unbekannt';
  };

  const setupAutoBracket = async () => {
    if (registrations.length === 0) {
      toast({
        title: "Keine Anmeldungen",
        description: "Es sind keine Teilnehmer registriert.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const byeCount = calculateByes();
      
      if (byeCount === 0) {
        // Variante A: Keine Freilose - Standard Turnier-Seeding
        await setupNormalBracket();
      } else {
        // Variante B: Mit Freilosen - Beste Handicapper bekommen Freilose
        await setupBracketWithByes(byeCount);
      }

      toast({
        title: "Automatisches Setup erfolgreich",
        description: "Die erste Runde wurde automatisch eingerichtet.",
      });

      onSetupComplete();
      setOpen(false);
      
    } catch (error) {
      console.error('Error setting up bracket:', error);
      toast({
        title: "Fehler",
        description: "Das automatische Setup ist fehlgeschlagen. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupNormalBracket = async () => {
    // Standard Tournament Seeding:
    // 1 vs 2 (letztes Spiel), 3 vs 4 (erstes Spiel), usw.
    // Spiegelbildlich aufbauen
    
    const sortedParticipants = [...registrations].sort((a, b) => (a.position || 999) - (b.position || 999));
    const matchUpdates = [];

    for (let i = 0; i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const isLastMatch = i === firstRoundMatches.length - 1;
      const isFirstMatch = i === 0;
      
      let participant1, participant2;
      
      if (isFirstMatch) {
        // Erstes Spiel: Position 1 vs Position 3
        participant1 = sortedParticipants[0]; // Rang 1
        participant2 = sortedParticipants[2]; // Rang 3
      } else if (isLastMatch) {
        // Letztes Spiel: Position 2 vs Position 4  
        participant1 = sortedParticipants[3]; // Rang 4
        participant2 = sortedParticipants[1]; // Rang 2
      } else {
        // Mittlere Spiele: Nach Standard-Seeding
        const baseIndex = i * 2;
        participant1 = sortedParticipants[baseIndex + 4]; // Weitere Ränge
        participant2 = sortedParticipants[baseIndex + 5];
      }

      const updateData: any = { status: 'scheduled' };
      
      if (participant1) {
        if (tournament.type === 'singles') {
          updateData.player1_id = participant1.player_id;
        } else {
          updateData.team1_id = participant1.team_id;
        }
      }
      
      if (participant2) {
        if (tournament.type === 'singles') {
          updateData.player2_id = participant2.player_id;
        } else {
          updateData.team2_id = participant2.team_id;
        }
      }

      matchUpdates.push({
        matchId: match.id,
        updateData
      });
    }

    // Apply all updates
    for (const update of matchUpdates) {
      await supabase
        .from('matches_new')
        .update(update.updateData)
        .eq('id', update.matchId);
    }
  };

  const setupBracketWithByes = async (byeCount: number) => {
    // Sortiere nach Handicap für Freilose (beste zuerst)
    const sortedByHandicap = [...registrations].sort((a, b) => {
      const handicapA = tournament.type === 'singles' 
        ? (a.player?.handicap || 999)
        : ((a.team?.player1?.handicap || 0) + (a.team?.player2?.handicap || 0)) / 2;
      const handicapB = tournament.type === 'singles'
        ? (b.player?.handicap || 999) 
        : ((b.team?.player1?.handicap || 0) + (b.team?.player2?.handicap || 0)) / 2;
      return handicapA - handicapB;
    });

    // Beste Handicapper bekommen Freilose
    const playersWithByes = sortedByHandicap.slice(0, byeCount);
    const playersToPlay = sortedByHandicap.slice(byeCount);

    // Spiegelbildlicher Aufbau: Bester vs Schlechtester
    const reversedPlayers = [...playersToPlay].reverse();
    const pairedPlayers = [];
    
    for (let i = 0; i < Math.floor(playersToPlay.length / 2); i++) {
      pairedPlayers.push({
        player1: playersToPlay[i],
        player2: reversedPlayers[i]
      });
    }

    const matchUpdates = [];
    
    // Setup Freilose (erste Matches für beste Handicapper)
    for (let i = 0; i < playersWithByes.length && i < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[i];
      const participant = playersWithByes[i];
      
      const updateData: any = {
        status: 'completed'
      };
      
      if (tournament.type === 'singles') {
        updateData.player1_id = participant.player_id;
        updateData.winner_player_id = participant.player_id;
      } else {
        updateData.team1_id = participant.team_id;
        updateData.winner_team_id = participant.team_id;
      }

      matchUpdates.push({
        matchId: match.id,
        updateData,
        advanceWinner: true,
        winnerId: tournament.type === 'singles' ? participant.player_id : participant.team_id
      });
    }

    // Setup reguläre Matches
    const startIndex = playersWithByes.length;
    for (let i = 0; i < pairedPlayers.length && (startIndex + i) < firstRoundMatches.length; i++) {
      const match = firstRoundMatches[startIndex + i];
      const pair = pairedPlayers[i];
      
      const updateData: any = { status: 'scheduled' };
      
      if (tournament.type === 'singles') {
        updateData.player1_id = pair.player1.player_id;
        updateData.player2_id = pair.player2.player_id;
      } else {
        updateData.team1_id = pair.player1.team_id;
        updateData.team2_id = pair.player2.team_id;
      }

      matchUpdates.push({
        matchId: match.id,
        updateData
      });
    }

    // Apply all updates and advance bye winners
    for (const update of matchUpdates) {
      await supabase
        .from('matches_new')
        .update(update.updateData)
        .eq('id', update.matchId);

      // Advance bye winner to next round
      if (update.advanceWinner && update.winnerId) {
        const match = firstRoundMatches.find(m => m.id === update.matchId);
        if (match?.feeds_to_match_id && match.feeds_to_position) {
          const nextRoundUpdate: any = {};
          
          if (tournament.type === 'singles') {
            nextRoundUpdate[`player${match.feeds_to_position}_id`] = update.winnerId;
          } else {
            nextRoundUpdate[`team${match.feeds_to_position}_id`] = update.winnerId;
          }
          
          await supabase
            .from('matches_new')
            .update(nextRoundUpdate)
            .eq('id', match.feeds_to_match_id);
        }
      }
    }
  };

  const byeCount = calculateByes();
  const canAutoSetup = registrations.length > 0 && firstRoundMatches.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Auto-Setup erste Runde
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automatisches Setup der ersten Runde
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Turnier-Übersicht
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Max. Teilnehmer:</span>
                <Badge variant="outline">{tournament.max_players}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Angemeldet:</span>
                <Badge variant="outline">{registrations.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Erste Runde Matches:</span>
                <Badge variant="outline">{firstRoundMatches.length}</Badge>
              </div>
              {byeCount > 0 && (
                <div className="flex justify-between">
                  <span>Freilose:</span>
                  <Badge variant="secondary">{byeCount}</Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Setup-Regeln
              </CardTitle>
            </CardHeader>
            <CardContent>
              {byeCount === 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-success rounded-full"></div>
                    <span className="text-sm">Normales Turnier-Seeding</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4">
                    Teilnehmer werden nach gespeicherter Reihenfolge spiegelbildlich gepaart. 
                    Rang 1 vs Rang 3 (erstes Match), Rang 2 vs Rang 4 (letztes Match).
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 bg-warning rounded-full"></div>
                    <span className="text-sm">Setup mit Freilosen</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-4">
                    Die {byeCount} besten Handicapper erhalten Freilose und erreichen automatisch die 2. Runde.
                    Verbleibende Teilnehmer werden spiegelbildlich gepaart (bester vs. schlechtester Handicapper).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {!canAutoSetup && (
            <Card className="border-warning/50 bg-warning/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">Auto-Setup nicht möglich</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {registrations.length === 0 && "Keine Teilnehmer registriert."}
                  {firstRoundMatches.length === 0 && "Keine Matches der ersten Runde gefunden."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button 
            onClick={setupAutoBracket} 
            disabled={loading || !canAutoSetup}
          >
            {loading ? 'Setup läuft...' : 'Auto-Setup starten'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}