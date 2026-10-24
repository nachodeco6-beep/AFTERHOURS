# Buscador de AFTERHOURS (Cloudflare Worker)

Este es un programa chiquito que vive en Cloudflare y hace de intermediario entre la web de
AFTERHOURS y Unsplash. Sirve para que la **clave de Unsplash nunca aparezca en la web ni en GitHub**:
la web le pide fotos al Worker, y el Worker se las pide a Unsplash usando la clave, que guarda
en secreto.

Tiene dos direcciones:

| Dirección | Para qué sirve |
| --- | --- |
| `/search?query=surf&per_page=15&page=1` | Busca fotos y devuelve `{ total, photos }` |
| `/download?id=…` | Avisa a Unsplash que se descargó una foto (lo exige Unsplash; se usa en una etapa futura) |

Necesitás dos cuentas gratuitas: una en **Unsplash** y otra en **Cloudflare**. Se hace una sola vez
y lleva unos 15 minutos.

> Los nombres de los botones de Unsplash y Cloudflare pueden cambiar un poco con el tiempo. Si no
> encontrás uno exacto, buscá el que diga algo parecido.

---

## Paso 1 — Conseguir la clave de Unsplash

1. Entrá a https://unsplash.com/join y creá una cuenta (o iniciá sesión).
2. Entrá a https://unsplash.com/oauth/applications y tocá **«New Application»**.
3. Aceptá las condiciones de uso de la API y poné un nombre, por ejemplo `AFTERHOURS`.
4. En la página de tu aplicación, bajá hasta **«Keys»** y copiá la **«Access Key»**.
   - **No** uses la «Secret Key»: no hace falta.
   - Guardala en un lugar seguro. **Nunca la pegues en el código ni la subas a GitHub.**

Las aplicaciones nuevas arrancan en **modo demo**, que permite **50 pedidos por hora**. Cada
etiqueta que buscás en el Studio usa 1 pedido. Más adelante podés pedirle a Unsplash el
modo «Production» (5.000 por hora) desde la página de tu aplicación.

---

## Paso 2 — Publicar el Worker desde el panel web de Cloudflare (sin programar)

1. Entrá a https://dash.cloudflare.com y creá una cuenta gratuita (o iniciá sesión).
2. En el menú de la izquierda entrá a **«Workers & Pages»** (puede aparecer dentro de **«Compute»**).
3. Tocá **«Create»** y elegí empezar con el ejemplo **«Hello World»**.
4. Poné de nombre **`afterhours-search`** y tocá **«Deploy»**.
5. Tocá **«Edit code»**. Se abre un editor con un poco de código de ejemplo:
   1. Abrí el archivo [`worker/worker.js`](./worker.js) de este repositorio en GitHub y tocá el botón
      para copiar el archivo entero (o el botón «Raw» y copiá todo el texto).
   2. En el editor de Cloudflare, borrá **todo** el código de ejemplo y pegá lo que copiaste.
   3. Tocá **«Deploy»**.
6. Volvé a la página del Worker y entrá a **«Settings» → «Variables and Secrets»**:
   1. Tocá **«Add»**.
   2. Tipo: **«Secret»**. Nombre: **`UNSPLASH_ACCESS_KEY`** (escrito exactamente así).
      Valor: la Access Key que copiaste en el Paso 1.
   3. Guardá con **«Deploy»**.
7. Copiá la dirección de tu Worker. Aparece en la página del Worker y se ve parecida a
   `https://afterhours-search.TU-USUARIO.workers.dev`.

### Probar que funciona

- Abrí la dirección del Worker en el navegador. Tenés que ver algo como
  `{"service":"afterhours-search","ok":true,"keyConfigured":true,…}`.
  Si dice `"keyConfigured":false`, falta el secreto del paso 6.
- Agregale `/search?query=surf` al final. Tenés que ver un texto largo con `"photos"`.

### ¿Desde qué páginas se puede usar?

