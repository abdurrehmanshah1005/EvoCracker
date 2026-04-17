import { useCallback, useEffect, useRef } from 'react';
import { useGameStore } from '@store/gameStore';
import type { GameScreen } from '@store/gameStore';

/**
 * MainMenu — The first screen the player sees.
 * Stunning dark fantasy aesthetic with animated particles.
 */
export function MainMenu() {
  const setScreen = useGameStore((s) => s.setScreen);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  // Particle system for background ambiance
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      size: number;
      alpha: number;
      color: string;
      life: number;
      maxLife: number;
    }

    const particles: Particle[] = [];
    const colors = [
      'rgba(200, 168, 80, ',   // Gold
      'rgba(123, 77, 255, ',   // Purple
      'rgba(68, 136, 255, ',   // Blue
    ];

    function spawnParticle() {
      const color = colors[Math.floor(Math.random() * colors.length)];
      particles.push({
        x: Math.random() * canvas!.width,
        y: canvas!.height + 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 1.5 - 0.5,
        size: Math.random() * 3 + 1,
        alpha: Math.random() * 0.6 + 0.2,
        color,
        life: 0,
        maxLife: Math.random() * 300 + 200,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);

      // Spawn new particles
      if (particles.length < 80 && Math.random() < 0.3) {
        spawnParticle();
      }

      // Update & draw
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx += (Math.random() - 0.5) * 0.02; // Drift
        p.life++;

        const fadeIn = Math.min(p.life / 30, 1);
        const fadeOut = Math.max(0, 1 - (p.life - p.maxLife + 60) / 60);
        const currentAlpha = p.alpha * fadeIn * fadeOut;

        if (p.life > p.maxLife || currentAlpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + currentAlpha + ')';
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (currentAlpha * 0.15) + ')';
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animate();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const handleMenuClick = useCallback((screen: GameScreen) => {
    setScreen(screen);
  }, [setScreen]);

  return (
    <div className="main-menu">
      {/* Background gradient */}
      <div className="main-menu-bg" />

      {/* Animated particles */}
      <canvas ref={canvasRef} className="main-menu-particles" />

      {/* Content */}
      <div className="main-menu-content">
        {/* Decorative rune */}
        <div style={{
          fontSize: '2rem',
          opacity: 0.5,
          animation: 'float 4s ease-in-out infinite',
          marginBottom: '-8px',
        }}>
          ⚗️
        </div>

        {/* Title */}
        <h1 className="main-menu-title">
          EvoCracker
        </h1>

        {/* Subtitle */}
        <p className="main-menu-subtitle">
          The Summoner's Trial
        </p>

        {/* Divider */}
        <div style={{
          width: '200px',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, var(--gold-dark), transparent)',
          margin: '8px 0',
        }} />

        {/* Menu Buttons */}
        <div className="main-menu-buttons">
          <button
            className="btn btn-primary btn-pixel"
            onClick={() => handleMenuClick('playing')}
          >
            ⚔️ Trial Mode
          </button>

          <button
            className="btn btn-purple btn-pixel"
            onClick={() => handleMenuClick('algorithmLab')}
          >
            🧪 Algorithm Lab
          </button>

          <button
            className="btn btn-pixel"
            onClick={() => handleMenuClick('settings')}
          >
            ⚙️ Settings
          </button>
        </div>

        {/* Version */}
        <div className="main-menu-version" style={{ marginTop: '16px' }}>
          v0.1.0 — AI Research Build
        </div>
      </div>

      {/* Footer */}
      <div className="main-menu-footer">
        Press <span className="gold-text">[`]</span> during gameplay to toggle AI Analytics
      </div>
    </div>
  );
}
