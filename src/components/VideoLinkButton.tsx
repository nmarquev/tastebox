import videoIcon from '@/assets/ver-video.webp';
import { cn } from '@/lib/utils';

interface VideoLinkButtonProps {
  sourceUrl?: string;
  className?: string;
}

export const VideoLinkButton = ({ sourceUrl, className }: VideoLinkButtonProps) => {
  const validUrl = /^https?:\/\//i.test(sourceUrl || '') && (() => {
    try { new URL(sourceUrl || ''); return true; } catch { return false; }
  })();

  return (
    <button
      type="button"
      className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-white/70 bg-white/90 px-1.5 text-[10px] font-semibold text-foreground shadow-sm hover:bg-white', !validUrl && 'cursor-not-allowed opacity-70', className)}
      aria-disabled={!validUrl}
      title={validUrl ? 'Ver video' : 'Agregá una URL para ver el video'}
      aria-label="Ver video"
      onClick={(event) => {
        event.stopPropagation();
        if (validUrl) window.open(sourceUrl, '_blank', 'noopener,noreferrer');
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <img src={videoIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5 object-contain" />
      Ver video
    </button>
  );
};