Por defecto, el Worker solo responde a la web publicada (`https://nachodeco6-beep.github.io`) y a la
versión local (`http://localhost:5173`). Si alguna vez la web cambia de dirección, en
**«Settings» → «Variables and Secrets»** agregá una variable de tipo **«Text»** llamada
**`ALLOWED_ORIGINS`** con las direcciones separadas por comas, por ejemplo:
`https://nachodeco6-beep.github.io,http://localhost:5173`.

### Actualizar el Worker más adelante

Cuando cambie el código, repetí el paso 5: copiá de nuevo `worker/worker.js` y pegalo reemplazando todo.
El secreto no se pierde.

---

## Paso 3 — Conectar la web con el Worker

1. En la carpeta principal del proyecto (no en `worker/`), creá un archivo llamado **`.env.local`**.
2. Escribí adentro una sola línea con la dirección de tu Worker, **sin barra al final**:

   ```
   VITE_SEARCH_API_URL=https://afterhours-search.TU-USUARIO.workers.dev
   ```

3. Si la web estaba corriendo con `npm run dev`, cerrala y volvé a abrirla.
4. Entrá al Studio: ya no tiene que aparecer el aviso de «modo demo».

`.env.local` no se sube a GitHub (está ignorado) y sirve para probar en tu compu.

Para la **versión publicada**, poné la misma línea en el archivo **`.env.production`** (también en la
carpeta principal). Ese archivo sí se sube a GitHub, así `npm run deploy` funciona desde cualquier
máquina. La dirección del Worker no es secreta, pero la clave de Unsplash sí, y **nunca** va en
`.env.local` ni en `.env.production`.

---

## Alternativa: publicar con la terminal (`wrangler`)

Si te sentís cómodo con la terminal:

```bash
cd worker
npm install
npx wrangler login                          # abre el navegador para entrar a Cloudflare
npx wrangler secret put UNSPLASH_ACCESS_KEY # te pide la Access Key y la guarda en secreto
npm run deploy                              # publica el Worker
```

Para probarlo en tu computadora, creá `worker/.dev.vars` (ignorado por git) con
`UNSPLASH_ACCESS_KEY=tu_access_key` y corré `npm run dev`. Queda en `http://localhost:8787`.

---

## Qué significan los errores

Cuando algo falla, el Worker responde con un JSON como
`{ "error": { "code": "…", "message": "…" } }`. El Studio los muestra en castellano.

| Código | Qué pasó | Qué hacer |
| --- | --- | --- |
| `missing_key` | El Worker no tiene cargada la clave | Cargá el secreto `UNSPLASH_ACCESS_KEY` (Paso 2.6) |
| `invalid_key` | Unsplash rechazó la clave | Revisá que pegaste la **Access Key** completa, sin espacios |
| `rate_limited` | Se gastaron los pedidos de la hora | Esperá hasta la hora siguiente. Incluye `rateLimitRemaining` |
| `unsplash_error` | Unsplash respondió con un error | Probá en unos minutos. Incluye `upstreamStatus` |
| `unsplash_unreachable` | No se pudo hablar con Unsplash | Probá en unos minutos |
| `origin_not_allowed` | La página que pidió fotos no está autorizada | Revisá `ALLOWED_ORIGINS` |
| `invalid_params` | La búsqueda vino mal armada (vacía, muy larga…) | — |

---

## Cómo ahorra pedidos

- Las búsquedas repetidas se guardan **una hora**. Con un dominio propio en Cloudflare se usa la
  caché de Cloudflare. En las direcciones `*.workers.dev` esa caché no funciona (es una limitación de
  Cloudflare), así que el Worker además guarda las últimas búsquedas en memoria; esa memoria es
  temporal y se puede borrar sola.
- El navegador también guarda cada respuesta una hora.
- El Studio no repite una etiqueta que ya buscaste en la misma visita.

---

## Para quien programa

- El código fuente está en `src/index.ts` (TypeScript). Los tipos que comparte con la web están en
  `../shared/types.ts`.
- `worker.js` es el mismo código en un solo archivo JavaScript, para pegar en el panel. **No lo
  edites a mano**: se genera con `npm run build`.
- `npm test` arma `worker.js` y lo prueba con respuestas de Unsplash simuladas.
- `npm run typecheck` revisa los tipos.
