"use client";

interface VideoEmbedProps {
  settings: Record<string, unknown>;
  typography?: any;
}

function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  // Direct video URL
  if (url.match(/\.(mp4|webm|ogg)$/i)) return null;
  return url;
}

export function VideoEmbedSection({ settings }: VideoEmbedProps) {
  const videoUrl = (settings.videoUrl as string) || "";
  const posterUrl = (settings.posterUrl as string) || "";
  const aspectRatio = (settings.aspectRatio as string) || "16/9";
  const autoplay = settings.autoplay === true;
  const loop = settings.loop === true;
  const muted = settings.muted !== false;

  if (!videoUrl) return null;

  const embedUrl = getEmbedUrl(videoUrl);
  const isDirectVideo = videoUrl.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="mx-auto max-w-4xl">
      {embedUrl ? (
        <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio }}>
          <iframe
            src={autoplay
              ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}autoplay=1&mute=${muted ? 1 : 0}`
              : embedUrl}
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : isDirectVideo ? (
        <video
          src={videoUrl}
          poster={posterUrl || undefined}
          autoPlay={autoplay}
          loop={loop}
          muted={muted}
          controls
          className="w-full rounded-lg"
          style={{ aspectRatio }}
        />
      ) : null}
    </div>
  );
}
