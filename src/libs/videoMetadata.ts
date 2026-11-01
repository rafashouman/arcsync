const EBML_SEGMENT_ID = 0x18538067;
const EBML_INFO_ID = 0x1549a966;
const EBML_TIMECODE_SCALE_ID = 0x2ad7b1;
const EBML_DURATION_ID = 0x4489;

function readMp4Box(
  buffer: Buffer,
  offset: number,
  parentEnd: number,
): { type: string; payloadStart: number; end: number } {
  if (offset + 8 > parentEnd) {
    throw new Error('O contêiner MP4/MOV possui um bloco incompleto.');
  }
  const size32 = buffer.readUInt32BE(offset);
  const type = buffer.toString('ascii', offset + 4, offset + 8);
  let headerSize = 8;
  let size: number;
  if (size32 === 1) {
    if (offset + 16 > parentEnd) {
      throw new Error('O contêiner MP4/MOV possui um bloco incompleto.');
    }
    const largeSize = buffer.readBigUInt64BE(offset + 8);
    if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error('O bloco MP4/MOV excede o limite suportado.');
    }
    size = Number(largeSize);
    headerSize = 16;
  } else {
    size = size32 === 0 ? parentEnd - offset : size32;
  }
  if (size < headerSize || offset + size > parentEnd) {
    throw new Error('O contêiner MP4/MOV contém um bloco inválido.');
  }
  return {
    type,
    payloadStart: offset + headerSize,
    end: offset + size,
  };
}

function parseMp4Duration(buffer: Buffer): number {
  let offset = 0;
  while (offset < buffer.length) {
    const box = readMp4Box(buffer, offset, buffer.length);
    if (box.type === 'moov') {
      let childOffset = box.payloadStart;
      while (childOffset < box.end) {
        const child = readMp4Box(buffer, childOffset, box.end);
        if (child.type === 'mvhd') {
          const version = buffer[child.payloadStart];
          const timescaleOffset = child.payloadStart + (version === 1 ? 20 : 12);
          const durationOffset = child.payloadStart + (version === 1 ? 24 : 16);
          if (
            (version !== 0 && version !== 1) ||
            durationOffset + (version === 1 ? 8 : 4) > child.end
          ) {
            throw new Error('Os metadados de duração do MP4/MOV são inválidos.');
          }
          const timescale = buffer.readUInt32BE(timescaleOffset);
          const duration =
            version === 1
              ? Number(buffer.readBigUInt64BE(durationOffset))
              : buffer.readUInt32BE(durationOffset);
          const seconds = duration / timescale;
          if (
            timescale === 0 ||
            !Number.isSafeInteger(duration) ||
            !Number.isFinite(seconds) ||
            seconds <= 0
          ) {
            throw new Error('Os metadados de duração do MP4/MOV são inválidos.');
          }
          return seconds;
        }
        childOffset = child.end;
      }
    }
    offset = box.end;
  }
  throw new Error('Não foi possível encontrar a duração do vídeo MP4/MOV.');
}

function readEbmlVint(
  buffer: Buffer,
  offset: number,
  isElementId: boolean,
): { value: number; length: number; unknownSize: boolean } {
  if (offset >= buffer.length) {
    throw new Error('O contêiner WebM possui um elemento incompleto.');
  }
  const first = buffer[offset];
  let marker = 0x80;
  let length = 1;
  while ((first & marker) === 0 && marker > 1) {
    marker >>= 1;
    length += 1;
  }
  if (length > (isElementId ? 4 : 8) || offset + length > buffer.length) {
    throw new Error('O contêiner WebM possui um elemento inválido.');
  }

  let value = isElementId ? first : first & (marker - 1);
  for (let index = 1; index < length; index += 1) {
    value = value * 256 + buffer[offset + index];
  }
  const unknownSize =
    !isElementId && value === Math.pow(2, 7 * length) - 1;
  return { value, length, unknownSize };
}

