# --- STAGE 1: Build ---
# Use a Debian-slim base to improve compatibility with QEMU emulation
FROM node:24-bookworm-slim AS stage1
WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm ci

# Quellcode kopieren und bauen
COPY . .

# Add version information
ARG APP_VERSION=unknown
RUN echo "export const VERSION = '${APP_VERSION}';" > src/environments/version.ts

RUN npm run build -- --configuration production

# --- STAGE 2: Serve ---
# Use Debian-based nginx image for compatibility
FROM nginx:stable AS stage2

# Kopiere eine spezielle NGINX-Konfiguration für Angular (siehe unten)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopiere die gebauten Dateien aus Stage 1
# Ersetze 'PROJEKTNAME' durch den Namen aus deiner angular.json
COPY --from=stage1 /app/dist/haushaltbuchFrontend/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]