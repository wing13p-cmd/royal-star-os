export class HttpRequestBodyError extends Error {
  constructor(message, { statusCode = 400, errorType = 'invalid_json', detail } = {}) {
    super(message);
    this.name = 'HttpRequestBodyError';
    this.statusCode = statusCode;
    this.errorType = errorType;
    this.detail = detail;
  }
}

function getHeaderValue(headers = {}, name) {
  const value = headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';
}

function isJsonContentType(headers = {}) {
  const contentType = getHeaderValue(headers, 'content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}

function normalizeBodylessMethod(method = '') {
  return ['GET', 'DELETE', 'HEAD', 'OPTIONS'].includes(String(method).toUpperCase());
}

function readBodyStream(req, { maxBytes = 256 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding?.('utf8');

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
    };

    const onData = (chunk) => {
      const chunkString = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      size += chunkString.length;
      if (size > maxBytes) {
        cleanup();
        reject(new HttpRequestBodyError('Payload too large', { statusCode: 413, errorType: 'payload_too_large' }));
        return;
      }
      body += chunkString;
    };

    const onEnd = () => {
      cleanup();
      resolve(body);
    };

    const onError = (error) => {
      cleanup();
      reject(error instanceof HttpRequestBodyError ? error : new HttpRequestBodyError('Unable to read request body', { statusCode: 400, errorType: 'read_error', detail: error.message }));
    };

    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
  });
}

export async function readJsonBody(req, options = {}) {
  const {
    allowEmptyBody = normalizeBodylessMethod(req.method),
    maxBytes = 256 * 1024,
    requireJsonContentType = true,
  } = options;

  if (req._bodyError) {
    throw req._bodyError;
  }

  if (req._bodyPromise) {
    return req._bodyPromise;
  }

  if (req._cachedBody !== undefined) {
    return req._cachedBody;
  }

  if (normalizeBodylessMethod(req.method) && allowEmptyBody) {
    req._cachedBody = {};
    return {};
  }

  if (requireJsonContentType && !isJsonContentType(req.headers)) {
    const error = new HttpRequestBodyError('Content-Type must be application/json', {
      statusCode: 415,
      errorType: 'invalid_content_type',
    });
    req._bodyError = error;
    throw error;
  }

  const bodyPromise = (async () => {
    const body = await readBodyStream(req, { maxBytes });
    if (!body) {
      if (allowEmptyBody) {
        const parsed = {};
        req._cachedBody = parsed;
        return parsed;
      }
      const error = new HttpRequestBodyError('Request body is required', { statusCode: 400, errorType: 'empty_body' });
      req._bodyError = error;
      throw error;
    }

    try {
      const parsed = JSON.parse(body);
      req._cachedBody = parsed;
      return parsed;
    } catch (error) {
      const wrapped = new HttpRequestBodyError('Malformed JSON payload', {
        statusCode: 400,
        errorType: 'invalid_json',
        detail: error.message,
      });
      req._bodyError = wrapped;
      throw wrapped;
    }
  })();

  req._bodyPromise = bodyPromise;
  try {
    return await bodyPromise;
  } catch (error) {
    delete req._bodyPromise;
    throw error;
  }
}
