# syntax=docker/dockerfile:1.6
FROM node:20-slim

ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer

# Install system deps for Chromium and fonts for better PDF rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    wget \
    gnupg \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxshmfence1 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only server package manifests first for better layer caching

COPY ./package*.json ./

# Install production deps
RUN npm ci --only=production || npm install --omit=dev

# Copy app source
COPY ./src ./src
COPY ./public ./public
COPY ./Procfile ./Procfile
COPY ./.npmrc ./.npmrc

# Create non-root user
RUN useradd -m nodeuser && chown -R nodeuser:nodeuser /app
USER nodeuser

EXPOSE 3000
CMD ["npm", "start"] 