import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSend = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

process.env['R2_ACCOUNT_ID']       = 'test-account';
process.env['R2_ACCESS_KEY_ID']    = 'test-access-key';
process.env['R2_SECRET_ACCESS_KEY']= 'test-secret-key';
process.env['R2_BUCKET_NAME']      = 'fieldops-test';
process.env['R2_PUBLIC_URL']       = 'https://pub.r2.example.com';

const { uploadToR2 } = await import('../../lib/r2');
const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');

beforeEach(() => {
  mockSend.mockClear();
  mockSend.mockResolvedValue({});
  vi.mocked(PutObjectCommand).mockClear();
});

describe('uploadToR2', () => {
  it('returns the public URL for the uploaded key', async () => {
    const url = await uploadToR2('reports/2026/monthly/RPT-abc.pdf', new Uint8Array([1, 2, 3]), 'application/pdf');
    expect(url).toBe('https://pub.r2.example.com/reports/2026/monthly/RPT-abc.pdf');
  });

  it('calls S3Client.send with a PutObjectCommand', async () => {
    await uploadToR2('test/key.pdf', new Uint8Array([0]), 'application/pdf');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledWith(expect.any(Object));
  });

  it('constructs PutObjectCommand with the correct bucket, key, body, and content type', async () => {
    const body = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    await uploadToR2('some/path.pdf', body, 'application/pdf');
    expect(vi.mocked(PutObjectCommand)).toHaveBeenCalledWith({
      Bucket: 'fieldops-test',
      Key: 'some/path.pdf',
      Body: body,
      ContentType: 'application/pdf',
    });
  });

  it('creates the S3 client with the R2 endpoint', async () => {
    expect(vi.mocked(S3Client)).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'auto',
        endpoint: 'https://test-account.r2.cloudflarestorage.com',
      })
    );
  });

  it('propagates S3 errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('S3 upload failed'));
    await expect(uploadToR2('key.pdf', new Uint8Array([0]), 'application/pdf')).rejects.toThrow('S3 upload failed');
  });
});
