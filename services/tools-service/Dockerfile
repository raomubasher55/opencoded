FROM node:18-alpine

WORKDIR /app

# Install Docker client inside the container (for Docker-in-Docker)
RUN apk add --no-cache docker-cli

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY dist/ ./dist/

# Expose the service port
EXPOSE 3004

# Start the service
CMD ["node", "dist/index.js"]