import { Resend } from 'resend';

const resend = process.env['RESEND_API_KEY']
  ? new Resend(process.env['RESEND_API_KEY'])
  : null;

const twilioSid   = process.env['TWILIO_ACCOUNT_SID'];
const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
const twilioFrom  = process.env['TWILIO_FROM_NUMBER'];

const FROM_EMAIL = 'NEPCO FieldOps <noreply@nepco.jo>';

export interface NotifyRecipient {
  email: string;
  phone: string | null;
  full_name: string;
}

export interface PermitIssuedPayload {
  permitId: string;
  permitType: string;
  scheduledStart: string;
  scheduledEnd: string;
  engineerName: string;
  recipients: NotifyRecipient[];
}

export interface PermitWithdrawnPayload {
  permitId: string;
  withdrawalReason: string;
  recipients: NotifyRecipient[];
}

export async function notifyPermitIssued(payload: PermitIssuedPayload): Promise<void> {
  const { permitType, scheduledStart, scheduledEnd, engineerName, recipients } = payload;

  const start = new Date(scheduledStart).toLocaleString('en-JO', { timeZone: 'Asia/Amman' });
  const end   = new Date(scheduledEnd).toLocaleString('en-JO', { timeZone: 'Asia/Amman' });

  const subject = `Work Permit Issued — ${permitType.replace(/_/g, ' ')}`;
  const body =
    `You have been assigned to a work permit.\n\n` +
    `Type:      ${permitType.replace(/_/g, ' ')}\n` +
    `Issued by: ${engineerName}\n` +
    `Start:     ${start}\n` +
    `End:       ${end}\n\n` +
    `Open the NEPCO FieldOps mobile app to review and confirm your participation.`;

  await dispatch(recipients, subject, body);
}

export async function notifyPermitWithdrawn(payload: PermitWithdrawnPayload): Promise<void> {
  const { withdrawalReason, recipients } = payload;

  const subject = 'Work Permit Withdrawn';
  const body =
    `A work permit assigned to you has been withdrawn.\n\n` +
    `Reason: ${withdrawalReason}\n\n` +
    `Contact your engineer if you have questions.`;

  await dispatch(recipients, subject, body);
}

async function dispatch(
  recipients: NotifyRecipient[],
  subject: string,
  body: string,
): Promise<void> {
  const tasks: Promise<void>[] = [];

  for (const r of recipients) {
    tasks.push(sendEmail(r.email, subject, body));
    if (r.phone) tasks.push(sendSms(r.phone, body));
  }

  // Fire all channels in parallel; individual failures are logged but never
  // propagate — a notification error must never fail the primary request.
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      process.stderr.write(
        JSON.stringify({ level: 'error', message: 'Notification delivery failed', reason: String(result.reason) }) + '\n',
      );
    }
  }
}

async function sendEmail(to: string, subject: string, text: string): Promise<void> {
  if (!resend) return;
  await resend.emails.send({ from: FROM_EMAIL, to, subject, text });
}

async function sendSms(to: string, body: string): Promise<void> {
  if (!twilioSid || !twilioToken || !twilioFrom) return;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: twilioFrom, Body: body }).toString(),
    },
  );

  if (!res.ok) {
    throw new Error(`Twilio SMS failed: ${res.status} ${await res.text()}`);
  }
}
