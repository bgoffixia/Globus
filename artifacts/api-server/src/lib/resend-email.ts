type ResendEmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendResendEmail(
  message: ResendEmailMessage,
  idempotencyKey: string,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || !idempotencyKey.trim()) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
