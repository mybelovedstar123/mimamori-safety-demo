import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface State {
  error: Error | null;
}

/** 画面単位の想定外エラーを捕捉し、操作を継続できるようにする */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[UI Error]', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-amber-500" />
        <p className="mt-3 font-semibold text-ink">画面の表示中にエラーが発生しました</p>
        <p className="mt-1 text-sm text-ink-soft">安否データは保持されています。再読み込みするか、別の画面へ移動してください。</p>
        <button className="mt-4 rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white" onClick={() => this.setState({ error: null })}>
          再表示する
        </button>
      </div>
    );
  }
}
