// src/renderer/components/common/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center p-8">
          <div className="bg-dark-bg-secondary rounded-xl border border-dark-border p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-dark-error/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-dark-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-dark-text-primary mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-dark-text-tertiary mb-6">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <Button onClick={this.handleReset} variant="primary">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
