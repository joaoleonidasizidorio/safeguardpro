FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Install PostgreSQL client for backups
RUN apk add --no-cache postgresql-client

COPY . .

# Compile TypeScript
RUN npx tsc

EXPOSE 7000

CMD ["npm", "run", "dev"]
