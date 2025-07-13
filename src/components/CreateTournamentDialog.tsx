import { useState } from "react";
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
}

export function CreateTournamentDialog({ onTournamentCreate }: CreateTournamentDialogProps) {
  const [open, setOpen] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.course || !formData.startDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
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
      title: "Tournament Created!",
      description: `${formData.name} has been successfully created.`,
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
    setOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="premium" className="gap-2">
          <Plus className="h-4 w-4" />
          Create Tournament
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Create New Tournament
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tournament Name *</Label>
              <Input
                id="name"
                placeholder="Spring Championship 2024"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="course">Golf Course *</Label>
              <Input
                id="course"
                placeholder="Pebble Beach Golf Links"
                value={formData.course}
                onChange={(e) => handleInputChange("course", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Annual spring tournament featuring matchplay format..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maxPlayers">Max Players</Label>
              <Select value={formData.maxPlayers} onValueChange={(value) => handleInputChange("maxPlayers", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8">8 Players</SelectItem>
                  <SelectItem value="16">16 Players</SelectItem>
                  <SelectItem value="32">32 Players</SelectItem>
                  <SelectItem value="64">64 Players</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format">Tournament Format</Label>
            <Select value={formData.format} onValueChange={(value) => handleInputChange("format", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="matchplay">Matchplay</SelectItem>
                <SelectItem value="strokeplay">Stroke Play</SelectItem>
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
                  <p className="font-medium mb-1">Tournament Preview</p>
                  <p className="text-muted-foreground">
                    {formData.name || "Tournament Name"} at {formData.course || "Golf Course"}
                    {formData.startDate && ` starting ${new Date(formData.startDate).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="premium" className="flex-1">
              Create Tournament
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}