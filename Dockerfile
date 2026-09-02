FROM oven/bun:1
WORKDIR /app

# ghostscript utk kompresi PDF upload
RUN apt-get update && apt-get install -y --no-install-recommends ghostscript && rm -rf /var/lib/apt/lists/*

# layer cache: deps dulu
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src

ENV NODE_ENV=production
# folder uploads harus writable oleh user bun (volume mount mewarisi ownership ini)
RUN mkdir -p /app/uploads && chown bun:bun /app/uploads
USER bun
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
