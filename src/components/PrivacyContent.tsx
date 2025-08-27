import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSystemAdminCheck } from '@/hooks/useSystemAdminCheck';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Edit, Plus, Save, X, Trash2 } from 'lucide-react';

interface PrivacyItem {
  id: string;
  section: string;
  title: string | null;
  content: string | null;
  order_position: number;
  created_at: string;
  updated_at: string;
}

export function PrivacyContent() {
  const [content, setContent] = useState<PrivacyItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const { isSystemAdmin } = useSystemAdminCheck();
  const { toast } = useToast();

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const { data, error } = await supabase
        .from('onepager_content')
        .select('*')
        .eq('section', 'privacy')
        .order('order_position', { ascending: true });

      if (error) {
        console.error('Error fetching privacy content:', error);
        return;
      }

      setContent(data || []);
    } catch (error) {
      console.error('Error fetching privacy content:', error);
    }
  };

  const handleSave = async (item: PrivacyItem) => {
    try {
      const { error } = await supabase
        .from('onepager_content')
        .update({
          title: item.title,
          content: item.content,
          order_position: item.order_position,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (error) {
        console.error('Error updating privacy content:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Speichern des Inhalts",
          variant: "destructive",
        });
        return;
      }

      setEditingId(null);
      fetchContent();
      toast({
        title: "Gespeichert",
        description: "Inhalt wurde erfolgreich aktualisiert",
      });
    } catch (error) {
      console.error('Error updating privacy content:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Speichern des Inhalts",
        variant: "destructive",
      });
    }
  };

  const handleAdd = async (newItem: Omit<PrivacyItem, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('onepager_content')
        .insert({
          section: 'privacy',
          title: newItem.title,
          content: newItem.content,
          order_position: newItem.order_position
        });

      if (error) {
        console.error('Error adding privacy content:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Hinzufügen des Inhalts",
          variant: "destructive",
        });
        return;
      }

      setShowAddForm(false);
      fetchContent();
      toast({
        title: "Hinzugefügt",
        description: "Inhalt wurde erfolgreich hinzugefügt",
      });
    } catch (error) {
      console.error('Error adding privacy content:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Hinzufügen des Inhalts",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('onepager_content')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting privacy content:', error);
        toast({
          title: "Fehler",
          description: "Fehler beim Löschen des Inhalts",
          variant: "destructive",
        });
        return;
      }

      fetchContent();
      toast({
        title: "Gelöscht",
        description: "Inhalt wurde erfolgreich gelöscht",
      });
    } catch (error) {
      console.error('Error deleting privacy content:', error);
      toast({
        title: "Fehler",
        description: "Fehler beim Löschen des Inhalts",
        variant: "destructive",
      });
    }
  };

  if (content.length === 0 && !isSystemAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Die Datenschutzerklärung wird noch bearbeitet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {content.map((item) => (
        <Card key={item.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xl">
              {editingId === item.id ? (
                <Input
                  value={item.title || ''}
                  onChange={(e) => setContent(prev => 
                    prev.map(c => c.id === item.id ? { ...c, title: e.target.value } : c)
                  )}
                  placeholder="Titel"
                />
              ) : (
                item.title
              )}
            </CardTitle>
            {isSystemAdmin && (
              <div className="flex gap-2">
                {editingId === item.id ? (
                  <>
                    <Button
                      onClick={() => handleSave(item)}
                      size="sm"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => setEditingId(null)}
                      variant="outline"
                      size="sm"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setEditingId(item.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => handleDelete(item.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {editingId === item.id ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="order">Reihenfolge</Label>
                  <Input
                    id="order"
                    type="number"
                    value={item.order_position}
                    onChange={(e) => setContent(prev => 
                      prev.map(c => c.id === item.id ? { ...c, order_position: parseInt(e.target.value) || 0 } : c)
                    )}
                  />
                </div>
                <div>
                  <Label htmlFor="content">Inhalt</Label>
                  <Textarea
                    id="content"
                    value={item.content || ''}
                    onChange={(e) => setContent(prev => 
                      prev.map(c => c.id === item.id ? { ...c, content: e.target.value } : c)
                    )}
                    rows={6}
                    placeholder="Inhalt"
                  />
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <div 
                  className="text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: item.content || '' }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {isSystemAdmin && (
        <div className="pt-6">
          {showAddForm ? (
            <PrivacyEditForm
              onSave={handleAdd}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <Button onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuen Abschnitt hinzufügen
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface PrivacyEditFormProps {
  onSave: (item: Omit<PrivacyItem, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
}

function PrivacyEditForm({ onSave, onCancel }: PrivacyEditFormProps) {
  const [formData, setFormData] = useState({
    section: 'privacy',
    title: '',
    content: '',
    order_position: 0
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuen Datenschutz-Abschnitt hinzufügen</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Titel des Abschnitts"
              required
            />
          </div>
          
          <div>
            <Label htmlFor="content">Inhalt</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              placeholder="Inhalt des Abschnitts"
              rows={6}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="order_position">Reihenfolge</Label>
            <Input
              id="order_position"
              type="number"
              value={formData.order_position}
              onChange={(e) => setFormData(prev => ({ ...prev, order_position: parseInt(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>
          
          <div className="flex gap-2">
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" />
              Speichern
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="h-4 w-4 mr-2" />
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}