# Barber Studio Cruzito - Aplicación Web

Este es el repositorio para el sitio web y sistema de reservas de Barber Studio Cruzito. La aplicación está construida con un frontend de Vanilla JS y un backend de Node.js con Express y Prisma.

## Cómo Iniciar el Proyecto Localmente

1.  Clona el repositorio.
2.  Instala las dependencias del backend: `npm install`.
3.  Crea un archivo `.env` en la raíz y añade la siguiente variable para la base de datos SQLite:
    `DATABASE_URL="file:./dev.db"`
4.  Ejecuta las migraciones de Prisma para crear la base de datos: `npx prisma migrate dev`.
5.  (Opcional) Puebla la base de datos con datos de ejemplo: `npm run db:seed`.
6.  Inicia el servidor y el frontend simultáneamente: `npm run dev`.

## Variables de Entorno

El archivo `.env` es necesario para ejecutar el proyecto. Contiene las siguientes claves:

-   `DATABASE_URL`: La cadena de conexión a la base de datos (SQLite para desarrollo, PostgreSQL para producción).
