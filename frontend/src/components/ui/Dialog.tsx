import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export default function Dialog({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  maxWidthClass = 'max-w-md',
  children,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${maxWidthClass} bg-surface-container-low rounded-xl border border-outline-variant shadow-2xl overflow-hidden flex flex-col`}
          >
            <header className="px-5 py-3.5 border-b border-outline-variant flex justify-between items-center gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-on-surface tracking-tight truncate">{title}</h3>
                {subtitle && (
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {headerRight}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="p-1.5 hover:bg-surface-container-highest rounded-lg text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary outline-none"
                >
                  <X size={15} />
                </button>
              </div>
            </header>
            <div className="p-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
