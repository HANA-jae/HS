export interface ReaderResult {
  url: string;
  title: string;
  content: string;
  wordCount: number;
  fetchedAt: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}
