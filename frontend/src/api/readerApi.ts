import axios from 'axios';
import type { ReaderResult, ApiError } from '../types/reader';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function fetchUrlContent(url: string): Promise<ReaderResult> {
  try {
    const response = await axios.post<ReaderResult>(`${BASE_URL}/reader/fetch`, {
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
