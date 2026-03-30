import type { ReaderResult } from '../types/reader';

interface Props {
  result: ReaderResult;
  onClear: () => void;
}

export function ReaderView({ result, onClear }: Props) {
  const fetchedDate = new Date(result.fetchedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const paragraphs = result.content.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const abstractParagraph = paragraphs[0] || '';
  const fullTextParagraphs = paragraphs.slice(1);

  return (
    <article className="reader-view">
      <header className="reader-header">
        <h2 className="reader-title">{result.title}</h2>
        <div className="reader-meta">
          <span className="meta-item">
            <span className="meta-label">Source:</span>
            <a href={result.url} target="_blank" rel="noopener noreferrer" className="meta-link">
              {new URL(result.url).hostname}
            </a>
          </span>
          <span className="meta-item">
            <span className="meta-label">Words:</span>
            {result.wordCount.toLocaleString()}
          </span>
          <span className="meta-item">
            <span className="meta-label">Retrieved:</span>
            {fetchedDate}
          </span>
        </div>
      </header>

      <section className="article-section">
        <h2 className="section-title">Abstract</h2>
        <div className="abstract-box">
          <p>{abstractParagraph}</p>
        </div>
      </section>

      <section className="article-section">
        <h2 className="section-title">Full Text</h2>
        <div className="reader-content">
          {fullTextParagraphs.map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </section>

      <footer className="reader-footer">
        <button onClick={onClear} className="clear-button">
          ← Back to Search
        </button>
      </footer>
    </article>
  );
}
