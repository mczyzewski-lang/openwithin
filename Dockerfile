# OpenWithin — image for Railway (or any Docker host).
# FFmpeg is required at runtime: it assembles every recording (silences, ambient bed, loudness).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Values baked into statically generated pages (canonical URLs, hreflang, sitemap).
# Railway passes service variables to the build when they are declared as ARG.
ARG APP_URL
ARG NEXT_PUBLIC_HERO_VIDEO_URL
ENV APP_URL=$APP_URL
ENV NEXT_PUBLIC_HERO_VIDEO_URL=$NEXT_PUBLIC_HERO_VIDEO_URL
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "scripts/start.sh"]
