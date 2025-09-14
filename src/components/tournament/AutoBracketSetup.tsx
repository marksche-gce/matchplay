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

  // Mirrored seeding per user's rule:
  // 1 goes to Match 1 (slot1), 2 goes to Match M (slot2), 3 goes to Match 2 (slot2), 4 goes to Match M-1 (slot1), ...
  type Assignment = { matchIndex: number; highSeed: number; lowSeed: number; highInSlot1: boolean };

  const generateMatchAssignments = (N: number, M: number): Assignment[] => {
    const assignments: Assignment[] = [];
    for (let i = 0; i < M; i++) {
      const highSeed = i + 1;       // 1..M
      const lowSeed = N - i;        // N..(N-M+1)
      const matchIndex = (i % 2 === 0)
        ? Math.floor(i / 2) + 1       // 1, 2, 3, ... for even i
        : M - Math.floor(i / 2);      // M, M-1, ... for odd i
      // Slot-Regel: i % 4 === 0 oder 3 -> High-Seed in Slot 1, sonst in Slot 2
      const highInSlot1 = (i % 4 === 0) || (i % 4 === 3);
      assignments.push({ matchIndex, highSeed, lowSeed, highInSlot1 });
    }
    return assignments;
  };

  // Setzt Teilnehmer anhand der gespeicherten Rangliste (position) in die Matches, berücksichtigt Freilose
  const applyMirroredSeeding = async () => {
    // Nach gespeicherter Position sortieren (Rangliste)
    const participants = [...registrations].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

    const N = tournament.max_players;              // Bracket-Größe (z.B. 32)
    const M = firstRoundMatches.length;            // Anzahl Erstrunden-Matches (z.B. 16)
    const assignments = generateMatchAssignments(N, M);

    const matchUpdates: Array<{
      matchId: string;
      updateData: any;
      advanceWinner?: boolean;
      winnerId?: string | null;
    }> = [];

    for (const a of assignments) {
      // Suche Match per match_number (Fallback: by index)
      const match = firstRoundMatches.find(m => m.match_number === a.matchIndex) || firstRoundMatches[a.matchIndex - 1];
      if (!match) continue;

      const high = participants[a.highSeed - 1] ?? null; // null => Freilos
      const low = participants[a.lowSeed - 1] ?? null;    // null => Freilos

      const slot1 = a.highInSlot1 ? high : low;
      const slot2 = a.highInSlot1 ? low : high;

      const updateData: any = {};

      if (tournament.type === 'singles') {
        updateData.player1_id = slot1?.player_id ?? null;
        updateData.player2_id = slot2?.player_id ?? null;
      } else {
        updateData.team1_id = slot1?.team_id ?? null;
        updateData.team2_id = slot2?.team_id ?? null;
      }

      // Status & Gewinner bei Freilos
      if (slot1 && !slot2) {
        updateData.status = 'completed';
        if (tournament.type === 'singles') {
          updateData.winner_player_id = slot1.player_id;
        } else {
          updateData.winner_team_id = slot1.team_id;
        }
        matchUpdates.push({
          matchId: match.id,
          updateData,
          advanceWinner: true,
          winnerId: tournament.type === 'singles' ? slot1.player_id : slot1.team_id,
        });
      } else if (!slot1 && slot2) {
        updateData.status = 'completed';
        if (tournament.type === 'singles') {
          updateData.winner_player_id = slot2.player_id;
        } else {
          updateData.winner_team_id = slot2.team_id;
        }
        matchUpdates.push({
          matchId: match.id,
          updateData,
          advanceWinner: true,
          winnerId: tournament.type === 'singles' ? slot2.player_id : slot2.team_id,
        });
      } else if (slot1 && slot2) {
        updateData.status = 'scheduled';
        matchUpdates.push({ matchId: match.id, updateData });
      } else {
        updateData.status = 'pending';
        matchUpdates.push({ matchId: match.id, updateData });
      }
    }

    // Updates anwenden und Bye-Gewinner weiterleiten
    for (const update of matchUpdates) {
      await supabase
        .from('matches_new')
        .update(update.updateData)
        .eq('id', update.matchId);

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

  const setupNormalBracket = async () => {
    await applyMirroredSeeding();
  };

  const setupBracketWithByes = async (byeCount: number) => {
    // Freilose werden implizit durch leere Slots/Seeds berücksichtigt
    await applyMirroredSeeding();
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