function parseWebmDuration(buffer: Buffer): number {
  let offset = 0;
  let timecodeScale = 1_000_000;
  let duration: number | null = null;
  while (offset < buffer.length) {
    const id = readEbmlVint(buffer, offset, true);
    const size = readEbmlVint(buffer, offset + id.length, false);
    const payloadStart = offset + id.length + size.length;
    const elementEnd = size.unknownSize
      ? buffer.length
      : payloadStart + size.value;
    if (elementEnd > buffer.length || elementEnd < payloadStart) {
      throw new Error('O contêiner WebM contém um elemento fora dos limites.');
    }

    if (id.value === EBML_SEGMENT_ID || id.value === EBML_INFO_ID) {
      let childOffset = payloadStart;
      while (childOffset < elementEnd) {
        const childId = readEbmlVint(buffer, childOffset, true);
        const childSize = readEbmlVint(
          buffer,
          childOffset + childId.length,
          false,
        );
        const childStart = childOffset + childId.length + childSize.length;
        const childEnd = childSize.unknownSize
          ? elementEnd
          : childStart + childSize.value;
        if (childEnd > elementEnd || childEnd < childStart) {
          throw new Error('O contêiner WebM contém um elemento inválido.');
        }

        if (id.value === EBML_SEGMENT_ID && childId.value === EBML_INFO_ID) {
          let infoOffset = childStart;
          while (infoOffset < childEnd) {
            const infoId = readEbmlVint(buffer, infoOffset, true);
            const infoSize = readEbmlVint(
              buffer,
              infoOffset + infoId.length,
              false,
            );
            const infoStart = infoOffset + infoId.length + infoSize.length;
            const infoEnd = infoSize.unknownSize
              ? childEnd
              : infoStart + infoSize.value;
            if (infoEnd > childEnd || infoEnd < infoStart) {
              throw new Error('Os metadados de duração do WebM são inválidos.');
            }
            if (infoId.value === EBML_TIMECODE_SCALE_ID) {
              const byteLength = infoEnd - infoStart;
              if (byteLength < 1 || byteLength > 8) {
                throw new Error('A escala de tempo do WebM é inválida.');
              }
              let scale = 0;
              for (let index = infoStart; index < infoEnd; index += 1) {
                scale = scale * 256 + buffer[index];
              }
              timecodeScale = scale;
            } else if (infoId.value === EBML_DURATION_ID) {
              const byteLength = infoEnd - infoStart;
              if (byteLength === 4) {
                duration = buffer.readFloatBE(infoStart);
              } else if (byteLength === 8) {
                duration = buffer.readDoubleBE(infoStart);
              } else {
                throw new Error('A duração do WebM possui formato inválido.');
              }
            }
            infoOffset = infoEnd;
          }
        }
        childOffset = childEnd;
      }
    }
    offset = elementEnd;
  }

  const seconds =
    duration === null ? Number.NaN : (duration * timecodeScale) / 1_000_000_000;
  if (
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    !Number.isFinite(timecodeScale) ||
    timecodeScale <= 0
  ) {
    throw new Error('Não foi possível encontrar a duração do vídeo WebM.');
  }
  return seconds;
}

export function parseVideoDurationSeconds(
  buffer: Buffer,
  contentType: string,
): number {
  if (buffer.length === 0) {
    throw new Error('O arquivo de vídeo está vazio.');
  }
  if (contentType === 'video/mp4' || contentType === 'video/quicktime') {
    return parseMp4Duration(buffer);
  }
  if (contentType === 'video/webm') {
    return parseWebmDuration(buffer);
  }
  throw new Error('O formato do vídeo não é compatível.');
}

export function assertVideoDurationWithinLimit(
  durationSeconds: number,
  maximumSeconds: number,
) {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    !Number.isSafeInteger(maximumSeconds) ||
    maximumSeconds <= 0
  ) {
    throw new Error('Não foi possível validar a duração máxima do vídeo.');
  }
  if (durationSeconds > maximumSeconds) {
    throw new Error(
      `O vídeo tem ${durationSeconds.toFixed(1)} segundos; o limite da conta TikTok é ${maximumSeconds} segundos.`,
    );
  }
}
