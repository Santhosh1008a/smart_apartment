# Match the Node 24 runtime declared by the app and CI.
FROM node:24-bookworm-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies exclusively for production
RUN npm ci --omit=dev

# Copy the rest of the application code with non-root ownership
COPY --chown=node:node . .

# Runtime directories are empty by design; uploaded avatars use Supabase Storage.
RUN mkdir -p uploads && chown node:node uploads

USER node

# Expose the API port
EXPOSE 5000

# Define environment variable (optional, default to production)
ENV NODE_ENV production

# Report unhealthy when the app or its database connection is unavailable
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Run the app
CMD ["node", "src/app.js"]
