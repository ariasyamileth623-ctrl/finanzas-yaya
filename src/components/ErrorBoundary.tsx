import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  isQuotaError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public declare readonly props: Readonly<Props>;
  public state: State = {
    hasError: false,
    errorMessage: '',
    isQuotaError: false,
  };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(error: Error): State {
    const raw = error?.message || 'Ocurrió un error inesperado.';
    let displayMessage = raw;
    let isQuotaError = raw.toLowerCase().includes('quota exceeded');

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        displayMessage = parsed.error;
        isQuotaError = displayMessage.toLowerCase().includes('quota exceeded');
      }
    } catch {
      // Keep plain message
    }

    return {
      hasError: true,
      errorMessage: displayMessage,
      isQuotaError,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0b0b14] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card rounded-[2rem] p-8 border border-rose-500/20 text-center space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold text-white">
                {this.state.isQuotaError
                  ? 'Límite diario de base de datos alcanzado'
                  : 'Algo salió mal'}
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                {this.state.isQuotaError
                  ? 'Se alcanzó la cuota gratuita diaria de Firestore. La cuota se restablece al día siguiente.'
                  : this.state.errorMessage}
              </p>
            </div>
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 px-6 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-display font-bold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <RotateCcw size={16} />
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
