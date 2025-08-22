import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getRoundDisplayName, calculateTotalRounds } from '@/lib/tournamentUtils';

// Helpers to convert between ISO and input[type="datetime-local"] values
const toInputValue = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
};

const toISOFromLocal = (local?: string) => {
  if (!local) return '';
  // Convert from datetime-local format to ISO string
  const d = new Date(local);
  // Check if the date is valid
  if (isNaN(d.getTime())) {
    console.error('Invalid date format:', local);
    return '';
  }
  return d.toISOString();
};
interface Tournament {
  id: string;
  name: string;
  max_players: number;
  max_rounds: number;
}

interface RoundDeadline {
  id?: string;
  tournament_id: string;
  round_number: number;
  closing_date: string;
}

interface RoundScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: Tournament;
  onSuccess?: () => void;
}

export function RoundScheduleDialog({ 
  open, 
  onOpenChange, 
  tournament,
  onSuccess 
}: RoundScheduleDialogProps) {
  const [deadlines, setDeadlines] = useState<RoundDeadline[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && tournament) {
      fetchRoundDeadlines();
    }
  }, [open, tournament]);

  const fetchRoundDeadlines = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('round_deadlines')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('round_number');

      if (error) throw error;

      // Create initial deadlines for all rounds if none exist
      const totalRounds = calculateTotalRounds(tournament.max_players);
      const normalizedData = (data || []).map(d => ({
        ...d,
        closing_date: d.closing_date ? toInputValue(d.closing_date) : ''
      }));
      const existingRounds = normalizedData.map(d => d.round_number);
      const missingRounds = Array.from({ length: totalRounds }, (_, i) => i + 1)
        .filter(round => !existingRounds.includes(round));

      const allDeadlines = [
        ...normalizedData,
        ...missingRounds.map(round => ({
          tournament_id: tournament.id,
          round_number: round,
          closing_date: ''
        }))
      ].sort((a, b) => a.round_number - b.round_number);

      setDeadlines(allDeadlines);
    } catch (error) {
      console.error('Error fetching round deadlines:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Laden der Runden-Deadlines.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeadlineChange = (roundNumber: number, date: string) => {
    setDeadlines(prev => prev.map(deadline => 
      deadline.round_number === roundNumber 
        ? { ...deadline, closing_date: date }
        : deadline
    ));
  };

  const saveRoundSchedule = async () => {
    setSaving(true);
    try {
      // Filter out deadlines without dates
      const validDeadlines = deadlines.filter(d => d.closing_date && d.closing_date.trim() !== '');

      console.log('Saving deadlines:', validDeadlines);

      // Delete all existing deadlines for this tournament first
      const { error: deleteError } = await supabase
        .from('round_deadlines')
        .delete()
        .eq('tournament_id', tournament.id);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw deleteError;
      }

      // Insert all valid deadlines
      if (validDeadlines.length > 0) {
        const deadlinesToInsert = validDeadlines.map(d => ({
          tournament_id: d.tournament_id,
          round_number: d.round_number,
          closing_date: toISOFromLocal(d.closing_date)
        }));

        console.log('Inserting deadlines:', deadlinesToInsert);

        const { data: insertedData, error: insertError } = await supabase
          .from('round_deadlines')
          .insert(deadlinesToInsert)
          .select();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }

        console.log('Successfully inserted deadlines:', insertedData);
      }

      toast({
        title: "Zeitplan gespeichert",
        description: `Runden-Deadlines wurden erfolgreich für ${validDeadlines.length} Runden gespeichert.`,
      });

      // Refresh the deadlines to show the updated data
      await fetchRoundDeadlines();
      onSuccess?.();
    } catch (error: any) {
      console.error('Error saving round schedule:', error);
      toast({
        title: "Speichern fehlgeschlagen",
        description: error.message || "Fehler beim Speichern des Runden-Zeitplans.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeDeadline = async (deadline: RoundDeadline) => {
    if (!deadline.id) {
      // Just remove from local state if not saved yet
      setDeadlines(prev => prev.map(d => 
        d.round_number === deadline.round_number 
          ? { ...d, closing_date: '' }
          : d
      ));
      return;
    }

    try {
      const { error } = await supabase
        .from('round_deadlines')
        .delete()
        .eq('id', deadline.id);

      if (error) throw error;

      setDeadlines(prev => prev.map(d => 
        d.round_number === deadline.round_number 
          ? { ...d, id: undefined, closing_date: '' }
          : d
      ));

      toast({
        title: "Deadline entfernt",
        description: "Runden-Deadline wurde entfernt.",
      });
    } catch (error: any) {
      console.error('Error removing deadline:', error);
      toast({
        title: "Entfernen fehlgeschlagen",
        description: error.message || "Fehler beim Entfernen der Deadline.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Runden-Zeitplan - {tournament.name}
          </DialogTitle>
          <DialogDescription>
            Legen Sie Deadlines für jede Turnierrunde fest. Spieler müssen ihre Spiele bis zur angegebenen Deadline abschließen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-muted rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {deadlines.map((deadline) => (
                <Card key={deadline.round_number} className="bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      {getRoundDisplayName(deadline.round_number, calculateTotalRounds(tournament.max_players))}
                      {deadline.closing_date && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeDeadline(deadline)}
                          className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                       <Label htmlFor={`round-${deadline.round_number}`}>
                        Abschluss-Deadline
                       </Label>
                      <Input
                        id={`round-${deadline.round_number}`}
                        type="datetime-local"
                        value={deadline.closing_date}
                        onChange={(e) => handleDeadlineChange(deadline.round_number, e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button 
              onClick={saveRoundSchedule}
              disabled={saving}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Speichern...' : 'Zeitplan speichern'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}