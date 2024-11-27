# Build stage
FROM node:22-bullseye-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Serve the app
CMD ["npm", "run", "start --port 80 --host 0.0.0.0"]