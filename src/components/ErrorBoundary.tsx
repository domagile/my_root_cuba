import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Uncaught error:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0F0F0F] text-[#E5E5E5] flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-[#1A1A1A] border border-[#333333] p-6 rounded-2xl max-w-lg shadow-2xl">
            <h2 className="text-xl font-bold text-[#B88E3E] mb-2">Сталася помилка у додатку</h2>
            <p className="text-sm text-[#8C8C8C] mb-4">
              {this.state.error?.message || 'Невідома помилка під час рендерингу.'}
            </p>
            <button
              onClick={() => {
                try {
                  localStorage.clear();
                } catch (e) {}
                window.location.reload();
              }}
              className="px-4 py-2 bg-[#B88E3E] hover:bg-[#A37B30] text-[#0F0F0F] font-bold rounded-xl text-xs cursor-pointer"
            >
              Скинути локальні дані та перезавантажити
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
