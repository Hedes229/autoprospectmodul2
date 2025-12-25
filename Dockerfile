FROM nginx:alpine

# Copier les fichiers build
COPY dist/ /usr/share/nginx/html/

# Configuration Nginx pour SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
