import { useState, useCallback, useMemo } from 'react';
import { UrlInput } from './components/UrlInput';
import { ErrorBanner } from './components/ErrorBanner';
import { fetchUrlContent } from './api/readerApi';
import type { ReaderResult } from './types/reader';
import './App.css';

const PAPER_TITLES = [
  "Asymptotic Convergence of Stochastic Gradient Descent in Non-Convex Optimization Landscapes",
  "Topological Invariants in Quantum Field Theory: A Categorical Approach",
  "Bayesian Inference for Sparse High-Dimensional Regression with Adaptive Priors",
  "Spectral Graph Theory and Its Applications to Manifold Learning",
  "Causal Inference Under Structural Equation Models with Hidden Confounders",
  "Geometric Deep Learning on Riemannian Manifolds via Equivariant Networks",
  "Thermodynamic Limits of Neural Network Generalization in the Teacher-Student Model",
  "Variational Autoencoders and the Geometry of Latent Representation Spaces",
  "Renormalization Group Flow in Deep Neural Networks: A Statistical Mechanics Perspective",
  "Entropy-Regularized Optimal Transport for Domain Adaptation in High-Dimensional Spaces",
];

export default function App() {
  const [result, setResult] = useState<ReaderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 마운트 시 무작위 논문 제목 선택 (새로고침마다 변경)
  const randomTitle = useMemo(
    () => PAPER_TITLES[Math.floor(Math.random() * PAPER_TITLES.length)],
    [],
  );

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


  return (
    <div className="app">
      <header className="app-header">
        <div className="header-top">
          <div className="header-left">
            <span className="journal-code">JOURNAL</span>
            <h1 className="journal-title">TIMES</h1>
          </div>
          <nav className="header-nav">
            <a href="#home">Home</a>
            <a href="#browse">Browse</a>
            <a href="#authors">Authors</a>
          </nav>
        </div>
      </header>

      <main className="app-main">
        <UrlInput
          onSubmit={handleFetch}
          isLoading={isLoading}
          paperTitle={randomTitle}
          result={result}
          onClear={() => { setResult(null); setError(null); }}
        />

        {error && (
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        )}
      </main>
    </div>
  );
}
