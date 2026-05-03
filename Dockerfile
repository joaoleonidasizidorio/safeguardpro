FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 6001

# Set the port for Vite
ENV PORT=6001

CMD ["npm", "run", "dev", "--", "--port", "6001", "--host"]
