import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

/**
 * Creates in-memory synthetic PDF sample buffers for instant browser testing.
 * All generation happens 100% locally in the browser with zero network requests.
 */

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
}

export async function createSinglePageSamplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("Single Page Sample Document");
  doc.setAuthor("PDF Studio Test Suite");

  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawText("PDF Studio — Single Page Document", {
    x: 50,
    y: 780,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText("This is an authentic sample PDF generated purely client-side.", {
    x: 50,
    y: 740,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  page.drawText("Features verified in this sample:", {
    x: 50,
    y: 700,
    size: 14,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  const bullets = [
    "• High-DPI canvas rasterization with crisp font rendering.",
    "• Immutable source bytes preservation.",
    "• Fast zoom in/out, fit-to-width, and fit-to-page calculations.",
    "• Page rotation in 90-degree increments.",
    "• Zero telemetry or server data transmissions.",
  ];

  bullets.forEach((bullet, index) => {
    page.drawText(bullet, {
      x: 60,
      y: 660 - index * 24,
      size: 11,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
  });

  // Draw some sample decorative vector shapes
  page.drawRectangle({
    x: 50,
    y: 460,
    width: 495.28,
    height: 60,
    color: rgb(0.95, 0.97, 1.0),
    borderColor: rgb(0.6, 0.7, 0.9),
    borderWidth: 1,
  });

  page.drawText("Status: Engine Active | PDF 1.7 Standard | Client Sandbox Validated", {
    x: 70,
    y: 485,
    size: 10,
    font: boldFont,
    color: rgb(0.15, 0.35, 0.75),
  });

  const pdfBytes = await doc.save();
  return toArrayBuffer(pdfBytes);
}

export async function createMultiPageSamplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("Multi-Page Architectural Portfolio");
  doc.setAuthor("PDF Studio Test Suite");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const pagesData = [
    {
      title: "Page 1: Executive Overview",
      desc: "Welcome to PDF Studio multi-page document inspection. Check thumbnail rendering in the sidebar.",
      color: rgb(0.1, 0.3, 0.7),
    },
    {
      title: "Page 2: Layout & Typography Analysis",
      desc: "Demonstrates layout block tokenization and baseline coordinate mapping.",
      color: rgb(0.1, 0.6, 0.4),
    },
    {
      title: "Page 3: Hyperlinks & Annotation Integrity",
      desc: "Ensures external and internal destinations are preserved during rendering and modification.",
      color: rgb(0.8, 0.4, 0.1),
    },
    {
      title: "Page 4: Redaction & Compliance",
      desc: "Tests structural content-stream purging versus visual masking.",
      color: rgb(0.6, 0.2, 0.6),
    },
    {
      title: "Page 5: High-Resolution Export Testing",
      desc: "Verifies high-DPI image generation and lossless PDF compilation.",
      color: rgb(0.2, 0.2, 0.3),
    },
  ];

  for (let i = 0; i < pagesData.length; i++) {
    const item = pagesData[i];
    const page = doc.addPage([595.28, 841.89]);

    page.drawText(item.title, {
      x: 50,
      y: 780,
      size: 22,
      font: boldFont,
      color: item.color,
    });

    page.drawText(item.desc, {
      x: 50,
      y: 730,
      size: 12,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    page.drawRectangle({
      x: 50,
      y: 350,
      width: 495.28,
      height: 320,
      color: rgb(0.97, 0.98, 0.99),
      borderColor: rgb(0.8, 0.85, 0.9),
      borderWidth: 1,
    });

    page.drawText(`Page ${i + 1} of ${pagesData.length}`, {
      x: 240,
      y: 500,
      size: 18,
      font: boldFont,
      color: rgb(0.4, 0.4, 0.5),
    });

    page.drawText("PDF Studio Multi-Page Validation", {
      x: 50,
      y: 50,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const pdfBytes = await doc.save();
  return toArrayBuffer(pdfBytes);
}

export async function createRotatedPageSamplePdf(): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  doc.setTitle("Rotated Page Test Document");

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Portrait (0 deg)
  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawText("Page 1: Normal Portrait Orientation (0°)", {
    x: 50,
    y: 780,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Page 2: Landscape rotated by 90 degrees
  const p2 = doc.addPage([841.89, 595.28]);
  p2.setRotation(degrees(90));
  p2.drawText("Page 2: Native 90° Rotated Landscape Page", {
    x: 50,
    y: 520,
    size: 16,
    font: boldFont,
    color: rgb(0.7, 0.2, 0.1),
  });

  // Page 3: 180 degrees upside down
  const p3 = doc.addPage([595.28, 841.89]);
  p3.setRotation(degrees(180));
  p3.drawText("Page 3: Native 180° Inverted Page", {
    x: 50,
    y: 780,
    size: 16,
    font: boldFont,
    color: rgb(0.1, 0.4, 0.7),
  });

  const pdfBytes = await doc.save();
  return toArrayBuffer(pdfBytes);
}
