import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/golf-hero.jpg";

export function useHeaderImage() {
  const [headerImageUrl, setHeaderImageUrl] = useState<string>(heroImage);
  const [loading, setLoading] = useState(true);

  const fetchHeaderImage = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'header_image_url')
        .single();

      if (error) {
        console.error('Error fetching header image:', error);
        return;
      }

      if (data?.setting_value) {
        // If it's a storage URL, get the public URL
        if (data.setting_value.startsWith('header-images/')) {
          const { data: publicUrl } = supabase.storage
            .from('header-images')
            .getPublicUrl(data.setting_value.replace('header-images/', ''));
          
          setHeaderImageUrl(publicUrl.publicUrl);
        } else {
          // Use the setting value as-is (for default image or external URLs)
          setHeaderImageUrl(data.setting_value.startsWith('/') ? heroImage : data.setting_value);
        }
      }
    } catch (error) {
      console.error('Error fetching header image:', error);
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

  useEffect(() => {
    fetchHeaderImage();
  }, []);

  return {
    headerImageUrl,
    loading,
    updateHeaderImage,
    refetch: fetchHeaderImage
  };
}