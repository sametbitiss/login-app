const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function formatLogMessage(level, category, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${category.toUpperCase()}] ${message}${metaStr}\n`;
}

function appendToFile(fileName, logLine) {
  const filePath = path.join(LOGS_DIR, fileName);
  fs.appendFile(filePath, logLine, (err) => {
    if (err) {
      console.error(`Failed to write log to ${fileName}:`, err);
    }
  });
}

class Logger {
  crud(message, meta = {}) {
    const line = formatLogMessage('INFO', 'CRUD', message, meta);
    appendToFile('crud.log', line);
    appendToFile('combined.log', line);
  }

  security(message, meta = {}) {
    const line = formatLogMessage('WARN', 'SECURITY', message, meta);
    appendToFile('security.log', line);
    appendToFile('combined.log', line);
  }

  error(message, errorDetails = {}, meta = {}) {
    const combinedMeta = { ...meta, error: errorDetails.message || errorDetails, stack: errorDetails.stack };
    const line = formatLogMessage('ERROR', 'SYSTEM', message, combinedMeta);
    appendToFile('error.log', line);
    appendToFile('combined.log', line);
  }

  info(category, message, meta = {}) {
    const line = formatLogMessage('INFO', category, message, meta);
    appendToFile('combined.log', line);
  }
}

module.exports = new Logger();
