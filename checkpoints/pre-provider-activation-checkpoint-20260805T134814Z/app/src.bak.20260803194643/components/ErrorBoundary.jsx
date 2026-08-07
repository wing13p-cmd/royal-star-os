import { Component } from 'react';
import { logRuntimeError } from '../utils/errorLogger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Module unavailable' };
  }

  componentDidCatch(error, errorInfo) {
    logRuntimeError('ErrorBoundary', error);
    console.error(errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111111', color: '#f2c500', padding: 24 }}>
          <div style={{ maxWidth: 560, width: '100%', border: '1px solid #f2c500', padding: 24, borderRadius: 12, background: '#1a1400' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Module unavailable</h2>
            <p style={{ margin: '0 0 12px', color: '#f7f2d0' }}>This module encountered an error and could not be displayed. Your saved data has not been deleted.</p>
            <p style={{ margin: '0 0 16px', color: '#f7f2d0' }}>{this.state.message}</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" onClick={this.handleRetry} style={{ background: '#f2c500', color: '#111111', border: 'none', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Retry Module</button>
              <button type="button" onClick={() => window.location.reload()} style={{ background: 'transparent', color: '#f2c500', border: '1px solid #f2c500', padding: '10px 14px', cursor: 'pointer', fontWeight: 700 }}>Return to Command Center</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
