FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json lerna.json ./
COPY services/auth-service/package.json ./services/auth-service/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install dependencies
RUN npm install
RUN npx lerna bootstrap --scope=@opencode/auth-service --include-dependencies

# Copy source code
COPY services/auth-service ./services/auth-service
COPY packages/shared-types ./packages/shared-types
COPY packages/shared-utils ./packages/shared-utils
COPY tsconfig.json ./

# Build the service
RUN npx lerna run build --scope=@opencode/auth-service --include-dependencies

# Expose port
EXPOSE 3000

# Set command
CMD ["node", "services/auth-service/dist/index.js"]