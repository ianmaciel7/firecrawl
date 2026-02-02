import winston from "winston";
import { config } from "../config";

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
};

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
  })
);

export const logger = winston.createLogger({
  levels: logLevels,
  level: config.LOG_LEVEL,
  format: logFormat,
  transports: [new winston.transports.Console()],
});

export function createChildLogger(meta: Record<string, unknown>): winston.Logger {
  return logger.child(meta);
}
