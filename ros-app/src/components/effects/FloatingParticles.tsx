'use client';

import { type FC, useEffect, useState } from 'react';

export interface FloatingParticlesProps {
  count?: number;
  className?: string;
}

interface Particle {
  id: number;
  size: number;
  left: string;
  top: string;
  delay: string;
  duration: string;
  color: string;
}

const COFFEE_COLORS = [
  '#d4a373',
  '#8B4513',
  '#2d2218',
  '#c49a6c',
  '#a0522d',
  '#5c3317',
];

export const FloatingParticles: FC<FloatingParticlesProps> = ({
  count = 30,
  className = '',
}) => {
  // Nilai acak HANYA dibuat setelah mount. Kalau dibuat saat render,
  // markup server tidak akan pernah cocok dengan hydration pertama klien
  // (hydration mismatch) karena Math.random() berbeda di kedua sisi.
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        size: Math.random() * 20 + 8,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${Math.random() * 10 + 10}s`,
        color: COFFEE_COLORS[Math.floor(Math.random() * COFFEE_COLORS.length)],
      })),
    );
  }, [count]);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="floating-particle absolute rounded-full opacity-20"
          style={{
            width: particle.size,
            height: particle.size,
            left: particle.left,
            top: particle.top,
            backgroundColor: particle.color,
            animationDelay: particle.delay,
            animationDuration: particle.duration,
          }}
        />
      ))}
      <style jsx>{`
        .floating-particle {
          animation: float linear infinite;
        }

        @keyframes float {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
          25% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) translateX(-10px);
            opacity: 0.2;
          }
          75% {
            transform: translateY(-40px) translateX(20px);
            opacity: 0.25;
          }
          100% {
            transform: translateY(0) translateX(0);
            opacity: 0.2;
          }
        }
      `}</style>
    </div>
  );
};
