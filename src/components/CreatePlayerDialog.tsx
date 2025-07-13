import { useState, useRef } from "react";
import { Plus, User, Target, Award, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Player {
  id: string;
  name: string;
  email?: string;
  handicap: number;
  wins: number;
  losses: number;
  status: "active" | "eliminated" | "champion";
}

interface CreatePlayerDialogProps {
  onPlayerCreate: (player: Omit<Player, "id">) => void;
  onBulkPlayerCreate?: (players: Omit<Player, "id">[]) => void;
  trigger?: React.ReactNode;
}

export function CreatePlayerDialog({ onPlayerCreate, onBulkPlayerCreate, trigger }: CreatePlayerDialogProps) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    handicap: "10"
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast({
        title: "Missing Information",
        description: "Player name is required.",
        variant: "destructive"
      });
      return;
    }

    const handicapValue = parseFloat(formData.handicap);
    if (isNaN(handicapValue) || handicapValue < 0 || handicapValue > 36) {
      toast({
        title: "Invalid Handicap",
        description: "Handicap must be between 0 and 36.",
        variant: "destructive"
      });
      return;
    }

    onPlayerCreate({
      name: formData.name,
      email: formData.email || undefined,
      handicap: handicapValue,
      wins: 0,
      losses: 0,
      status: "active"
    });

    toast({
      title: "Player Added!",
      description: `${formData.name} has been added to the tournament.`,
    });

    setFormData({
      name: "",
      email: "",
      handicap: "10"
    });
    setOpen(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        console.log("Starting Excel import...");
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        console.log("Sheet name:", sheetName);
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log("Raw Excel data:", jsonData);

        const players: Omit<Player, "id">[] = [];
        
        jsonData.forEach((row: any, index) => {
          console.log(`Processing row ${index}:`, row);
          const name = row.Name || row.name || row.Player || row.player;
          const email = row.Email || row.email;
          const handicap = row.Handicap || row.handicap || row.HCAP || row.hcap;
          
          console.log(`Row ${index} - Name: ${name}, Email: ${email}, Handicap: ${handicap}`);
          
          if (name) {
            const handicapValue = parseFloat(handicap) || 10;
            console.log(`Row ${index} - Parsed handicap: ${handicapValue}`);
            if (handicapValue >= 0 && handicapValue <= 36) {
              const player = {
                name: String(name),
                email: email ? String(email) : undefined,
                handicap: handicapValue,
                wins: 0,
                losses: 0,
                status: "active" as const
              };
              console.log(`Row ${index} - Adding player:`, player);
              players.push(player);
            }
          }
        });

        console.log("Final players array:", players);

        if (players.length > 0) {
          if (onBulkPlayerCreate) {
            onBulkPlayerCreate(players);
          } else {
            // If no bulk handler, add one by one
            players.forEach(player => onPlayerCreate(player));
          }
          
          toast({
            title: "Players Imported!",
            description: `Successfully imported ${players.length} players from Excel file.`,
          });
          
          setOpen(false);
        } else {
          toast({
            title: "Import Failed",
            description: "No valid players found in the Excel file. Make sure it has 'Name' and 'Handicap' columns.",
            variant: "destructive"
          });
        }
      } catch (error) {
        toast({
          title: "Import Error",
          description: "Failed to read Excel file. Please check the file format.",
          variant: "destructive"
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add New Player
          </DialogTitle>
        </DialogHeader>

        {/* Excel Import Section */}
        <div className="border rounded-lg p-4 bg-muted/30">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="font-medium">Import from Excel</span>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Upload an Excel file with columns: Name, Email (optional), Handicap
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleExcelImport}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full gap-2"
          >
            <Upload className="h-4 w-4" />
            Choose Excel File
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playerName">Player Name *</Label>
              <Input
                id="playerName"
                placeholder="Tiger Woods"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email (Optional)</Label>
              <Input
                id="email"
                type="email"
                placeholder="player@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="handicap">Handicap *</Label>
              <Input
                id="handicap"
                type="number"
                step="0.1"
                min="0"
                max="36"
                placeholder="10.5"
                value={formData.handicap}
                onChange={(e) => handleInputChange("handicap", e.target.value)}
              />
            </div>
          </div>

          {formData.name && (
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 bg-gradient-golf">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                      {getInitials(formData.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{formData.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Target className="h-3 w-3" />
                      <span>Handicap: {formData.handicap}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="success" className="flex-1">
              Add Player
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}