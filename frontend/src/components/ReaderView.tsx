import type { ReaderResult } from '../types/reader';

interface Props {
  result: ReaderResult;
  onClear: () => void;
}

export function ReaderView({ result, onClear }: Props) {
  const fetchedDate = new Date(result.fetchedAt).toLocaleString('ko-KR');

  return (
    <article className="reader-view">
      <header className="reader-header">
        <h1 className="reader-title">{result.title}</h1>
        <div className="reader-meta">
          <a href={result.url} target="_blank" rel="noopener noreferrer">
            {result.url}
          </a>
          <span>{result.wordCount.toLocaleString()}단어</span>
          <span>{fetchedDate}</span>
        </div>
        <button onClick={onClear} className="clear-button">
          &larr; 다른 URL 읽기
        </button>
      </header>
      <div className="reader-content">
        {result.content.split('\n\n').map((paragraph, idx) => (
          <p key={idx}>{paragraph.trim()}</p>
        ))}
      </div>
    </article>
  );
}
