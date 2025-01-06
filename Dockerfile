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

# Install serve     
RUN npm install -g serve
EXPOSE 8081 

# Serve the app
CMD ["serve", "-s", "build"]

# Production stage  
# FROM node:22-bullseye-slim AS production

# WORKDIR /app            
# COPY --from=builder /app/build ./build

# EXPOSE 8081

# CMD ["serve", "-s", "build"]

