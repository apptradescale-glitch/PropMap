/**
 * Client-side email parser for MBOX and EML files.
 * No APIs, no backend — everything runs in the browser.
 */

export interface ParsedEmail {
  id: string;
  subject: string;
  from: string;
  fromName: string;
  to: string;
  date: string;
  timestamp: number;
  body: string;
  bodyHtml: string;
  snippet: string;
  provider: string;
  attachments: string[];
}

// Decode quoted-printable encoding
function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, '') // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Decode base64 encoded content
function decodeBase64(str: string): string {
  try {
    return atob(str.replace(/\s/g, ''));
  } catch {
    return str;
  }
}

// Decode MIME encoded words (e.g., =?UTF-8?B?...?= or =?UTF-8?Q?...?=)
function decodeMimeWord(str: string): string {
  return str.replace(/=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi, (_, charset, encoding, text) => {
    if (encoding.toUpperCase() === 'B') {
      try {
        const decoded = atob(text);
        return new TextDecoder(charset).decode(
          new Uint8Array([...decoded].map(c => c.charCodeAt(0)))
        );
      } catch {
        return text;
      }
    } else if (encoding.toUpperCase() === 'Q') {
      return decodeQuotedPrintable(text.replace(/_/g, ' '));
    }
    return text;
  });
}

// Extract name and email from "Name <email@domain.com>" format
function parseEmailAddress(raw: string): { name: string; email: string } {
  const decoded = decodeMimeWord(raw.trim());
  const match = decoded.match(/^"?([^"<]*?)"?\s*<([^>]+)>/);
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2].trim() };
  }
  return { name: decoded, email: decoded };
}

