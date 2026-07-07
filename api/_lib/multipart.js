const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

async function readMultipart(req, maxBytes = MAX_AUDIO_BYTES + 128 * 1024) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) {
    const err = new Error('Expected multipart/form-data with an audio file.');
    err.statusCode = 400;
    throw err;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error('Audio upload is too large. Please keep voice questions under about 60 seconds.');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);
  return parseMultipartBuffer(buffer, boundaryMatch[1] || boundaryMatch[2]);
}

function parseMultipartBuffer(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};
  let cursor = buffer.indexOf(delimiter);

  while (cursor !== -1) {
    cursor += delimiter.length;
    if (buffer.slice(cursor, cursor + 2).toString() === '--') break;
    if (buffer.slice(cursor, cursor + 2).toString() === '\r\n') cursor += 2;

    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), cursor);
    if (headerEnd === -1) break;
    const headerText = buffer.slice(cursor, headerEnd).toString('utf8');
    const nextBoundary = buffer.indexOf(delimiter, headerEnd + 4);
    if (nextBoundary === -1) break;

    let content = buffer.slice(headerEnd + 4, nextBoundary);
    if (content.slice(-2).toString() === '\r\n') {
      content = content.slice(0, -2);
    }

    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i);
    const name = disposition && disposition[1].match(/name="([^"]+)"/i);
    const filename = disposition && disposition[1].match(/filename="([^"]*)"/i);
    const type = headerText.match(/content-type:\s*([^\r\n]+)/i);

    if (name) {
      const fieldName = name[1];
      if (filename) {
        files[fieldName] = {
          filename: filename[1] || 'upload.webm',
          contentType: type ? type[1].trim() : 'application/octet-stream',
          buffer: content
        };
      } else {
        fields[fieldName] = content.toString('utf8');
      }
    }

    cursor = nextBoundary;
  }

  return { fields, files };
}

module.exports = {
  MAX_AUDIO_BYTES,
  readMultipart
};
