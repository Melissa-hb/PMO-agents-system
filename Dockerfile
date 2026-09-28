FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

EXPOSE 5173

CMD ["pnpm", "run", "preview", "--host"]
