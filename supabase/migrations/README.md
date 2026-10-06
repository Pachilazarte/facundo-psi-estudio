# Migraciones de Supabase — PsiEstudio

Este directorio contiene las migraciones SQL secuenciales para configurar y mantener la base de datos de PostgreSQL en Supabase.

## 📋 Orden de Ejecución

Deben ejecutarse en la consola SQL de Supabase (`SQL Editor`) en el siguiente orden estricto:

### 1. `0001_esquema.sql` (Esquema Base)
- Crea las 6 tablas fundamentales: `materias`, `bibliografia`, `clases`, `apuntes`, `documentos_pdf`, `examenes`.
- Define claves primarias, relaciones por clave foránea y tablas auxiliares como `supabase_keep_alive`.
- Copia espejo del archivo de la raíz `supabase_schema.sql`.

### 2. `0001b_columnas_que_usa_la_app.sql` (Columnas Complementarias)
- Añade columnas requeridas por `app.jsx` que no estaban en el esquema original:
  - `clases`: `desgrabacion_md`, `grabaciones`, `imagenes`, `temas_enfasis`.
  - `documentos_pdf`: `titulo`, `tipo`, `nro_parcial`.

### 3. `0002_clave_de_app.sql` (Seguridad RLS con Clave de App)
- Configura Row Level Security (RLS) en todas las tablas.
- Crea el esquema privado `private.config` y la función `clave_valida()`.
- Bloquea el acceso anónimo indiscriminado: exige que cada petición HTTP incluya el header `x-app-token`.
- **Nota:** Reemplazar `REEMPLAZAR_POR_TU_CLAVE` con el token configurado antes de ejecutarlo.

### 4. `0003_sync.sql` (Sincronización y Anti-Resurrección de Datos)
- Añade columnas `updated_at` (TIMESTAMPTZ) y `deleted_at` (TIMESTAMPTZ) a todas las tablas principales.
- Crea el trigger `set_updated_at()` para actualizar `updated_at` en cada modificación.
- Habilita soft deletes para evitar que dispositivos sin conexión revivan datos previamente eliminados.
- Crea índices compuestos `(deleted_at, updated_at)` para consultas de sincronización de alta velocidad.
