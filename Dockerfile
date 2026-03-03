FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN HUSKY=0 npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "app.js"]
