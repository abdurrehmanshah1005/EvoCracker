import { useEffect, useRef } from 'react';
import { useGameStore } from '@store/gameStore';

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const musicEnabled = useGameStore((s) => s.musicEnabled);
  const currentTrack = useGameStore((s) => s.currentTrack);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }

    // Path assumes user will place track1.mp3, track2.mp3, etc. in public/assets/music/
    audioRef.current.src = `/assets/music/track${currentTrack}.mp3`;
    
    if (musicEnabled) {
      audioRef.current.play().catch(e => console.warn('Autoplay prevented:', e));
    } else {
      audioRef.current.pause();
    }

  }, [currentTrack, musicEnabled]);

  return null; // This is a logic-only component
}
