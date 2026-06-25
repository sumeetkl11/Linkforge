/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Mail, Lock, ArrowRight, Check, Github, Cpu, Fingerprint, Sparkles, Chrome } from 'lucide-react';
import { motion } from 'motion/react';

import { loginUser, createUser } from '../api';
import { User } from '../types';

interface SignInProps {
  onLogin: (user: User) => void;
}

export default function SignIn({ onLogin }: SignInProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // High performance Canvas particle animation in the left pane
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    // Particle class
    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = Math.random() * 0.4 - 0.2;
        this.speedY = Math.random() * 0.4 - 0.2;
        // Subtle blue-green cyber color palette
        const colors = ['rgba(162, 201, 255, 0.4)', 'rgba(103, 223, 112, 0.3)', 'rgba(232, 195, 88, 0.2)', 'rgba(255, 255, 255, 0.1)'];
        this.color = colors[Math.floor(Math.random() * colors.length)];
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > width) this.x = 0;
        if (this.x < 0) this.x = width;
        if (this.y > height) this.y = 0;
        if (this.y < 0) this.y = height;
      }

      draw(context: CanvasRenderingContext2D) {
        context.fillStyle = this.color;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fill();
      }
    }

    const particles: Particle[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push(new Particle());
    }

    // Connect particles near each other
    const connectParticles = (context: CanvasRenderingContext2D) => {
      const maxDistance = 90;
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dist = Math.hypot(particles[a].x - particles[b].x, particles[a].y - particles[b].y);
          if (dist < maxDistance) {
            const alpha = (1 - dist / maxDistance) * 0.15;
            context.strokeStyle = `rgba(162, 201, 255, ${alpha})`;
            context.lineWidth = 0.5;
            context.beginPath();
            context.moveTo(particles[a].x, particles[a].y);
            context.lineTo(particles[b].x, particles[b].y);
            context.stroke();
          }
        }
      }
    };

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    const animate = () => {
      ctx.fillStyle = '#0b141c';
      ctx.fillRect(0, 0, width, height);

      // Draw subtle grid overlay
      ctx.strokeStyle = 'rgba(65, 71, 82, 0.08)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw particles and lines
      particles.forEach((p) => {
        p.update();
        p.draw(ctx);
      });
      connectParticles(ctx);

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      if (isSignUp) {
        const username = email.split('@')[0];
        const newUser: User = {
          id: `u-${Date.now()}`,
          name: username.charAt(0).toUpperCase() + username.slice(1),
          email: email.trim().toLowerCase(),
          role: 'Developer',
          status: 'Online',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
          commits: 0,
          reviews: 0,
          proficiency: 0,
          username
        };
        const createdUser = await createUser(newUser);
        setIsSubmitting(false);
        onLogin(createdUser);
      } else {
        const user = await loginUser(email);
        setIsSubmitting(false);
        onLogin(user);
      }
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message);
    }
  };

  const handleQuickLogin = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const user = await loginUser('alex.r@syncforge.io');
      setIsSubmitting(false);
      onLogin(user);
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg((err as Error).message);
    }
  };

  const bullets = [
    'Integrated WebGL Shaders & GPU pipelines.',
    'Atmospheric UI token system with local state caching.',
    'Plug-and-play Socket.io client templates.',
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface">
      {/* LEFT PANEL: 60% Width Branding Presentation */}
      <div className="hidden lg:flex lg:w-3/5 h-full relative flex-col justify-between p-12 overflow-hidden border-r border-outline-variant/60">
        <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

        {/* Header Branding */}
        <div className="z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
            <Terminal size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight leading-none font-sans">SyncForge</h1>
            <p className="text-[10px] uppercase tracking-widest text-primary font-mono mt-1 font-bold">Engineering Environment</p>
          </div>
        </div>

        {/* Slogan Presentation & Feature cards */}
        <div className="z-10 max-w-xl space-y-8 my-auto">
          <div className="space-y-4">
            <span className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-bold text-primary uppercase tracking-widest font-mono inline-flex items-center gap-1.5">
              <Sparkles size={10} className="animate-spin-slow" />
              <span>v2.4 Production Node</span>
            </span>
            <h2 className="text-4xl xl:text-5xl font-black text-on-surface tracking-tight leading-none font-sans">
              High-performance workspace for developer teams.
            </h2>
            <p className="text-on-surface-variant text-sm font-sans leading-relaxed">
              SyncForge centralizes compilation telemetry, bento boards, sprint timeline analytics, and team chats into an atmospheric, eye-safe high contrast workspace.
            </p>
          </div>

          {/* Glowing features list */}
          <div className="space-y-3.5">
            {bullets.map((bullet, i) => (
              <div key={i} className="flex items-center gap-3 bg-surface-container-low/60 border border-outline-variant/40 p-4 rounded-xl backdrop-blur-md hover:border-primary/30 transition-colors">
                <div className="w-5 h-5 bg-secondary/15 rounded-full flex items-center justify-center text-secondary">
                  <Check size={11} className="stroke-[3]" />
                </div>
                <span className="text-xs text-on-surface font-sans font-medium">{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="z-10 flex justify-between text-[10px] font-mono text-outline font-medium border-t border-outline-variant/30 pt-4">
          <span>SECURE SHELL v2.4</span>
          <span>LATENCY: 1.2ms (SSL VERIFIED)</span>
        </div>
      </div>

      {/* RIGHT PANEL: 40% Width Login Form Terminal */}
      <div className="w-full lg:w-2/5 h-full flex flex-col justify-between p-8 sm:p-12 md:p-16 bg-surface-container-lowest relative z-10">
        
        {/* Mobile Header Logo */}
        <div className="flex lg:hidden items-center gap-2 mb-6">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <Terminal size={18} />
          </div>
          <span className="font-bold text-on-surface text-base">SyncForge</span>
        </div>

        <div className="my-auto max-w-sm w-full mx-auto space-y-8">
          {/* Header titles */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight font-sans">Enter the Forge</h2>
            <p className="text-on-surface-variant text-xs font-sans">Authenticate developer credentials to start compiling.</p>
          </div>

          {/* Social Auth triggers */}
          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={() => window.location.href = 'http://localhost:5000/api/auth/github'}
              className="flex items-center justify-center gap-2 py-2 border border-outline-variant hover:border-primary rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/20 transition-all cursor-pointer"
            >
              <Github size={14} />
              <span>GitHub</span>
            </button>
            <button 
              type="button"
              onClick={() => window.location.href = 'http://localhost:5000/api/auth/google'}
              className="flex items-center justify-center gap-2 py-2 border border-outline-variant hover:border-primary rounded-lg text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/20 transition-all cursor-pointer"
            >
              <Chrome size={14} className="text-primary" />
              <span>Google</span>
            </button>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-outline-variant/30"></div>
            <span className="flex-shrink mx-3 text-[9px] font-bold uppercase tracking-widest text-outline font-sans">Or authenticate manually</span>
            <div className="flex-grow border-t border-outline-variant/30"></div>
          </div>

          {/* Credentials input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-error/15 border border-error/30 text-error rounded-lg text-xs font-semibold">
                {errorMsg}
              </div>
            )}
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Developer Email</label>
              <div className="relative group">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@syncforge.io"
                  className="w-full bg-surface-container-low border border-outline-variant group-focus-within:border-primary rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all focus:ring-1 focus:ring-primary focus:bg-surface-container"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-sans">Security Token</label>
                <a href="#reset" className="text-[10px] text-primary hover:underline font-semibold font-sans">Forgot Key?</a>
              </div>
              <div className="relative group">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-surface-container-low border border-outline-variant group-focus-within:border-primary rounded-lg pl-9 pr-4 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/40 outline-none transition-all focus:ring-1 focus:ring-primary focus:bg-surface-container"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-primary hover:bg-primary/95 text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-[0.98]"
              >
                {isSubmitting ? (
                  <span>{isSignUp ? 'Creating Account...' : 'Initiating Sync Session...'}</span>
                ) : (
                  <>
                    <span>{isSignUp ? 'CREATE ACCOUNT ->' : 'LOGIN'}</span>
                    {!isSignUp && <ArrowRight size={14} className="stroke-[2.5]" />}
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-xs text-primary hover:underline font-semibold font-sans bg-transparent border-none cursor-pointer focus:outline-none"
                >
                  {isSignUp ? 'Already have an account? Log In' : 'New to SyncForge? Sign Up'}
                </button>
              </div>

              {/* <button
                type="button"
                onClick={handleQuickLogin}
                className="w-full py-2.5 px-4 bg-secondary-container text-on-secondary-container font-bold text-xs uppercase tracking-wider rounded-lg flex items-center justify-center gap-2 transition-all hover:bg-secondary-container/90 active:scale-[0.98] cursor-pointer"
              >
                <Cpu size={14} className="text-secondary" />
                <span>Bypass / Quick Demo Login</span>
              </button> */}
            </div>
          </form>
        </div>

        {/* Footer info right pane */}
        <div className="text-center text-[10px] font-mono text-outline font-medium mt-6">
          <span>SyncForge Node SF-902 • Secure Environment</span>
        </div>
      </div>
    </div>
  );
}
