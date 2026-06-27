/**
 * React Error Boundary — catches runtime errors anywhere in the component
 * tree below it and renders a styled fallback instead of a blank white screen.
 *
 * Usage (in main.tsx):
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // In production you'd send this to Sentry / LogRocket / etc.
    console.error('[ErrorBoundary] Caught unhandled error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;

    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface text-on-surface p-8">
        <div className="max-w-lg w-full space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-error/10 rounded-xl flex items-center justify-center text-error flex-shrink-0">
              <AlertTriangle size={22} className="stroke-[2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-primary" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary">SyncForge</span>
              </div>
              <h1 className="text-lg font-bold text-on-surface tracking-tight font-sans leading-tight">
                Something went wrong
              </h1>
            </div>
          </div>

          {/* Error panel */}
          <div className="bg-surface-container-low border border-error/20 rounded-xl overflow-hidden">
            <div className="px-4 py-2 bg-error/8 border-b border-error/15">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-error">
                Runtime Exception
              </span>
            </div>
            <div className="p-4">
              <p className="text-xs font-mono text-error break-words">
                {error?.name}: {error?.message}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-lg shadow-primary/10 cursor-pointer active:scale-[0.98]"
            >
              <RefreshCw size={13} className="stroke-[2.5]" />
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer active:scale-[0.98] border border-outline-variant"
            >
              <RefreshCw size={13} className="stroke-[2.5]" />
              Full Reload
            </button>
          </div>

          <p className="text-center text-[10px] text-outline font-mono">
            SyncForge Node SF-902 • Error Boundary Active
          </p>
        </div>
      </div>
    );
  }
}
