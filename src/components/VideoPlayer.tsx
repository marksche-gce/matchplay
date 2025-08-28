import React from 'react';

interface VideoPlayerProps {
  url: string;
  className?: string;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  className = "w-full h-80 rounded-lg",
  autoplay = false,
  muted = true,
  controls = true
}) => {
  const getVideoType = (url: string) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    if (url.includes('.mp4') || url.includes('.webm') || url.includes('.ogg')) {
      return 'direct';
    }
    return 'unknown';
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getVimeoId = (url: string) => {
    const regExp = /(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const videoType = getVideoType(url);

  if (videoType === 'youtube') {
    const videoId = getYouTubeId(url);
    if (!videoId) return <div className={className}>Invalid YouTube URL</div>;

    const embedUrl = `https://www.youtube.com/embed/${videoId}${autoplay ? '?autoplay=1' : ''}${muted ? (autoplay ? '&mute=1' : '?mute=1') : ''}`;
    
    return (
      <iframe
        src={embedUrl}
        className={className}
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="YouTube video"
      />
    );
  }

  if (videoType === 'vimeo') {
    const videoId = getVimeoId(url);
    if (!videoId) return <div className={className}>Invalid Vimeo URL</div>;

    const embedUrl = `https://player.vimeo.com/video/${videoId}${autoplay ? '?autoplay=1' : ''}${muted ? (autoplay ? '&muted=1' : '?muted=1') : ''}`;
    
    return (
      <iframe
        src={embedUrl}
        className={className}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Vimeo video"
      />
    );
  }

  if (videoType === 'direct') {
    return (
      <video
        src={url}
        className={className}
        controls={controls}
        autoPlay={autoplay}
        muted={muted}
        preload="metadata"
      >
        Your browser does not support the video tag.
      </video>
    );
  }

  return <div className={className}>Unsupported video format</div>;
};