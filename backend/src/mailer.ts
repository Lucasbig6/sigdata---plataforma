/**
 * Envio de e-mails transacionais (recuperação de senha, verificação).
 * Com RESEND_API_KEY usa a API do Resend (fetch, sem dependência extra);
 * sem ela, o e-mail é escrito no log do servidor — suficiente em desenvolvimento.
 */

type Mail = { to: string; subject: string; text: string };

export const mailerConfigured = () => Boolean(process.env.RESEND_API_KEY);

export const sendMail = async (mail: Mail) => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[sigdata] e-mail (sem provedor configurado)\n  para: ${mail.to}\n  assunto: ${mail.subject}\n  ${mail.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || "SIGDATA <onboarding@resend.dev>",
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar e-mail (HTTP ${res.status}).`);
};
