/**
 * Lightweight, zero-dependency client-side ZIP Archive Generator.
 * Implements the standard PKZip specification (APPNOTE.TXT) using STORE (uncompressed) or raw byte streams.
 * Works 100% in browsers, Web Workers, and Node.js.
 */

// CRC-32 lookup table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c >>> 0;
}

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  lastModified?: Date;
}

export class ZipArchive {
  private entries: ZipEntry[] = [];

  addFile(name: string, data: Uint8Array | ArrayBuffer, lastModified?: Date): void {
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.entries.push({
      name,
      data: uint8,
      lastModified: lastModified || new Date(),
    });
  }

  async buildBlob(): Promise<Blob> {
    const zipBytes = this.build();
    return new Blob([zipBytes as any], { type: "application/zip" });
  }

  build(): Uint8Array {
    const textEncoder = new TextEncoder();
    const localFileHeaders: Uint8Array[] = [];
    const centralDirectoryHeaders: Uint8Array[] = [];
    let currentOffset = 0;

    for (const entry of this.entries) {
      const fileNameBytes = textEncoder.encode(entry.name);
      const crc32 = computeCrc32(entry.data);
      const size = entry.data.length;

      const date = entry.lastModified || new Date();
      const dosTime =
        (date.getHours() << 11) |
        (date.getMinutes() << 5) |
        (Math.floor(date.getSeconds() / 2));
      const dosDate =
        ((date.getFullYear() - 1980) << 9) |
        ((date.getMonth() + 1) << 5) |
        date.getDate();

      // 1. Local File Header (30 bytes + filename + data)
      const localHeader = new Uint8Array(30 + fileNameBytes.length + size);
      const lView = new DataView(localHeader.buffer);

      lView.setUint32(0, 0x04034b50, true); // Local file header signature
      lView.setUint16(4, 20, true); // Version needed to extract (2.0)
      lView.setUint16(6, 0, true); // General purpose bit flag
      lView.setUint16(8, 0, true); // Compression method (0 = STORE)
      lView.setUint16(10, dosTime, true);
      lView.setUint16(12, dosDate, true);
      lView.setUint32(14, crc32, true);
      lView.setUint32(18, size, true); // Compressed size
      lView.setUint32(22, size, true); // Uncompressed size
      lView.setUint16(26, fileNameBytes.length, true);
      lView.setUint16(28, 0, true); // Extra field length

      localHeader.set(fileNameBytes, 30);
      localHeader.set(entry.data, 30 + fileNameBytes.length);
      localFileHeaders.push(localHeader);

      // 2. Central Directory Header (46 bytes + filename)
      const cdHeader = new Uint8Array(46 + fileNameBytes.length);
      const cView = new DataView(cdHeader.buffer);

      cView.setUint32(0, 0x02014b50, true); // Central directory header signature
      cView.setUint16(4, 20, true); // Version made by
      cView.setUint16(6, 20, true); // Version needed to extract
      cView.setUint16(8, 0, true); // General purpose bit flag
      cView.setUint16(10, 0, true); // Compression method (STORE)
      cView.setUint16(12, dosTime, true);
      cView.setUint16(14, dosDate, true);
      cView.setUint32(16, crc32, true);
      cView.setUint32(20, size, true);
      cView.setUint32(24, size, true);
      cView.setUint16(28, fileNameBytes.length, true);
      cView.setUint16(30, 0, true); // Extra field length
      cView.setUint16(32, 0, true); // File comment length
      cView.setUint16(34, 0, true); // Disk number start
      cView.setUint16(36, 0, true); // Internal file attributes
      cView.setUint32(38, 0, true); // External file attributes
      cView.setUint32(42, currentOffset, true); // Relative offset of local header

      cdHeader.set(fileNameBytes, 46);
      centralDirectoryHeaders.push(cdHeader);

      currentOffset += localHeader.length;
    }

    // 3. End of Central Directory Record (22 bytes)
    const centralDirectoryOffset = currentOffset;
    let centralDirectorySize = 0;
    for (const cd of centralDirectoryHeaders) {
      centralDirectorySize += cd.length;
    }

    const eocd = new Uint8Array(22);
    const eView = new DataView(eocd.buffer);
    eView.setUint32(0, 0x06054b50, true); // EOCD signature
    eView.setUint16(4, 0, true); // Number of this disk
    eView.setUint16(6, 0, true); // Disk where central directory starts
    eView.setUint16(8, this.entries.length, true); // Number of central directory records on this disk
    eView.setUint16(10, this.entries.length, true); // Total number of central directory records
    eView.setUint32(12, centralDirectorySize, true); // Size of central directory
    eView.setUint32(16, centralDirectoryOffset, true); // Offset of start of central directory
    eView.setUint16(20, 0, true); // Comment length

    // Assemble final contiguous Uint8Array
    const totalLength =
      centralDirectoryOffset + centralDirectorySize + eocd.length;
    const finalBuffer = new Uint8Array(totalLength);

    let offset = 0;
    for (const lh of localFileHeaders) {
      finalBuffer.set(lh, offset);
      offset += lh.length;
    }
    for (const cd of centralDirectoryHeaders) {
      finalBuffer.set(cd, offset);
      offset += cd.length;
    }
    finalBuffer.set(eocd, offset);

    return finalBuffer;
  }
}
