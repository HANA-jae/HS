import axios from 'axios';
import type { ReaderResult, ApiError } from '../types/reader';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:9001';

console.log('[API Init] BASE_URL:', BASE_URL);
console.log('[API Init] VITE_API_URL env var:', import.meta.env.VITE_API_URL);

export async function fetchUrlContent(url: string): Promise<ReaderResult> {
  try {
    const endpoint = `${BASE_URL}/reader/fetch`;
    console.log('[API] Sending request to:', endpoint);
    console.log('[API] With URL:', url);
    const response = await axios.post<ReaderResult>(endpoint, {
      url,
    });
    return response.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data as Partial<ApiError>;
      throw new Error(
        data.message ?? `Request failed with status ${err.response.status}`,
      );
    }
    throw new Error('Network error: could not reach the backend.');
  }
}
