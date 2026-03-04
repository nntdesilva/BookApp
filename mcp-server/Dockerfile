FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
ENV MCP_PORT=3006
EXPOSE 3006
ENV MCP_TRANSPORT=http
CMD ["node", "mcp-server.js"]
