FROM oven/bun:1.1-alpine

# Copy application files
COPY . /app/

# Set working directory
WORKDIR /app

# Install dependencies
RUN bun install

# Start the application
CMD ["bun", "run", "start"]