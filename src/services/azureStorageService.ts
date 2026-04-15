import { BlobServiceClient } from '@azure/storage-blob';

const STORAGE_CONNECTION_STRING = import.meta.env.VITE_AZURE_STORAGE_CONNECTION_STRING || '';
const CONTAINER_NAME = 'recordings';

export async function uploadToAzureBlob(audioBlob: Blob, studentId: string, testType: string): Promise<string> {
  if (!STORAGE_CONNECTION_STRING) {
    console.error('Azure Storage connection string is missing');
    return '';
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
    const containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);

    // Create container if it doesn't exist
    // Note: In production, you might want to do this once during setup
    // but for this applet, we'll try to ensure it exists.
    // However, the user said "Manually create a container in Azure named recordings before running this."
    // So we'll assume it exists or try to create it if we have permissions.
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const blobName = `${studentId}_${testType}_${timestamp}.wav`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const arrayBuffer = await audioBlob.arrayBuffer();
    await blockBlobClient.uploadData(arrayBuffer, {
      blobHTTPHeaders: { blobContentType: 'audio/wav' }
    });

    return blockBlobClient.url;
  } catch (error) {
    console.error('Error uploading to Azure Blob:', error);
    return '';
  }
}
