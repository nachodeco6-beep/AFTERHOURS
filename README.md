# AFTERHOURS — From vision to visual

AFTERHOURS es un generador de moodboards. Escribís una idea en español, la app la corta en
etiquetas y busca **fotografías reales en Unsplash** para cada una, siempre con el crédito de su
autor.

Web publicada: https://nachodeco6-beep.github.io/AFTERHOURS/

> **Etapa 3 de 5.** Ya funcionan la búsqueda real de fotos, la selección, el moodboard (plantillas,
> formatos, paleta, tipografías, palabras clave y notas), guardar tableros y el Type Lab. Exportar llega
> en la próxima etapa.

## Qué hay hoy

- **Portada (`#/`)**: hero con paisaje animado, reloj local y el titular FROM / VISION / TO / VISUAL,
  más una sección «Cómo funciona».
- **Studio (`#/studio`)**: escribís la idea separando conceptos con comas. Cada parte se vuelve una
  etiqueta (hasta 6) que podés editar, sacar o sumar a mano. «Buscar referencias» hace una búsqueda
  en Unsplash por etiqueta y muestra las fotos agrupadas, sin repetidas, con filtros por etiqueta y
  un visor con la foto grande, el crédito y el color dominante.
- **Selección**: cada foto tiene un botón + para sumarla a «Tu selección» (bandeja fija abajo, de 3 a
  12 fotos). «Completar por mí» suma fotos del pozo hasta 9 sin tocar las elegidas: representa todas
  las etiquetas, cuida la coherencia de color, mezcla orientaciones y no repite fotógrafo más de 2 veces.
- **Moodboard**: antes de armarlo elegís qué incluir (paleta, tipografías, palabras clave, notas o
  solo imágenes). Tres plantillas: Editorial, Collage y Grilla. Título editable, reordenar arrastrando
  o con «Antes/Después», sacar o reemplazar fotos, y créditos sobre cada foto y al pie del tablero.
  Tres formatos de lámina: 16:9, 4:5 y A4.
- **Paleta**: 5 colores leídos de los píxeles de las fotos; si no se pueden leer, se usan los colores
  que informa Unsplash (y se aclara). Clic o Enter copia el HEX.
- **Tipografías**: 62 pares de Google Fonts (`src/data/typePairs.ts`); se elige el que mejor coincide
  con las palabras del concepto y solo se cargan esas dos fuentes.
- **Type Lab**: un panel para probar pares o fuentes sueltas (titular fijo y otro texto, o al revés)
  con el título y las palabras del tablero, filtrando por estilo; ajusta peso del titular (solo los que
  la fuente tiene, medidos contra Google Fonts en `src/data/fontWeights.ts`), espaciado, interlineado y
  mayúsculas, y avisa cuando algo puede costar leerse en chico. Las muestras cargan su fuente de a una,
  cuando aparecen en pantalla.
- **Mis tableros**: «Guardar» deja el tablero en este navegador (localStorage, `src/lib/saved.ts`):
  ajustes, fotos en orden con sus créditos y lo elegido en el Type Lab. Desde «Mis tableros» se abre,
  duplica, renombra o borra. Avisa antes de perder cambios sin guardar y si el navegador no deja guardar.
- **Modo demo**: si la búsqueda no está conectada, el Studio lo avisa, el botón de buscar queda
  deshabilitado y no se muestra ninguna foto.

### Cómo se compone el tablero

El tablero es una lámina de formato fijo, con medidas reales listas para exportar
(`src/lib/formats.ts`): **Horizontal 16:9** (1920 × 1080, por defecto), **Vertical 4:5**
(1080 × 1350) y **A4 vertical** (1240 × 1754, A4 a 150 ppp). El lienzo se maqueta a esa medida
dividida por un factor fijo (para que el texto se lea en pantalla) y se escala para entrar entero en
el ancho y el alto disponibles. «Ver en grande» lo abre a pantalla completa con zoom (botones, teclas
+ − 0, pellizco o ctrl + rueda).

`src/lib/compose.ts` reparte fotos y bloques dentro de ese marco con bandas horizontales que ocupan
todo el ancho; cada banda tiene columnas de una celda o de varias apiladas, y su alto natural sale de
las proporciones de lo que lleva. Una programación dinámica elige las bandas (o una columna alta para
la foto protagonista con bandas al lado) cuyos altos suman exactamente el alto del marco:

- las fotos no se deforman: lo que sobra lo absorben primero los bloques y después un recorte parejo
  y acotado (máximo 45%, ~6% en promedio),
- la primera foto elegida ocupa la celda más grande (en Grilla puede empatar),
- los bloques de paleta, tipografía, palabras clave y notas ocupan celdas donde su contenido entra,
  integrados entre las fotos; si se apagan, las fotos ocupan su lugar,
- todo llena el marco completo, así que no quedan huecos.

Mientras el tablero está en pantalla, la bandeja «Tu selección» se achica a una barra mínima
(contador + «Editar selección») para no taparlo.

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
| `npm test` | Tests de la lógica pura (selección, composición, paleta, tipografías, notas) con `node --test` |
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
  components/moodboard Moodboard, BoardCanvas, Blocks, IncludeDialog, IncludeSwitches, EditPhotosDialog
  components/          Header, Footer, Hero, HeroCanvas, Intro, Cursor, Marquee, Reveal,
                       SectionHeader, CreateButton, HowItWorks, StudioProvider
    studio/            IdeaEditor, TagChips, Results, SelectionTray, PhotoFrame, PhotoViewer, PhotoCredit
  hooks/               useStudio, useBoardData, useDialog, useClock, useMediaQuery
  lib/                 compose, select, palette(+Image), typography, fonts, notes, color, pool,
                       router, tags, searchApi, unsplash, layouts, format
  data/                typePairs (62 pares), nav
tests/                 tests de la lógica pura
shared/types.ts        tipo Photo y respuestas, compartidos con el Worker
worker/                Cloudflare Worker de búsqueda (proyecto aparte)
scripts/deploy-pages.mjs
```

## Diseño

Fondo #090909, texto #F1F0E8 y verde ácido #C7FF3D. Tipografías Big Shoulders Display, Inter Tight,
Instrument Serif y JetBrains Mono (Google Fonts incluidas en el proyecto con `@fontsource`). Las fuentes de los
pares del moodboard se piden a Google Fonts solo cuando se usan. Grano de
película, cursor propio en pantallas con mouse y animaciones que respetan «reducir movimiento» del
sistema. Funciona con teclado y desde 375 px de ancho.
