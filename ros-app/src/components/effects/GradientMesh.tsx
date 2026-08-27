'use client';

import { type FC, type ReactNode } from 'react';

export interface GradientMeshProps {
  className?: string;
  children?: ReactNode;
}

export const GradientMesh: FC<GradientMeshProps> = ({ className = '', children }) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="gradient-mesh-bg absolute inset-0 -z-10" />
      {children}
      <style jsx>{`
        .gradient-mesh-bg {
          background: linear-gradient(
            135deg,
            #d4a373 0%,
            #8B4513 50%,
            #2d2218 100%
          );
          background-size: 400% 400%;
          animation: gradientShift 12s ease infinite;
        }

        @keyframes gradientShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }
      `}</style>
    </div>
  );
};
