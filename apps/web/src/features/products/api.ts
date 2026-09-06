import type {
  CsvImportResult,
  InteractionListInput,
  ModelInspection,
  ProductDetail,
  ProductDraftInput,
  ProductFilterInput,
  ProductListResponse,
  ProductUpdateInput,
  SupplierStatsResponse,
} from '@3dsfera/shared';
import { api, ApiError } from '../../api/client.js';

/** Server-side echo of what it found inside the uploaded model. */
export interface UploadAccepted {
  jobId: string;
  inspection: Pick<
    ModelInspection,
    'triangles' | 'drawnTriangles' | 'materials' | 'textures' | 'animations'
  >;
}

const BASE = '/api/supplier/products';

function query(filter: Partial<ProductFilterInput>): string {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.category) params.set('category', filter.category);
  if (filter.search) params.set('search', filter.search);
  if (filter.cursor) params.set('cursor', filter.cursor);
  if (filter.limit) params.set('limit', String(filter.limit));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

/**
 * Uploads through XMLHttpRequest rather than fetch: a 50 MB model deserves a
 * progress bar, and fetch still cannot report upload progress in Safari.
 */
async function uploadFile<T>(
  path: string,
  file: File | Blob,
  filename: string,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const form = new FormData();
  form.append('file', file, filename);

  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', path);
    request.withCredentials = true;
    request.responseType = 'text';

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener('load', () => {
      let payload: unknown;
      try {
        payload = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        // A non-JSON body means the request never reached the API — a proxy
        // error page, most likely. The status code still tells the story.
        payload = null;
      }

      if (request.status >= 200 && request.status < 300) {
        resolve(payload as T);
        return;
      }

      const body = payload as {
        error?: { code?: string; message?: string; params?: Record<string, string | number> };
      } | null;
      reject(
        new ApiError({
          status: request.status,
          code: (body?.error?.code as ApiError['code']) ?? 'ERR_INTERNAL',
          message: body?.error?.message ?? `Upload failed with ${request.status}`,
          ...(body?.error?.params ? { params: body.error.params } : {}),
        }),
      );
    });

    request.addEventListener('error', () => {
      reject(new ApiError({ status: 0, code: 'ERR_NETWORK', message: 'Upload failed' }));
    });

    request.send(form);
  });
}

export const productsApi = {
  list: (filter: Partial<ProductFilterInput>) =>
    api.get<ProductListResponse>(`${BASE}${query(filter)}`),

  detail: (id: string) => api.get<ProductDetail>(`${BASE}/${id}`),

  create: (input: ProductDraftInput) => api.post<{ id: string }>(BASE, input),

  update: (id: string, input: ProductUpdateInput) =>
    api.patch<ProductDetail>(`${BASE}/${id}`, input),

  remove: (id: string) => api.delete<void>(`${BASE}/${id}`),

  uploadModel: (id: string, file: File, onProgress?: (percent: number) => void) =>
    uploadFile<UploadAccepted>(`${BASE}/${id}/model`, file, file.name, onProgress),

  uploadPreview: (id: string, blob: Blob) =>
    uploadFile<ProductDetail>(`${BASE}/${id}/preview`, blob, 'preview.png'),

  job: (id: string) =>
    api.get<Pick<ProductDetail, 'job' | 'assets' | 'availableClips'>>(`${BASE}/${id}/job`),

  setInteractions: (id: string, input: InteractionListInput) =>
    api.put<ProductDetail>(`${BASE}/${id}/interactions`, input),

  submit: (id: string) => api.post<{ status: string }>(`${BASE}/${id}/submit`),

  importCsv: (file: File) => uploadFile<CsvImportResult>(`${BASE}/import`, file, file.name),

  templateUrl: `${BASE}/template.csv`,

  stats: () => api.get<SupplierStatsResponse>('/api/supplier/stats'),
};
