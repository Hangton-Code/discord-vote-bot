FROM oven/bun:1.0.0-alpine

# Copy application files
COPY . /app/

# Set working directory
WORKDIR /app

# Install dependencies
RUN bun install

# Build the project
RUN bun run build

# Start the application
CMD ["bun", "run", "start"]