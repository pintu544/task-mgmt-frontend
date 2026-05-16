# syntax=docker/dockerfile:1

# Multi-stage image for the React frontend.
#
# Stage 1 builds the static bundle with Vite. Stage 2 serves it through
# nginx with SPA-style fallback so client-side routes (/projects/:id)
# don't 404 on direct visits.

# --- Stage 1: build ---------------------------------------------------------
FROM node:18-alpine AS builder

WORKDIR /app

# Install deps with the lockfile if present for reproducible builds.
COPY package*.json ./
RUN npm ci

# Build-time configuration. Vite inlines VITE_* env vars at build time,
# so they must be passed as build args.
ARG VITE_LARAVEL_API_URL=http://localhost:8000
ARG VITE_DJANGO_API_URL=http://localhost:8001
ENV VITE_LARAVEL_API_URL=$VITE_LARAVEL_API_URL
ENV VITE_DJANGO_API_URL=$VITE_DJANGO_API_URL

COPY . .
RUN npm run build

# --- Stage 2: runtime -------------------------------------------------------
FROM nginx:alpine

# SPA-style fallback so deep links work.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built bundle.
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
