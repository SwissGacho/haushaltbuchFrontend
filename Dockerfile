# --- STAGE 1: Build ---
FROM node:20-alpine AS build
WORKDIR /app

# Abhängigkeiten kopieren und installieren
COPY package*.json ./
RUN npm install

# Quellcode kopieren und bauen
COPY . .
RUN npm run build -- --configuration production

# --- STAGE 2: Serve ---
FROM nginx:stable-alpine

# Kopiere eine spezielle NGINX-Konfiguration für Angular (siehe unten)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopiere die gebauten Dateien aus Stage 1
# Ersetze 'PROJEKTNAME' durch den Namen aus deiner angular.json
COPY --from=build /app/dist/haushaltbuchFrontend /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]