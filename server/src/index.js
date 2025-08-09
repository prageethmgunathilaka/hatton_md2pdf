const path = require('path');
const fs = require('fs');
const fastifyFactory = require('fastify');
const fastifyStatic = require('@fastify/static');
const fastifyMultipart = require('@fastify/multipart');
const MarkdownIt = require('markdown-it');
const hljs = require('highlight.js');
const puppeteer = require('puppeteer');

const PORT = process.env.PORT || 3000;

const fastify = fastifyFactory({
  logger: true,
  bodyLimit: 100 * 1024 * 1024 // 100MB for JSON bodies
});

fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB file upload limit
  }
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, '..', 'public'),
  prefix: '/',
  index: ['index.html']
});

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch (__) {}
    }
    return `<pre class="hljs"><code>${markdown.utils.escapeHtml(str)}</code></pre>`;
  }
});

let browserInstance = null;

async function ensureBrowser() {
  if (browserInstance) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  return browserInstance;
}

function buildHtmlDocument(title, contentHtml) {
  const css = `
  /* Basic, readable layout tailored for print */
  @page { size: auto; margin: 20mm; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Liberation Sans', sans-serif;
    line-height: 1.6;
    font-size: 12pt;
    color: #111;
  }
  h1, h2, h3, h4, h5, h6 { color: #000; margin-top: 1.2em; }
  h1 { font-size: 1.8em; }
  h2 { font-size: 1.5em; }
  h3 { font-size: 1.25em; }
  p { margin: 0.5em 0; }
  a { color: #0366d6; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { margin: 0.5em 0 0.5em 1.4em; }
  blockquote { color: #555; border-left: 4px solid #ddd; padding-left: 1em; margin: 0.8em 0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 0.95em; }
  pre { background: #f6f8fa; padding: 12px; overflow-x: auto; border-radius: 6px; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; }
  th { background: #f5f5f5; }
  img { max-width: 100%; }
  /* highlight.js base */
  .hljs { display: block; overflow-x: auto; background: #f6f8fa; color: #24292e; padding: 12px; border-radius: 6px; }
  `;

  return `<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${markdown.utils.escapeHtml(title || 'Document')}</title>
      <style>${css}</style>
    </head>
    <body>
      ${contentHtml}
    </body>
  </html>`;
}

async function markdownToPdfBuffer(markdownText, pdfOptions) {
  const htmlContent = markdown.render(markdownText);
  const documentHtml = buildHtmlDocument(pdfOptions.title || 'Document', htmlContent);
  const browser = await ensureBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(documentHtml, { waitUntil: ['load', 'domcontentloaded', 'networkidle0'] });
    const buffer = await page.pdf({
      format: pdfOptions.format || 'A4',
      printBackground: true,
      margin: pdfOptions.margin || { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });
    return buffer;
  } finally {
    await page.close();
  }
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

fastify.get('/health', async () => ({ status: 'ok' }));

fastify.post('/convert', async (request, reply) => {
  const contentType = request.headers['content-type'] || '';
  let markdownText = '';
  let requestedFilename = undefined;
  let format = (request.query && request.query.format) || 'A4';
  let title = (request.query && request.query.title) || 'Document';

  try {
    if (contentType.includes('multipart/form-data')) {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          markdownText = await streamToString(part.file);
          if (!requestedFilename && part.filename) {
            requestedFilename = part.filename.replace(/\.[^/.]+$/, '');
          }
        } else if (part.type === 'field') {
          if (part.fieldname === 'text' || part.fieldname === 'markdown') {
            if (!markdownText) markdownText = part.value;
          }
          if (part.fieldname === 'filename' && part.value) {
            requestedFilename = part.value;
          }
          if (part.fieldname === 'format' && part.value) {
            format = part.value;
          }
          if (part.fieldname === 'title' && part.value) {
            title = part.value;
          }
        }
      }
    } else if (contentType.includes('application/json')) {
      const body = request.body || {};
      markdownText = body.markdown || body.text || '';
      requestedFilename = body.filename || undefined;
      format = body.format || format;
      title = body.title || title;
    } else if (contentType.includes('text/plain')) {
      markdownText = (request.body || '').toString('utf8');
    } else {
      // Fallback: try to parse body as string
      if (request.body && typeof request.body === 'string') {
        markdownText = request.body;
      }
    }

    if (!markdownText || markdownText.trim().length === 0) {
      reply.code(400);
      return { error: 'No markdown content provided. Use multipart with "file" or "text" field, or JSON { markdown }.' };
    }

    const buffer = await markdownToPdfBuffer(markdownText, { format, title });

    const filenameBase = (requestedFilename && requestedFilename.trim()) || 'document';
    const safeFilename = filenameBase.replace(/[^a-zA-Z0-9-_]+/g, '_');
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${safeFilename}.pdf"`);
    return reply.send(buffer);
  } catch (err) {
    request.log.error({ err }, 'Conversion failed');
    reply.code(500);
    return { error: 'Conversion failed', details: err.message };
  }
});

async function start() {
  await ensureBrowser();
  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

async function shutdown() {
  if (browserInstance) {
    try { await browserInstance.close(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start(); 