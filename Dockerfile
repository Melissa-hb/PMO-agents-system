FROM node:22-alpine as builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

# Vite incrusta las VITE_* en el bundle al compilar: deben llegar como build args
# (en Coolify marcar "Build Variable"; en Railway las variables del servicio ya llegan al build).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist ./dist

EXPOSE 5173

CMD ["serve", "-s", "dist", "-l", "tcp://0.0.0.0:5173"]