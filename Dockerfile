# Use official Node runtime as a parent image
FROM node:20-alpine

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies exclusively for production
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Expose the API port
EXPOSE 5000

# Define environment variable (optional, default to production)
ENV NODE_ENV production

# Run the app
CMD ["node", "src/app.js"]
