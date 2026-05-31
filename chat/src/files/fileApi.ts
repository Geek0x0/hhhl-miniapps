import type { DriveFile } from '@/shared/types';
import type { TokenProvider } from '@/api/endpointTypes';
import { normalizeDriveFile } from '@/shared/driveFile';

export interface FileApiClient {
  uploadFile(formData: FormData, onProgress?: (progress: number) => void): Promise<DriveFile>;
  tokenProvider: TokenProvider;
}

export function createFileApi(client: FileApiClient) {
  return {
    upload: async (file: File, onProgress?: (progress: number) => void) => {
      const formData = new FormData();
      const token = client.tokenProvider();

      if (token != null && token !== '') {
        formData.set('i', token);
      }

      formData.set('force', 'true');
      formData.set('file', file);
      formData.set('name', file.name);

      const uploaded = await client.uploadFile(formData, onProgress);
      return normalizeDriveFile(uploaded) ?? uploaded;
    },
  };
}
