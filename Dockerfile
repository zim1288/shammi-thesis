FROM php:8.2-apache

# Enable essential Apache modules and allow .htaccess overrides
RUN a2enmod rewrite headers \
    && sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Ensure web server has write access to data storage
RUN chown -R www-data:www-data /var/www/html/data_store \
    && chmod -R 775 /var/www/html/data_store

# Configure Apache to bind to the dynamic PORT provided by Render (default 10000)
ENV PORT=10000
RUN sed -i 's/80/${PORT}/g' /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 10000

CMD ["apache2-foreground"]
