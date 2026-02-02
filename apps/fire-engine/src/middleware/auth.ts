import { Request, Response, NextFunction } from "express";
import { config } from "../config";
import { logger } from "../lib/logger";

/**
 * Authentication middleware
 * Checks for Authorization header with Bearer token
 * Only enforced if AUTH_TOKEN is set in config
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Skip auth if no token configured
  if (!config.AUTH_TOKEN) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    logger.warn("Missing authorization header", { path: req.path, ip: req.ip });
    res.status(401).json({ error: "Authorization header required" });
    return;
  }

  // Support both "Bearer <token>" and just "<token>"
  let token = authHeader;
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    token = authHeader.slice(7);
  }

  if (token !== config.AUTH_TOKEN) {
    logger.warn("Invalid authorization token", { path: req.path, ip: req.ip });
    res.status(401).json({ error: "Invalid authorization token" });
    return;
  }

  next();
}
