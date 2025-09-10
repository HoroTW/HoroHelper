# Use an official Nginx image as a parent image
FROM nginx:alpine

# Copy the Nginx configuration file
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static content (HTML, CSS, JS) from the host to the container
COPY . /usr/share/nginx/html

# Expose port 80 to the outside world
EXPOSE 80
