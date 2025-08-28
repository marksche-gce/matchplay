import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/golf-hero.jpg";

export function useHeaderImage() {
  const [headerImageUrl, setHeaderImageUrl] = useState<string>(heroImage);
  const [headerVideoUrl, setHeaderVideoUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchHeaderImage = async () => {
    try {
      const [imageResult, videoResult] = await Promise.all([
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'header_image_url')
          .single(),
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'header_video_url')
          .single()
      ]);

      // Handle image URL
      if (imageResult.data?.setting_value) {
        // If it's a storage URL, get the public URL
        if (imageResult.data.setting_value.startsWith('header-images/')) {
          const { data: publicUrl } = supabase.storage
            .from('header-images')
            .getPublicUrl(imageResult.data.setting_value.replace('header-images/', ''));
          
          setHeaderImageUrl(publicUrl.publicUrl);
        } else {
          // Use the setting value as-is (for default image or external URLs)
          setHeaderImageUrl(imageResult.data.setting_value.startsWith('/') ? heroImage : imageResult.data.setting_value);
        }
      }

      // Handle video URL
      if (videoResult.data?.setting_value) {
        setHeaderVideoUrl(videoResult.data.setting_value);
      } else {
        setHeaderVideoUrl('');
      }
    } catch (error) {
      console.error('Error fetching header settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateHeaderImage = async (imageUrl: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'header_image_url',
          setting_value: imageUrl
        });

      if (error) throw error;

      // Update local state
      if (imageUrl.startsWith('header-images/')) {
        const { data: publicUrl } = supabase.storage
          .from('header-images')
          .getPublicUrl(imageUrl.replace('header-images/', ''));
        
        setHeaderImageUrl(publicUrl.publicUrl);
      } else {
        setHeaderImageUrl(imageUrl);
      }

      return true;
    } catch (error) {
      console.error('Error updating header image:', error);
      return false;
    }
  };

  const updateHeaderVideo = async (videoUrl: string) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          setting_key: 'header_video_url',
          setting_value: videoUrl
        });

      if (error) throw error;

      setHeaderVideoUrl(videoUrl);
      return true;
    } catch (error) {
      console.error('Error updating header video:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchHeaderImage();
  }, []);

  return {
    headerImageUrl,
    headerVideoUrl,
    loading,
    updateHeaderImage,
    updateHeaderVideo,
    refetch: fetchHeaderImage
  };
}