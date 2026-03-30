import { useState, useCallback } from 'react';
import { UrlInput } from './components/UrlInput';
import { ReaderView } from './components/ReaderView';
import { ErrorBanner } from './components/ErrorBanner';
import { fetchUrlContent } from './api/readerApi';
import type { ReaderResult } from './types/reader';
import './App.css';

export default function App() {
  const [result, setResult] = useState<ReaderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFetch = useCallback(async (url: string) => {
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const data = await fetchUrlContent(url);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleClear = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div className="header-left">
            <span className="journal-code">JAR</span>
            <h1 className="journal-title">Article Reader</h1>
          </div>
          <nav className="header-nav">
            <a href="#home">Home</a>
            <a href="#browse">Browse</a>
            <a href="#authors">Authors</a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        {!result && (
          <UrlInput onSubmit={handleFetch} isLoading={isLoading} />
        )}

        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}

        {isLoading && (
          <div className="loading-indicator" aria-live="polite">
            Loading article...
          </div>
        )}

        {result && !isLoading && (
          <ReaderView result={result} onClear={handleClear} />
        )}
      </main>
    </div>
  );
}
