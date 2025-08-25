import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Help() {
  const navigate = useNavigate();

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
            
            <h1 className="text-3xl font-bold mb-2">Hilfe</h1>
            <p className="text-muted-foreground">
              Hier finden Sie Hilfe und Anleitungen zur Nutzung der Turnierverwaltung.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Hilfe & Anleitungen</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>
                Hilfetext wird hier eingefügt, sobald er hochgeladen wurde.
              </p>
              
              <h3>Schnellstart</h3>
              <ul>
                <li>Erstellen Sie ein neues Turnier über die Turnier-Seite</li>
                <li>Konfigurieren Sie die Turniereinstellungen</li>
                <li>Verwalten Sie Anmeldungen und Brackets</li>
                <li>Führen Sie das Turnier durch und setzen Sie Ergebnisse</li>
              </ul>
              
              <h3>Weitere Hilfe</h3>
              <p>
                Für weitere Unterstützung wenden Sie sich an Ihren Administrator.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}