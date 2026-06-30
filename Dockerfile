# Gestionale Disinfestazione — PHP 8.3 + Apache
# Web root = radice del progetto (così /public e /frontend sono entrambi raggiungibili).

FROM php:8.3-apache

# --- Estensioni PHP richieste (pdo_mysql per il DB, gd + mbstring per mPDF, zip) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpng-dev libjpeg-dev libfreetype6-dev libonig-dev libzip-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" pdo_mysql gd mbstring zip \
    && rm -rf /var/lib/apt/lists/*

# --- Apache: mod_rewrite + consenti .htaccess (AllowOverride All) ---
RUN a2enmod rewrite headers \
    && sed -ri 's!AllowOverride None!AllowOverride All!g' /etc/apache2/apache2.conf

# --- Configurazione PHP per produzione (upload foto report) ---
RUN { \
        echo 'upload_max_filesize=20M'; \
        echo 'post_max_size=24M'; \
        echo 'memory_limit=256M'; \
        echo 'max_execution_time=120'; \
        echo 'expose_php=Off'; \
    } > /usr/local/etc/php/conf.d/zz-app.ini

# --- Composer (per installare mPDF dalle dipendenze) ---
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Installa le dipendenze sfruttando la cache dei layer.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader || true

# Copia il resto del progetto.
COPY . .

# Assicura che le dipendenze siano presenti anche se vendor/ non era nel context.
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist --optimize-autoloader

# --- Permessi: storage scrivibile (upload + report) e tmp mPDF ---
RUN mkdir -p storage/uploads storage/reports storage/sdi \
    && mkdir -p vendor/mpdf/mpdf/tmp \
    && chown -R www-data:www-data storage vendor/mpdf \
    && chmod -R 775 storage

EXPOSE 80
