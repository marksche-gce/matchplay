import { useState, useEffect } from "react";
import { Plus, Calendar, MapPin, Users, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface Tournament {
  id: string;
  name: string;
  course: string;
  description?: string;
  startDate: string;
  endDate: string;
  maxPlayers: number;
  format: "matchplay" | "strokeplay" | "scramble";
  status: "upcoming" | "active" | "completed";
  players: string[];
}

interface CreateTournamentDialogProps {
  onTournamentCreate: (tournament: Omit<Tournament, "id" | "players">) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateTournamentDialog({ onTournamentCreate, open: externalOpen, onOpenChange: externalOnOpenChange }: CreateTournamentDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    course: "",
    description: "",
    startDate: "",
    endDate: "",
    maxPlayers: "32",
    format: "matchplay" as const
  });
  const { toast } = useToast();

  // Use external state if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen;

  // Reset form when dialog is closed externally
  useEffect(() => {
    if (externalOpen !== undefined && !externalOpen) {
      setFormData({
        name: "",
        course: "",
        description: "",
        startDate: "",
        endDate: "",
        maxPlayers: "32",
        format: "matchplay"
      });
    }
  }, [externalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.course || !formData.startDate) {
      toast({
        title: "Fehlende Informationen",
        description: "Bitte füllen Sie alle Pflichtfelder aus.",
        variant: "destructive"
      });
      return;
    }

    onTournamentCreate({
      ...formData,
      maxPlayers: parseInt(formData.maxPlayers),
      status: "upcoming"
    });

    toast({
      title: "Turnier erstellt!",
      description: `${formData.name} wurde erfolgreich erstellt.`,
    });

    setFormData({
      name: "",
      course: "",
      description: "",
      startDate: "",
      endDate: "",
      maxPlayers: "32",
      format: "matchplay"
    });
    setIsOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="premium" className="gap-2">
          <Plus className="h-4 w-4" />
          Turnier erstellen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Neues Turnier erstellen
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Turniername *</Label>
              <Input
                id="name"
                placeholder="Frühjahrs-Meisterschaft 2024"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="course">Golfplatz *</Label>
              <Input
                id="course"
                placeholder="St. Leon-Rot Golf Club"
                value={formData.course}
                onChange={(e) => handleInputChange("course", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschreibung</Label>
            <Textarea
              id="description"
              placeholder="Jährliches Frühjahrs-Turnier im Match-Play-Format..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Startdatum *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">Enddatum</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Max. Spieler</Label>
              <Select value={formData.maxPlayers} onValueChange={(value) => handleInputChange("maxPlayers", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 Spieler</SelectItem>
                  <SelectItem value="16">16 Spieler</SelectItem>
                  <SelectItem value="32">32 Spieler</SelectItem>
                  <SelectItem value="64">64 Spieler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Turnierformat</Label>
            <Select value={formData.format} onValueChange={(value) => handleInputChange("format", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matchplay">Match Play</SelectItem>
                <SelectItem value="strokeplay">Zählspiel</SelectItem>
                <SelectItem value="scramble">Scramble</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium mb-1">Turnier-Vorschau</p>
                  <p className="text-muted-foreground">
                    {formData.name || "Turniername"} im {formData.course || "Golfplatz"}
                    {formData.startDate && ` ab ${new Date(formData.startDate).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button type="submit" variant="premium" className="w-full">
              Turnier erstellen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}