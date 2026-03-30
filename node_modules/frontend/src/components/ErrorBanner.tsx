interface Props {
  message: string;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="닫기">
        &times;
      </button>
    </div>
  );
}
