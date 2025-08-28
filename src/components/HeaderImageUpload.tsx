import { useState } from "react";
import { Upload, Image, Trash2, Save, Video } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useHeaderImage } from "@/hooks/useHeaderImage";

export function HeaderImageUpload() {
  const { headerImageUrl, headerVideoUrl, updateHeaderImage, updateHeaderVideo, refetch } = useHeaderImage();
  const [uploading, setUploading] = useState(false);
  const [externalUrl, setExternalUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[HeaderImageUpload] Selected file:', {
      name: file.name,
      type: file.type,
      size: file.size,
    });

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `header-${Date.now()}.${fileExt}`;
      console.log('[HeaderImageUpload] Uploading to storage bucket header-images:', fileName);

      const { error: uploadError } = await supabase.storage
        .from('header-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Update the setting to use the uploaded image
      const success = await updateHeaderImage(`header-images/${fileName}`);
      
      if (success) {
        toast({
          title: "Header image updated",
          description: "The header image has been successfully updated.",
        });
        await refetch();
      } else {
        throw new Error("Failed to update header image setting");
      }
    } catch (error: any) {
      console.error('Error uploading header image:', error);
      toast({
        title: "Upload fehlgeschlagen",
        description: error?.message ? `Fehler: ${error.message}` : "Das Bild konnte nicht hochgeladen werden.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleExternalUrl = async () => {
    if (!externalUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL.",
        variant: "destructive"
      });
      return;
    }

    const success = await updateHeaderImage(externalUrl);
    
    if (success) {
      toast({
        title: "Header image updated",
        description: "The header image has been successfully updated.",
      });
      setExternalUrl("");
      await refetch();
    } else {
      toast({
        title: "Update failed",
        description: "Failed to update the header image. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleVideoUrl = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid video URL.",
        variant: "destructive"
      });
      return;
    }

    const success = await updateHeaderVideo(videoUrl);
    
    if (success) {
      toast({
        title: "Header video updated",
        description: "The header video has been successfully updated.",
      });
      setVideoUrl("");
      await refetch();
    } else {
      toast({
        title: "Update failed",
        description: "Failed to update the header video. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetToDefault = async () => {
    const imageSuccess = await updateHeaderImage('/src/assets/golf-hero.jpg');
    const videoSuccess = await updateHeaderVideo('');
    
    if (imageSuccess && videoSuccess) {
      toast({
        title: "Header reset",
        description: "The header has been reset to default.",
      });
      await refetch();
    } else {
      toast({
        title: "Reset failed",
        description: "Failed to reset the header. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="h-5 w-5" />
          Header Media Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Media Preview */}
        <div className="space-y-2">
          <Label>Current Header Media</Label>
          <div className="relative h-32 w-full rounded-lg overflow-hidden border">
            {headerVideoUrl ? (
              <VideoPlayer 
                url={headerVideoUrl}
                className="w-full h-full"
                autoplay={true}
                muted={true}
              />
            ) : (
              <img 
                src={headerImageUrl} 
                alt="Current header" 
                className="w-full h-full object-cover"
              />
            )}
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label htmlFor="file-upload">Upload New Image</Label>
          <div className="flex items-center gap-2">
            <Input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="flex-1"
            />
            <Button disabled={uploading} variant="outline" asChild>
              <label htmlFor="file-upload" className="cursor-pointer flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? "Uploading..." : "Datei auswählen"}
              </label>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Supported formats: JPG, PNG, WebP. Max size: 5MB.
          </p>
        </div>

        {/* External Image URL */}
        <div className="space-y-2">
          <Label htmlFor="external-url">Or use external image URL</Label>
          <div className="flex items-center gap-2">
            <Input
              id="external-url"
              type="url"
              placeholder="https://example.com/image.jpg"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleExternalUrl} variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>

        {/* Video URL */}
        <div className="space-y-2">
          <Label htmlFor="video-url">Header Video (MP4, YouTube, Vimeo)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="video-url"
              type="url"
              placeholder="https://youtube.com/watch?v=... oder https://example.com/video.mp4"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleVideoUrl} variant="outline">
              <Video className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Videos will play automatically and replace the header image when set.
          </p>
        </div>

        {/* Reset to Default */}
        <div className="pt-4 border-t">
          <Button 
            onClick={resetToDefault} 
            variant="outline"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Reset to Default (Remove Video)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}