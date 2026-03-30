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
        <h1>URL Reader</h1>
        <p>URL을 붙여넣으면 본문을 깔끔하게 읽을 수 있습니다.</p>
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
            콘텐츠를 가져오는 중...
          </div>
        )}

        {result && !isLoading && (
          <ReaderView result={result} onClear={handleClear} />
        )}
      </main>
    </div>
  );
}
