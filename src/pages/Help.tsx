import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { useToast } from '@/hooks/use-toast';

interface HelpContent {
  id: string;
  title: string;
  content: string;
  section: string;
  updated_at: string;
}

export default function Help() {
  const navigate = useNavigate();
  const { isSystemAdmin } = useSystemAdminCheck();
  const { toast } = useToast();
  const [helpContent, setHelpContent] = useState<HelpContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<HelpContent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    section: 'general'
  });

  const fetchHelpContent = async () => {
    try {
      const { data, error } = await supabase
        .from('help_content')
        .select('*')
        .order('section', { ascending: true })
        .order('title', { ascending: true });

      if (error) throw error;
      setHelpContent(data || []);
    } catch (error) {
      console.error('Error fetching help content:', error);
      toast({
        title: "Fehler",
        description: "Hilfeinhalt konnte nicht geladen werden.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHelpContent();
  }, []);

  const handleEdit = (content: HelpContent) => {
    setEditingContent(content);
    setFormData({
      title: content.title,
      content: content.content,
      section: content.section
    });
    setEditDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingContent(null);
    setFormData({
      title: '',
      content: '',
      section: 'general'
    });
    setEditDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingContent) {
        // Update existing content
        const { error } = await supabase
          .from('help_content')
          .update({
            title: formData.title,
            content: formData.content,
            section: formData.section,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          })
          .eq('id', editingContent.id);

        if (error) throw error;
        
        toast({
          title: "Erfolg",
          description: "Hilfeinhalt wurde aktualisiert."
        });
      } else {
        // Create new content
        const { error } = await supabase
          .from('help_content')
          .insert({
            title: formData.title,
            content: formData.content,
            section: formData.section,
            updated_by: (await supabase.auth.getUser()).data.user?.id
          });

        if (error) throw error;
        
        toast({
          title: "Erfolg",
          description: "Neuer Hilfeinhalt wurde erstellt."
        });
      }
      
      setEditDialogOpen(false);
      fetchHelpContent();
    } catch (error) {
      console.error('Error saving help content:', error);
      toast({
        title: "Fehler",
        description: "Hilfeinhalt konnte nicht gespeichert werden.",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Lade Hilfeinhalt...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück
            </Button>
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2">Hilfe</h1>
                <p className="text-muted-foreground">
                  Hier finden Sie Hilfe und Anleitungen zur Nutzung der Turnierverwaltung.
                </p>
              </div>
              
              {isSystemAdmin && (
                <Button onClick={handleAdd} variant="default">
                  <Plus className="h-4 w-4 mr-2" />
                  Hilfeinhalt hinzufügen
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {helpContent.map((content) => (
              <Card key={content.id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle>{content.title}</CardTitle>
                    {isSystemAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(content)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                    {content.content}
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {helpContent.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Noch kein Hilfeinhalt verfügbar.
                  {isSystemAdmin && " Klicken Sie auf 'Hilfeinhalt hinzufügen' um zu beginnen."}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Edit/Add Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingContent ? 'Hilfeinhalt bearbeiten' : 'Neuen Hilfeinhalt hinzufügen'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Titel des Hilfeinhalts"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="section">Bereich</Label>
              <Input
                id="section"
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                placeholder="z.B. general, tournaments, registration"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="content">Inhalt *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Hilfeinhalt (Markdown wird unterstützt)"
                rows={12}
                required
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit">
                {editingContent ? 'Aktualisieren' : 'Erstellen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}