import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#240F1B] text-[#FBF8F6] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl bg-[#2E1222] border border-white/15 p-8 text-center space-y-4 shadow-2xl">
            <h2 className="font-editorial text-2xl text-white">Something went wrong</h2>
            <p className="text-xs text-rose-200/80 leading-relaxed">
              We encountered a temporary issue loading boutique data. Please reload the page to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full bg-[#C45266] hover:bg-[#b04356] text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
