import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  volume: number; // 0 to 1
  isActive: boolean;
}

export const Visualizer: React.FC<VisualizerProps> = ({ volume, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    
    // Smooth volume transition
    let currentRadius = 50;
    const targetBaseRadius = 50;
    const maxRadiusExpansion = 100;

    const render = () => {
      // Resize canvas if needed
      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
      }

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isActive) {
        // Idle State - simple pulsing dot
        const time = Date.now() / 1000;
        const idleRadius = 20 + Math.sin(time * 2) * 5;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, idleRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#cbd5e1'; // Slate 300 (lighter gray for white bg)
        ctx.fill();
        
        animationId = requestAnimationFrame(render);
        return;
      }

      // Active State - React to volume
      const targetRadius = targetBaseRadius + (volume * maxRadiusExpansion);
      // Lerp for smoothness
      currentRadius += (targetRadius - currentRadius) * 0.2;

      // Draw Outer Glow
      const gradient = ctx.createRadialGradient(centerX, centerY, currentRadius * 0.5, centerX, centerY, currentRadius * 2);
      gradient.addColorStop(0, 'rgba(255, 89, 78, 0.8)'); // #ff594e 80%
      gradient.addColorStop(0.5, 'rgba(255, 89, 78, 0.3)'); // #ff594e 30%
      gradient.addColorStop(1, 'rgba(255, 89, 78, 0)');

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 2, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff594e'; // Accent Color
      ctx.fill();
      
      // Draw Inner Ripple (decorative)
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 0.6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [volume, isActive]);

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-64 sm:h-96" />
    </div>
  );
};