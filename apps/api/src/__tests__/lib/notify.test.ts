import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockEmailSend = vi.fn().mockResolvedValue({ data: { id: 'email-1' }, error: null });
const MockResend = vi.fn().mockImplementation(() => ({ emails: { send: mockEmailSend } }));

vi.mock('resend', () => ({ Resend: MockResend }));

process.env['RESEND_API_KEY']       = 'test-resend-key';
process.env['TWILIO_ACCOUNT_SID']   = 'ACtest';
process.env['TWILIO_AUTH_TOKEN']    = 'test-token';
process.env['TWILIO_FROM_NUMBER']   = '+10000000000';

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  text: vi.fn().mockResolvedValue(''),
}) as unknown as typeof fetch;

const { notifyPermitIssued, notifyPermitWithdrawn, notifyReportReady } =
  await import('../../lib/notify');

const recipient = { email: 'driver@nepco.jo', phone: '+9621234567', full_name: 'Ali Hassan' };
const recipientNoPhone = { email: 'eng@nepco.jo', phone: null, full_name: 'Sara Khalil' };

beforeEach(() => {
  vi.clearAllMocks();
  mockEmailSend.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true, status: 200, text: vi.fn().mockResolvedValue(''),
  });
});

describe('notifyPermitIssued', () => {
  const payload = {
    permitId: 'permit-1',
    permitType: 'high_voltage',
    scheduledStart: '2026-05-01T08:00:00.000Z',
    scheduledEnd: '2026-05-01T17:00:00.000Z',
    engineerName: 'Ahmad Khaleel',
    recipients: [recipient],
  };

  it('sends an email to each recipient', async () => {
    await notifyPermitIssued(payload);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'driver@nepco.jo' })
    );
  });

  it('sends an SMS to recipients with a phone number', async () => {
    await notifyPermitIssued(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not send SMS when recipient has no phone', async () => {
    await notifyPermitIssued({ ...payload, recipients: [recipientNoPhone] });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends to multiple recipients independently', async () => {
    await notifyPermitIssued({ ...payload, recipients: [recipient, recipientNoPhone] });
    expect(mockEmailSend).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(1); // only one has phone
  });

  it('does not throw when email delivery fails', async () => {
    mockEmailSend.mockRejectedValueOnce(new Error('Resend network error'));
    await expect(notifyPermitIssued(payload)).resolves.toBeUndefined();
  });

  it('does not throw when SMS delivery fails', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false, status: 429, text: vi.fn().mockResolvedValue('rate limited'),
    });
    await expect(notifyPermitIssued(payload)).resolves.toBeUndefined();
  });
});

describe('notifyPermitWithdrawn', () => {
  const payload = {
    permitId: 'permit-2',
    withdrawalReason: 'Safety hazard detected on site',
    recipients: [recipient],
  };

  it('sends withdrawal email to all recipients', async () => {
    await notifyPermitWithdrawn(payload);
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'driver@nepco.jo' })
    );
  });

  it('sends withdrawal SMS to recipients with phone', async () => {
    await notifyPermitWithdrawn(payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('handles empty recipients list gracefully', async () => {
    await expect(notifyPermitWithdrawn({ ...payload, recipients: [] })).resolves.toBeUndefined();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});

describe('notifyReportReady', () => {
  const payload = {
    reportId: 'report-1',
    cadence: 'monthly',
    periodStart: '2026-04-01T00:00:00.000Z',
    periodEnd: '2026-04-30T23:59:59.000Z',
    pdfUrl: 'https://r2.example.com/reports/2026/monthly/RPT-report-1.pdf',
    recipientEmails: ['ceo@nepco.jo', 'ops@nepco.jo'],
  };

  it('sends report email to all recipient addresses', async () => {
    await notifyReportReady(payload);
    expect(mockEmailSend).toHaveBeenCalledTimes(2);
    expect(mockEmailSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'ceo@nepco.jo' }));
    expect(mockEmailSend).toHaveBeenCalledWith(expect.objectContaining({ to: 'ops@nepco.jo' }));
  });

  it('includes the PDF URL in the email body', async () => {
    await notifyReportReady(payload);
    const call = mockEmailSend.mock.calls[0]?.[0] as { text: string };
    expect(call.text).toContain(payload.pdfUrl);
  });

  it('does nothing when recipient list is empty', async () => {
    await notifyReportReady({ ...payload, recipientEmails: [] });
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('does not throw when a delivery fails', async () => {
    mockEmailSend.mockRejectedValueOnce(new Error('Resend error'));
    await expect(notifyReportReady(payload)).resolves.toBeUndefined();
  });
});
