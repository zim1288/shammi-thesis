FROM php:8.2-apache

# 1. Install system dependencies & MongoDB build tools
RUN apt-get update && apt-get install -y \
    libssl-dev \
    curl \
    git \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# 2. Install and enable official PHP MongoDB Driver extension
RUN pecl install mongodb \
    && docker-php-ext-enable mongodb

# 3. Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# 4. Enable Apache Rewrite & Headers modules
RUN a2enmod rewrite headers \
    && sed -i 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Set working directory
WORKDIR /var/www/html

# Copy application files
COPY . /var/www/html/

# Install Composer dependencies (MongoDB client library)
RUN composer install --no-dev --optimize-autoloader --no-interaction --ignore-platform-req=ext-mongodb

# Ensure web server write access to local fallback data directory
RUN chown -R www-data:www-data /var/www/html/backend/data_store \
    && chmod -R 775 /var/www/html/backend/data_store

# Configure Apache to bind to the dynamic PORT provided by Render (default 10000)
ENV PORT=10000
RUN sed -i 's/80/${PORT}/g' /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 10000

CMD ["apache2-foreground"]
