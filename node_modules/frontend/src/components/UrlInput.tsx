import { useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      alert('http:// 또는 https://로 시작하는 URL을 입력하세요.');
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="url-form">
      <input
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://example.com/article"
        className="url-input"
        disabled={isLoading}
        required
      />
      <button type="submit" className="fetch-button" disabled={isLoading}>
        {isLoading ? '가져오는 중...' : '읽기'}
      </button>
    </form>
  );
}
