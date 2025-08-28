import { useState, useEffect } from "react";
import { Edit, Save, Plus, Trash2, Image as ImageIcon, Video } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSystemAdminCheck } from "@/hooks/useSystemAdminCheck";

interface ContentItem {
  id: string;
  section: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  order_position: number;
}

export function OnepagerContent() {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { isSystemAdmin } = useSystemAdminCheck();

  const fetchContents = async () => {
    try {
      const { data, error } = await supabase
        .from('onepager_content')
        .select('*')
        .order('order_position');

      if (error) throw error;
      setContents(data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast({
        title: "Fehler",
        description: "Inhalte konnten nicht geladen werden.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents();
  }, []);

  const handleSave = async (item: ContentItem) => {
    try {
        const { error } = await supabase
          .from('onepager_content')
          .update({
            title: item.title,
            content: item.content,
            image_url: item.image_url,
            video_url: item.video_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

      if (error) throw error;

      await fetchContents();
      setEditingItem(null);
      toast({
        title: "Erfolgreich gespeichert",
        description: "Die Änderungen wurden gespeichert.",
      });
    } catch (error) {
      console.error('Error saving content:', error);
      toast({
        title: "Fehler",
        description: "Die Änderungen konnten nicht gespeichert werden.",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async (newItem: Partial<ContentItem>) => {
    try {
        const { error } = await supabase
          .from('onepager_content')
          .insert({
            section: newItem.section,
            title: newItem.title,
            content: newItem.content,
            image_url: newItem.image_url,
            video_url: newItem.video_url,
            order_position: newItem.order_position || 999,
          });

      if (error) throw error;

      await fetchContents();
      setShowAddDialog(false);
      toast({
        title: "Erfolgreich hinzugefügt",
        description: "Der neue Inhalt wurde hinzugefügt.",
      });
    } catch (error) {
      console.error('Error adding content:', error);
      toast({
        title: "Fehler",
        description: "Der Inhalt konnte nicht hinzugefügt werden.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sind Sie sicher, dass Sie diesen Inhalt löschen möchten?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('onepager_content')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await fetchContents();
      toast({
        title: "Erfolgreich gelöscht",
        description: "Der Inhalt wurde gelöscht.",
      });
    } catch (error) {
      console.error('Error deleting content:', error);
      toast({
        title: "Fehler",
        description: "Der Inhalt konnte nicht gelöscht werden.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Lade Inhalte...</div>;
  }

  const heroContent = contents.find(c => c.section === 'hero');
  const featureContent = contents.find(c => c.section === 'feature');
  const contactContent = contents.find(c => c.section === 'contact');

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-16 relative">
        {heroContent && (
          <>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              {heroContent.title}
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              {heroContent.content}
            </p>
            {isSystemAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditingItem(heroContent)}
                className="absolute top-4 right-4"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </section>

      {/* Feature Section */}
      {featureContent && (
        <section id="feature" className="py-16 relative">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">
                {featureContent.title}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {featureContent.content}
              </p>
            </div>
            <div className="relative">
              {featureContent.video_url ? (
                <VideoPlayer 
                  url={featureContent.video_url}
                  className="w-full h-80 rounded-lg shadow-golf"
                />
              ) : (
                <img
                  src={featureContent.image_url || '/src/assets/golf-hero.jpg'}
                  alt="Golf Tournament Management"
                  className="w-full h-80 object-cover rounded-lg shadow-golf"
                />
              )}
            </div>
          </div>
          {isSystemAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(featureContent)}
              className="absolute top-4 right-4"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </section>
      )}

      {/* Contact Section */}
      {contactContent && (
        <section id="contact" className="py-16 bg-muted/30 rounded-lg relative">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              {contactContent.title}
            </h2>
            <div className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {contactContent.content?.split('\n').map((line, index) => {
                // Check if the line contains an email address
                const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
                const parts = line.split(emailRegex);
                
                return (
                  <p key={index} className="mb-2 last:mb-0">
                    {parts.map((part, partIndex) => {
                      if (emailRegex.test(part)) {
                        return (
                          <a
                            key={partIndex}
                            href={`mailto:${part}`}
                            className="text-primary hover:underline"
                          >
                            {part}
                          </a>
                        );
                      }
                      return part;
                    })}
                  </p>
                );
              })}
            </div>
          </div>
          {isSystemAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingItem(contactContent)}
              className="absolute top-4 right-4"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}
        </section>
      )}

      {/* Admin Controls */}
      {isSystemAdmin && (
        <div className="flex justify-center space-x-4 pt-8">
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Neuen Inhalt hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neuen Inhalt hinzufügen</DialogTitle>
              </DialogHeader>
              <ContentEditForm
                onSave={handleAdd}
                onCancel={() => setShowAddDialog(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Inhalt bearbeiten</DialogTitle>
            </DialogHeader>
            <ContentEditForm
              item={editingItem}
              onSave={handleSave}
              onCancel={() => setEditingItem(null)}
              onDelete={() => handleDelete(editingItem.id)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface ContentEditFormProps {
  item?: ContentItem;
  onSave: (item: ContentItem | Partial<ContentItem>) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

function ContentEditForm({ item, onSave, onCancel, onDelete }: ContentEditFormProps) {
  const [formData, setFormData] = useState({
    section: item?.section || '',
    title: item?.title || '',
    content: item?.content || '',
    image_url: item?.image_url || '',
    video_url: item?.video_url || '',
    order_position: item?.order_position || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (item) {
      onSave({ ...item, ...formData });
    } else {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="section">Sektion</Label>
        <Input
          id="section"
          value={formData.section}
          onChange={(e) => setFormData({ ...formData, section: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="title">Titel</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="content">Inhalt</Label>
        <Textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          rows={4}
        />
      </div>
      <div>
        <Label htmlFor="image_url">Bild URL</Label>
        <Input
          id="image_url"
          value={formData.image_url}
          onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <div>
        <Label htmlFor="video_url">Video URL (MP4, YouTube, Vimeo)</Label>
        <Input
          id="video_url"
          value={formData.video_url}
          onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
          placeholder="https://youtube.com/watch?v=... oder https://example.com/video.mp4"
        />
      </div>
      <div>
        <Label htmlFor="order_position">Reihenfolge</Label>
        <Input
          id="order_position"
          type="number"
          value={formData.order_position}
          onChange={(e) => setFormData({ ...formData, order_position: parseInt(e.target.value) })}
        />
      </div>
      <div className="flex justify-between space-x-2">
        <div className="space-x-2">
          <Button type="submit">
            <Save className="h-4 w-4 mr-2" />
            Speichern
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Abbrechen
          </Button>
        </div>
        {onDelete && (
          <Button type="button" variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Löschen
          </Button>
        )}
      </div>
    </form>
  );
}