// Generate a unique ID from email content
function generateId(subject: string, from: string, date: string): string {
  const raw = `${subject}|${from}|${date}|${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + Date.now().toString(36);
}

// Detect which provider the email came from
function detectProvider(headers: Record<string, string>, from: string): string {
  const receivedHeader = (headers['received'] || '').toLowerCase();
  const xMailer = (headers['x-mailer'] || '').toLowerCase();
  const fromLower = from.toLowerCase();

  if (fromLower.includes('@gmail.com') || receivedHeader.includes('google.com') || headers['x-gm-message-state']) {
    return 'Gmail';
  }
  if (fromLower.includes('@outlook.com') || fromLower.includes('@hotmail.com') || fromLower.includes('@live.com') || receivedHeader.includes('microsoft') || xMailer.includes('outlook')) {
    return 'Outlook';
  }
  if (fromLower.includes('@yahoo.com') || receivedHeader.includes('yahoo')) {
    return 'Yahoo';
  }
  if (fromLower.includes('@icloud.com') || fromLower.includes('@me.com') || receivedHeader.includes('apple')) {
    return 'Apple Mail';
  }
  if (fromLower.includes('@protonmail.com') || fromLower.includes('@proton.me')) {
    return 'ProtonMail';
  }
  return 'Other';
}

// Parse headers from raw email text
function parseHeaders(headerBlock: string): Record<string, string> {
  const headers: Record<string, string> = {};
  // Unfold continued headers (lines starting with whitespace are continuations)
  const unfolded = headerBlock.replace(/\r?\n([ \t]+)/g, ' ');
  const lines = unfolded.split(/\r?\n/);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      const value = line.substring(colonIdx + 1).trim();
      headers[key] = value;
    }
  }
  return headers;
}

// Extract the plain text body from a potentially MIME multipart message
function extractBody(rawBody: string, headers: Record<string, string>): { text: string; html: string } {
  const contentType = headers['content-type'] || 'text/plain';
  const transferEncoding = (headers['content-transfer-encoding'] || '').toLowerCase();

  // Multipart message
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = rawBody.split(`--${boundary}`);
    let textBody = '';
    let htmlBody = '';

    for (const part of parts) {
      if (part.trim() === '--' || part.trim() === '') continue;

      const partSplit = part.indexOf('\n\n') !== -1 ? part.indexOf('\n\n') : part.indexOf('\r\n\r\n');
      if (partSplit === -1) continue;

      const partHeaderBlock = part.substring(0, partSplit);
      const partBody = part.substring(partSplit).trim();
      const partHeaders = parseHeaders(partHeaderBlock);
      const partContentType = (partHeaders['content-type'] || '').toLowerCase();
      const partEncoding = (partHeaders['content-transfer-encoding'] || '').toLowerCase();

      // Recurse into nested multipart
      if (partContentType.includes('multipart/')) {
        const nested = extractBody(partBody, partHeaders);
        if (nested.text) textBody = nested.text;
        if (nested.html) htmlBody = nested.html;
        continue;
      }

      let decoded = partBody;
      if (partEncoding.includes('quoted-printable')) {
        decoded = decodeQuotedPrintable(partBody);
      } else if (partEncoding.includes('base64')) {
        decoded = decodeBase64(partBody);
      }

      if (partContentType.includes('text/plain')) {
        textBody = decoded;
      } else if (partContentType.includes('text/html')) {
        htmlBody = decoded;
      }
    }

    return { text: textBody, html: htmlBody };
  }

  // Single part message
  let body = rawBody;
  if (transferEncoding.includes('quoted-printable')) {
    body = decodeQuotedPrintable(rawBody);
  } else if (transferEncoding.includes('base64')) {
    body = decodeBase64(rawBody);
  }

  if (contentType.includes('text/html')) {
    return { text: '', html: body };
  }
  return { text: body, html: '' };
}

// Strip HTML tags for snippet generation
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse a single raw email string into a ParsedEmail
function parseRawEmail(raw: string): ParsedEmail | null {
  // Split headers and body
  const headerBodySplit = raw.indexOf('\n\n') !== -1 ? raw.indexOf('\n\n') : raw.indexOf('\r\n\r\n');
  if (headerBodySplit === -1) return null;

  const headerBlock = raw.substring(0, headerBodySplit);
  const rawBody = raw.substring(headerBodySplit).trim();
  const headers = parseHeaders(headerBlock);

  const subject = decodeMimeWord(headers['subject'] || '(No Subject)');
  const fromRaw = headers['from'] || 'Unknown';
  const { name: fromName, email: fromEmail } = parseEmailAddress(fromRaw);
  const toRaw = headers['to'] || '';
  const { email: toEmail } = parseEmailAddress(toRaw);
  const dateStr = headers['date'] || '';

  let timestamp: number;
  try {
    timestamp = new Date(dateStr).getTime();
    if (isNaN(timestamp)) timestamp = Date.now();
  } catch {
    timestamp = Date.now();
  }

  const { text, html } = extractBody(rawBody, headers);
  const bodyText = text || stripHtml(html);
  const snippet = bodyText.substring(0, 200).trim();
  const provider = detectProvider(headers, fromEmail);

  // Extract attachment filenames from Content-Disposition headers
  const attachments: string[] = [];
  const attachmentMatches = raw.matchAll(/Content-Disposition:\s*attachment;\s*filename="?([^";\n]+)"?/gi);
  for (const m of attachmentMatches) {
    attachments.push(m[1].trim());
  }

  return {
    id: headers['message-id'] || generateId(subject, fromEmail, dateStr),
    subject,
    from: fromEmail,
    fromName,
    to: toEmail,
    date: dateStr,
    timestamp,
    body: bodyText.substring(0, 10000),
    bodyHtml: html.substring(0, 50000),
    snippet,
    provider,
    attachments,
  };
}

/**
 * Parse an MBOX file content into an array of emails.
 * MBOX files contain multiple emails separated by "From " lines.
 */
export function parseMBOX(content: string): ParsedEmail[] {
  const emails: ParsedEmail[] = [];

  // Split by "From " at the beginning of a line (MBOX standard separator)
  const blocks = content.split(/^From .+$/m);

  for (const block of blocks) {
    if (!block.trim()) continue;
    const email = parseRawEmail(block.trim());
    if (email) emails.push(email);
  }

  return emails;
}

/**
 * Parse a single EML file content into a ParsedEmail.
 * EML files contain exactly one email in standard RFC 2822 format.
 */
export function parseEML(content: string): ParsedEmail | null {
  return parseRawEmail(content.trim());
}

/**
 * Read a file as text, handling different encodings.
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Parse an uploaded file (MBOX or EML) and return normalized emails.
 */
export async function parseEmailFile(file: File): Promise<ParsedEmail[]> {
  const content = await readFileAsText(file);
  const ext = file.name.toLowerCase().split('.').pop();

  if (ext === 'mbox') {
    return parseMBOX(content);
  }

  if (ext === 'eml') {
    const email = parseEML(content);
    return email ? [email] : [];
  }

  throw new Error(`Unsupported file format: .${ext}. Please upload .mbox or .eml files.`);
}
