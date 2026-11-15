import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import { ZipArchive } from "../utils/zip-archive";
import { ConversionProgress } from "./types";
import { getPdfjs } from "../utils/pdfjs-loader";

/**
 * Extract all text with page layout and structure from a PDF.
 */
export async function extractStructuredText(
  pdfBytes: ArrayBuffer,
  onProgress?: (p: ConversionProgress) => void
): Promise<{ pageNumber: number; text: string; lines: string[] }[]> {
  const pdfjsLib = await getPdfjs();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes.slice(0)) }).promise;
  const total = pdf.numPages;
  const pages: { pageNumber: number; text: string; lines: string[] }[] = [];

  for (let i = 1; i <= total; i++) {
    if (onProgress) {
      onProgress({
        current: i,
        total,
        stage: `Extracting page ${i} of ${total}...`,
        percentage: Math.round(((i - 1) / total) * 100),
      });
    }

    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    // Group items into lines by y-coordinate
    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push(item.str);
    }

    // Sort top to bottom (descending y)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines = sortedY.map((y) => lineMap.get(y)!.join(" "));
    const fullText = lines.join("\n");

    pages.push({
      pageNumber: i,
      text: fullText,
      lines,
    });
  }

  if (onProgress) {
    onProgress({ current: total, total, stage: "Text extraction complete", percentage: 100 });
  }

  return pages;
}

/**
 * Convert PDF to Microsoft Word (.docx).
 * Assembles a valid OOXML (.docx) ZIP package containing `word/document.xml`.
 */
