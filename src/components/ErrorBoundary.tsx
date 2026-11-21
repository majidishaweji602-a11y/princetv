import { Component, type ReactNode } from 'react';
import { reportError } from '../lib/report';

export class ErrorBoundary extends Component<{ children: ReactNode; inline?: boolean }, { err?: Error }> {
  state: { err?: Error } = {};
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { reportError(err.message, 'render'); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className={this.props.inline ? 'p-6' : 'grid min-h-screen place-items-center p-6'}>
        <div className="card max-w-md p-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="mt-2 text-lg font-bold">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted">This section crashed, but the rest of STARR FLIX is fine.</p>
          <button className="btn-primary mt-4" onClick={() => this.setState({ err: undefined })}>Try again</button>
        </div>
      </div>
    );
  }
}
