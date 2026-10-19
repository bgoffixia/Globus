export interface TransactionReceiptPdfData {
  reference: string;
  amount: string;
  status: string;
  date: string;
  description: string;
  counterparty: string;
  activity: string;
  sourceAmount?: string;
  exchangeRate?: string;
  convertedAmount?: string;
  recipient?: string;
  route?: string;
}

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const PAGE_MARGIN = 104;
const TEXT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The Globus logo could not be loaded.'));
    image.src = src;
  });
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const parts = context.measureText(word).width > maxWidth ? Array.from(word) : [word];
    for (const part of parts) {
      const candidate = line ? `${line}${parts.length > 1 ? '' : ' '}${part}` : part;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = part;
      } else {
        line = candidate;
      }
    }
  }

  if (line) lines.push(line);
  return lines;
}

function concatBytes(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function createPdfFromJpeg(imageBytes: Uint8Array) {
  const encoder = new TextEncoder();
  const content = encoder.encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n');
  const objects: Uint8Array[] = [
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'),
    concatBytes([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${PAGE_WIDTH} /Height ${PAGE_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
      imageBytes,
      encoder.encode('\nendstream'),
    ]),
    concatBytes([
      encoder.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encoder.encode('endstream'),
    ]),
  ];
  const chunks: Uint8Array[] = [encoder.encode('%PDF-1.4\n')];
  const offsets = [0];
  let byteOffset = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrappedObject = concatBytes([
      encoder.encode(`${index + 1} 0 obj\n`),
      object,
      encoder.encode('\nendobj\n'),
    ]);
    chunks.push(wrappedObject);
    byteOffset += wrappedObject.length;
  });

  const xrefOffset = byteOffset;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(encoder.encode(xref));
  return new Blob([concatBytes(chunks)], { type: 'application/pdf' });
}

function drawReceipt(context: CanvasRenderingContext2D, logo: HTMLImageElement, receipt: TransactionReceiptPdfData) {
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

  const logoHeight = 72;
  const logoWidth = Math.min(430, logo.naturalWidth / logo.naturalHeight * logoHeight);
  context.drawImage(logo, PAGE_MARGIN, 72, logoWidth, logoHeight);

  context.fillStyle = '#518c91';
  context.font = '700 21px Arial, sans-serif';
  context.fillText('INTERNAL LEDGER RECEIPT', PAGE_MARGIN, 210);

  context.fillStyle = '#203851';
  context.font = '700 48px Arial, sans-serif';
  context.fillText('Transaction receipt', PAGE_MARGIN, 265);

  context.fillStyle = '#64798e';
  context.font = '400 24px Arial, sans-serif';
  const activityLines = wrapText(context, receipt.activity, TEXT_WIDTH);
  activityLines.forEach((line, index) => context.fillText(line, PAGE_MARGIN, 305 + index * 34));

  const amountY = 392 + Math.max(0, activityLines.length - 1) * 34;
  context.fillStyle = '#203851';
  context.font = '700 58px Arial, sans-serif';
  context.fillText(receipt.amount, PAGE_MARGIN, amountY);

  const badgeText = receipt.status.toUpperCase();
  context.font = '700 19px Arial, sans-serif';
  const badgeWidth = context.measureText(badgeText).width + 42;
  context.fillStyle = receipt.status.toLowerCase() === 'completed' ? '#eaf5ef' : '#f5f1e7';
  context.fillRect(PAGE_MARGIN, amountY + 34, badgeWidth, 42);
  context.fillStyle = receipt.status.toLowerCase() === 'completed' ? '#417f69' : '#927944';
  context.fillText(badgeText, PAGE_MARGIN + 21, amountY + 62);

  let y = amountY + 142;
  context.strokeStyle = '#dfe7eb';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(PAGE_MARGIN, y);
  context.lineTo(PAGE_WIDTH - PAGE_MARGIN, y);
  context.stroke();
  y += 58;

  const fields = [
    ['Reference', receipt.reference],
    ['Source amount', receipt.sourceAmount ?? ''],
    ['Exchange rate', receipt.exchangeRate ?? ''],
    ['Total converted amount', receipt.convertedAmount ?? ''],
    ['Recipient', receipt.recipient ?? ''],
    ['Route', receipt.route ?? ''],
    ['Description', receipt.description],
    ['Date', receipt.date],
    ['Counterparty label', receipt.counterparty],
  ];
  for (const [label, value] of fields) {
    if (!value) continue;
    context.fillStyle = '#8492a1';
    context.font = '700 16px Arial, sans-serif';
    const labelLines = wrapText(context, label.toUpperCase(), 210);
    labelLines.forEach((line, index) => context.fillText(line, PAGE_MARGIN, y + index * 25));

    context.fillStyle = '#40566e';
    context.font = label === 'Reference' ? '700 22px monospace' : '600 22px Arial, sans-serif';
    const lines = wrapText(context, value, TEXT_WIDTH - 240);
    lines.forEach((line, index) => context.fillText(line, PAGE_MARGIN + 240, y + index * 30));
    y += Math.max(lines.length * 30, labelLines.length * 25) + 22;
  }

  context.fillStyle = '#8795a2';
  context.font = '400 16px Arial, sans-serif';
  context.fillText('Globus Bank · Internal ledger record', PAGE_MARGIN, PAGE_HEIGHT - 72);
}

export async function downloadTransactionReceiptPdf(
  receipt: TransactionReceiptPdfData,
  logoUrl: string,
) {
  const logo = await loadImage(logoUrl);
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('PDF receipt generation is not available in this browser.');
  drawReceipt(context, logo, receipt);

  const jpeg = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('The PDF receipt could not be created.')),
      'image/jpeg',
      0.96,
    );
  });
  const pdf = createPdfFromJpeg(new Uint8Array(await jpeg.arrayBuffer()));
  const url = URL.createObjectURL(pdf);
  const link = document.createElement('a');
  const safeReference = receipt.reference.replace(/[^a-z0-9_-]+/gi, '-');
  link.href = url;
  link.download = `globus-receipt-${safeReference}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
