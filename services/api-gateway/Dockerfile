FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json lerna.json ./
COPY services/api-gateway/package.json ./services/api-gateway/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install dependencies
RUN npm install
RUN npx lerna bootstrap --scope=@opencode/api-gateway --include-dependencies

# Copy source code
COPY services/api-gateway ./services/api-gateway
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY tsconfig.json ./

# Build the service
RUN npx lerna run build --scope=@opencode/api-gateway --include-dependencies

# Expose port
EXPOSE 8080

# Set command
CMD ["node", "services/api-gateway/dist/index.js"]