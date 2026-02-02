FROM node:22-slim

WORKDIR /usr/src/app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set Playwright browsers path
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright

# Install Playwright dependencies (Chromium only)
RUN npx playwright install chromium --with-deps

# Build TypeScript
RUN npm run build

# Default port
ARG PORT=3000
ENV PORT=${PORT}

EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT}/healthz || exit 1

CMD [ "npm", "start" ]