export async function pdfToWordDocx(
  pdfBytes: ArrayBuffer,
  onProgress?: (p: ConversionProgress) => void
): Promise<Blob> {
  const pages = await extractStructuredText(pdfBytes, onProgress);
  const textEncoder = new TextEncoder();

  // Escape XML characters
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  // Construct document.xml body paragraphs
  let docXmlBody = "";
  for (const page of pages) {
    docXmlBody += `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>--- Page ${page.pageNumber} ---</w:t></w:r></w:p>`;
    for (const line of page.lines) {
      docXmlBody += `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`;
    }
    docXmlBody += `<w:p/>`;
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${docXmlBody}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;

  // Package into standard .docx ZIP archive
  const zip = new ZipArchive();
  zip.addFile("[Content_Types].xml", textEncoder.encode(contentTypesXml));
  zip.addFile("_rels/.rels", textEncoder.encode(relsXml));
  zip.addFile("word/_rels/document.xml.rels", textEncoder.encode(wordRelsXml));
  zip.addFile("word/document.xml", textEncoder.encode(documentXml));

  const zipBytes = zip.build();
  return new Blob([zipBytes as any], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Convert PDF to Excel Spreadsheet (.xlsx / .csv).
 * Extracts tabular rows, numeric data, and organizes into CSV & Excel compatible structure.
 */
export async function pdfToExcel(
  pdfBytes: ArrayBuffer,
  format: "csv" | "xlsx" = "csv",
  onProgress?: (p: ConversionProgress) => void
): Promise<Blob> {
  const pages = await extractStructuredText(pdfBytes, onProgress);

  // Group line contents into CSV table rows
  const csvRows: string[] = [];
  csvRows.push('"Page","Line #","Extracted Content"');

  for (const page of pages) {
    page.lines.forEach((line, idx) => {
      const sanitized = line.replace(/"/g, '""');
      csvRows.push(`${page.pageNumber},${idx + 1},"${sanitized}"`);
    });
  }

  const csvContent = csvRows.join("\r\n");

  if (format === "csv") {
    return new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(csvContent)], {
      type: "text/csv;charset=utf-8;",
    });
  }

  // XML Spreadsheet 2003 compatible Excel format
  const escapeXml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let tableXml = "";
  for (const page of pages) {
    tableXml += `<Row><Cell><Data ss:Type="String">Page ${page.pageNumber}</Data></Cell></Row>`;
    for (const line of page.lines) {
      // If line contains multiple spaces or tabs, treat as columns
      const cells = line.split(/\s{2,}|\t/).filter((c) => c.trim().length > 0);
      tableXml += `<Row>`;
      for (const cell of cells) {
        const isNum = !isNaN(Number(cell.trim()));
        tableXml += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(cell.trim())}</Data></Cell>`;
      }
      tableXml += `</Row>`;
    }
  }

  const excelXml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Extracted Data">
  <Table>
   ${tableXml}
  </Table>
 </Worksheet>
</Workbook>`;

  return new Blob([new TextEncoder().encode(excelXml)], {
    type: "application/vnd.ms-excel",
  });
}

/**
 * Convert PDF to PowerPoint Slide Deck Presentation (.html / slide deck).
 * Each page is translated into an interactive slide presentation.
 */
export async function pdfToPowerPoint(
  pdfBytes: ArrayBuffer,
  onProgress?: (p: ConversionProgress) => void
): Promise<Blob> {
  const pages = await extractStructuredText(pdfBytes, onProgress);

  const escapeHtml = (str: string) =>
    str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const slidesHtml = pages
    .map(
      (p, i) => `
    <div class="slide" id="slide-${i + 1}">
      <div class="slide-header">
        <span class="slide-badge">Slide ${p.pageNumber}</span>
      </div>
      <div class="slide-content">
        ${p.lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}
      </div>
      <div class="slide-footer">Page ${p.pageNumber} of ${pages.length}</div>
    </div>`
    )
    .join("");

  const presentationHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Converted Presentation Deck</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; margin: 0; padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 2rem; color: #1e293b; }
    .slide { width: 960px; height: 540px; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); padding: 3rem; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; page-break-after: always; position: relative; }
    .slide-header { border-bottom: 2px solid #e2e8f0; padding-bottom: 1rem; }
    .slide-badge { font-size: 0.85rem; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; }
    .slide-content { flex: 1; padding: 1.5rem 0; overflow-y: auto; font-size: 1.1rem; line-height: 1.6; }
    .slide-footer { border-top: 1px solid #f1f5f9; padding-top: 0.75rem; font-size: 0.85rem; color: #94a3b8; text-align: right; }
    @media print { body { background: none; padding: 0; } .slide { box-shadow: none; border-radius: 0; } }
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;

  return new Blob([new TextEncoder().encode(presentationHtml)], {
    type: "text/html",
  });
}

/**
 * Convert Office/Text documents (.txt, .docx text, .csv, tables) to formatted PDF.
 */
export async function textOrOfficeToPdf(
  textContent: string,
  title: string = "Converted Document",
  onProgress?: (p: ConversionProgress) => void
): Promise<Uint8Array> {
  if (onProgress) {
    onProgress({ current: 1, total: 3, stage: "Formatting text layout...", percentage: 25 });
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const [pageWidth, pageHeight] = PageSizes.A4;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const lineHeight = 16;
  const maxLinesPerPage = Math.floor((pageHeight - margin * 2 - 40) / lineHeight);

  // Wrap text into lines that fit within contentWidth
  const rawLines = textContent.split(/\r?\n/);
  const wrappedLines: string[] = [];

  for (const rawLine of rawLines) {
    if (!rawLine.trim()) {
      wrappedLines.push("");
      continue;
    }
    const words = rawLine.split(" ");
    let currentLine = "";
    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width > contentWidth) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) wrappedLines.push(currentLine);
  }

  const totalPages = Math.ceil(wrappedLines.length / maxLinesPerPage) || 1;

  for (let p = 0; p < totalPages; p++) {
    if (onProgress) {
      onProgress({
        current: p + 1,
        total: totalPages,
        stage: `Generating page ${p + 1} of ${totalPages}...`,
        percentage: Math.round(((p + 1) / totalPages) * 100),
      });
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    // Header title on page 1
    if (p === 0) {
      page.drawText(title, {
        x: margin,
        y: currentY,
        size: 16,
        font: boldFont,
        color: rgb(0.1, 0.15, 0.25),
      });
      currentY -= 30;
    }

    const pageLines = wrappedLines.slice(p * maxLinesPerPage, (p + 1) * maxLinesPerPage);
    for (const line of pageLines) {
      if (line) {
        page.drawText(line, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.15, 0.18, 0.22),
        });
      }
      currentY -= lineHeight;
    }

    // Page footer
    page.drawText(`Page ${p + 1} of ${totalPages}`, {
      x: pageWidth - margin - 60,
      y: margin / 2,
      size: 9,
      font,
      color: rgb(0.6, 0.65, 0.7),
    });
  }

  return await pdfDoc.save({ useObjectStreams: true });
}

