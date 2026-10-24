# AFTERHOURS — From vision to visual

AFTERHOURS es un generador de moodboards. Escribís una idea en español, la app la corta en
etiquetas y busca **fotografías reales en Unsplash** para cada una, siempre con el crédito de su
autor.

Web publicada: https://nachodeco6-beep.github.io/AFTERHOURS/

> **Etapa 1 de 5.** Esta etapa tiene la portada, la navegación, el Studio y la búsqueda real de
> fotos. La selección automática, las plantillas, la paleta, las tipografías, el guardado y la
> exportación llegan en las próximas etapas.

## Qué hay hoy

- **Portada (`#/`)**: hero con paisaje animado, reloj local y el titular FROM / VISION / TO / VISUAL,
  más una sección «Cómo funciona».
- **Studio (`#/studio`)**: escribís la idea separando conceptos con comas. Cada parte se vuelve una
  etiqueta (hasta 6) que podés editar, sacar o sumar a mano. «Buscar referencias» hace una búsqueda
  en Unsplash por etiqueta y muestra las fotos agrupadas, sin repetidas, con filtros por etiqueta y
  un visor con la foto grande, el crédito y el color dominante.
- **Modo demo**: si la búsqueda no está conectada, el Studio lo avisa, el botón de buscar queda
  deshabilitado y no se muestra ninguna foto.

## Correrlo en tu computadora

Necesitás [Node.js](https://nodejs.org) (versión LTS).

```bash
npm install
npm run dev        # http://localhost:5173
```

Sin más configuración, el Studio arranca en **modo demo**. Para buscar fotos de verdad:

1. Publicá el buscador (el Worker) siguiendo [`worker/README.md`](worker/README.md).
2. **Para desarrollo:** copiá `.env.example` como **`.env.local`** y completá la dirección del Worker:

   ```
   VITE_SEARCH_API_URL=https://afterhours-search.TU-USUARIO.workers.dev
   ```

   Después volvé a correr `npm run dev`. `.env.local` no se sube a GitHub.
3. **Para la versión publicada:** poné la misma dirección en **`.env.production`**. Ese archivo sí
   está versionado, para que `npm run deploy` funcione desde cualquier máquina (o desde Claude
   Code). La dirección del Worker no es secreta.

Al armar la versión publicada, `.env.production` tiene prioridad sobre `.env.local`. Si queda vacía,
la web publicada sale en modo demo.

**La clave de Unsplash nunca va en este proyecto**, ni en `.env.local` ni en `.env.production`:
vive solo como secreto dentro del Worker.

## Cómo funciona la búsqueda

```
Navegador (Studio)  →  Worker en Cloudflare  →  API de Unsplash
                        (guarda la clave)
```

- El Studio le pide al Worker `GET /search?query=…&per_page=15&page=1`, una vez por etiqueta.
- El Worker agrega la clave, llama a Unsplash con `content_filter=high`, normaliza las fotos al tipo
  `Photo` (`shared/types.ts`) y responde `{ total, photos }`.
- Las fotos se muestran con las URLs de Unsplash tal cual llegan (hotlinking), y los links al autor
  y a Unsplash llevan `utm_source=afterhours&utm_medium=referral`, como pide Unsplash.
- El Worker solo acepta pedidos de los orígenes permitidos (`ALLOWED_ORIGINS`), valida los
  parámetros, guarda las búsquedas una hora y responde errores claros en JSON (clave inválida,
  límite de pedidos, Unsplash caído).
- Las claves nuevas de Unsplash permiten **50 pedidos por hora**. El Studio avisa cuántos va a usar
  cada búsqueda y no repite las etiquetas que ya buscaste en la misma visita.

Todos los detalles, incluida la publicación paso a paso, están en [`worker/README.md`](worker/README.md).

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:5173 |
| `npm run build` | Revisa los tipos y arma la web en `dist/` |
| `npm run preview` | Sirve la versión armada |
| `npm run typecheck` | Solo revisa los tipos |
| `npm run lint` | Revisa el código con oxlint |
| `npm run deploy` | Arma la web para GitHub Pages y la publica en la rama `gh-pages` (funciona en Windows, macOS y Linux) |

Para publicar con la búsqueda conectada, `npm run deploy` usa la `VITE_SEARCH_API_URL` de
`.env.production` (versionado).

En `worker/`: `npm test` (pruebas con Unsplash simulado), `npm run typecheck`, `npm run build`
(regenera `worker.js`), `npm run dev` y `npm run deploy` (con wrangler).

## Estructura

```
src/
  App.tsx              router por hash (#/ y #/studio), foco y scroll al cambiar de vista
  views/               HomeView (portada) y StudioView
  components/          Header, Footer, Hero, HeroCanvas, Intro, Cursor, Marquee, Reveal,
                       SectionHeader, CreateButton, HowItWorks, StudioProvider
    studio/            IdeaEditor, TagChips, Results, PhotoFrame, PhotoViewer, PhotoCredit
  hooks/               useStudio, useDialog, useClock
  lib/                 router, tags, searchApi, unsplash, layouts (grilla para la etapa 2), format
shared/types.ts        tipo Photo y respuestas, compartidos con el Worker
worker/                Cloudflare Worker de búsqueda (proyecto aparte)
scripts/deploy-pages.mjs
```

## Diseño

Fondo #090909, texto #F1F0E8 y verde ácido #C7FF3D. Tipografías Big Shoulders Display, Inter Tight,
Instrument Serif y JetBrains Mono (Google Fonts incluidas en el proyecto con `@fontsource`). Grano de
película, cursor propio en pantallas con mouse y animaciones que respetan «reducir movimiento» del
sistema. Funciona con teclado y desde 375 px de ancho.
