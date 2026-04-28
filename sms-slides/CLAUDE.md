# Copilot Instructions — SMS Slides

## Contexto del Proyecto

Presentación interactiva para una clase universitaria de **Análisis de Señales Musicales** en la Pontificia Universidad Católica de Chile. Tema central: **Spectral Modeling Synthesis (SMS)** — el pipeline completo desde STFT hasta resíntesis con componente estocástico.

Pipeline cubierto en los slides:
```
STFT → Peak Detection → Parabolic Interpolation → MQ Tracking → Additive Synthesis → Stochastic Residual
```

## Estilo Visual

### Principios de diseño
- **Estética editorial/académica**: Inspirada en Distill.pub. Sin slides corporativas genéricas.
- **Fondo cream** (`#faf8f3`), texto oscuro (`#1a1a2e`). Nunca fondos negros puros salvo canvas 3D justificado.
- **Tipografía**: Newsreader (serif) para títulos/cuerpo, Inter (sans) para labels/UI, JetBrains Mono para datos numéricos.
- **Espaciado generoso**: Se proyecta en sala de clases. Textos y gráficos grandes.
- **Animaciones sutiles**: `anim-fade-up` para entrada, transiciones CSS suaves.

### Colores de acento (usar consistentemente)
- **Azul** `#2563eb`: componente determinista, tracks, variable `L(t)` en síntesis aditiva
- **Rojo** `#c0392b`: componente estocástico, muerte de tracks, picos parabólicos
- **Verde** `#16a34a`: nacimiento de tracks, resultados positivos, γ en interpolación
- **Ámbar** `#d97706`: advertencias, tracks débiles, α en interpolación, ROTO
- **Violeta** `#7c3aed`: pasos algorítmicos, SMS completo

### Patrones de componentes
- Cada slide es un componente React independiente (`SlideXxx.jsx`)
- Header: `<span>` con número `NN · Sección`, luego `<h2>` serif con título
- Layout típico: `flex-col lg:flex-row` con gráfico (60%) + texto (40%)
- Gráficos SVG: `viewBox` fijo, funciones de mapeo (`binToX`, `ampToY`, etc.)
- Gráficos 3D: `@react-three/fiber` + `@react-three/drei`, fondo claro `#f7f5f0`, ejes con `Html` labels
- Matemáticas: componente `<M t="..." />` (inline) o `<M t="..." d />` (display mode). Para colorear variables usar `\textcolor{#hex}{...}` dentro del string LaTeX.

### Patrón de pasos interactivos
- State `step` controlado por botón manual (NO `setTimeout` automático — el profesor controla el ritmo)
- Botón azul con label descriptivo del próximo paso
- Elementos aparecen con `opacity` + `translate-y` vía CSS transitions

### Patrón de audio
- Archivos servidos desde `public/audio/` como assets estáticos (NO importar con `import`)
- Referenciar con rutas absolutas: `/audio/violin_NN_parciales.wav` (NN zero-padded a 2 dígitos)
- Para N=1: `/audio/violin_01_parcial.wav` (singular)
- Especiales: `/audio/violin_30_roto.wav`, `/audio/violin_ruido_puro.wav`, `/audio/violin_sms_completo.wav`, `/audio/violin_original.wav`
- Usar `new Audio(src)` + `.play()/.pause()` (HTML Audio API). Para sliders con cambio rápido: debounce ~280ms antes de cargar nuevo archivo.

## Slides actuales (9 total)

| # | Componente | Patrón de interactividad |
|---|-----------|--------------------------|
| 01 | `SlidePortada` | Animación de entrada, sin interacción |
| 02 | `SlidePicketFence` | Slider de frecuencia + Web Audio API (oscilador sintético) |
| 03 | `SlideParabola` | SVG interactivo con dragging |
| 04 | `SlideMath` | Botón "Siguiente Paso" manual (state `step`) |
| 05 | `SlideTracking` | Three.js 3D + botón "Siguiente Paso" (6 estados) |
| 06 | `SlidePipelineSMS` | 4 pasos con botón manual. Cada paso muestra una imagen real con fade. Columna izquierda: audio + tarjetas verticales. Columna derecha: `ImagePanel` con transición opacity |
| 07 | `SlideFormulaInteractiva` | Slider 1–30 → `\textcolor` en KaTeX + debounce audio |
| 08 | `SlideSMS` | Three.js 3D con auto-rotate (sin interacción de pasos) |
| 09 | `SlideAudioShowcase` | Lista de capas clicables, una reproducción a la vez |

## Imágenes estáticas (public/imagenes/)

Servidas por Vite desde `public/imagenes/`. Referenciar siempre con rutas `/imagenes/...`.

| Archivo | Slide que lo usa | Fuente |
|---------|-----------------|--------|
| `violin_stft.png` | `SlidePipelineSMS` paso 1 | `generacionsenales/generar_stft.py` |
| `PeakDetection.jpg` | `SlidePipelineSMS` paso 2 | `sms-slides/imagenes/` (pedagógica) |
| `Parabola.png` | `SlidePipelineSMS` paso 3 | `sms-slides/imagenes/` (pedagógica) |
| `violin_plot_tracks.png` | `SlidePipelineSMS` paso 4 + `SlideAudioShowcase` | `generacionsenales/demo_sms_cello.py` |

## Patrón de imagen-por-paso (`SlidePipelineSMS`)

`SlidePipelineSMS` usa un componente interno `ImagePanel` que hace fade entre imágenes al cambiar de paso:
- Layout 2 columnas: izquierda (240px fijo) = audio player + tarjetas verticales; derecha = panel imagen
- Cada card en PIPELINE tiene campos `image`, `caption`, `color`, `bg`
- Al revelar un paso, `ImagePanel` hace fade-out (260ms) → swap imagen → fade-in
- La tarjeta activa muestra `desc`; las reveladas anteriores se muestran compactas; las pendientes aparecen en gris fantasma
- No hay "Ver resultado final" separado — el paso 4 (Tracking MQ) ES el resultado final
- Botón cambia de color con el color del paso activo; al llegar al paso 4 el siguiente clic reinicia

## Conexión con generacionsenales/

Los audios `public/audio/` y las imágenes `public/imagenes/violin_*.png` son generados por los scripts Python en `../generacionsenales/`. Si se regeneran los audios o imágenes, copiar con los nombres cortos definidos en `generacionsenales/README.md`.

## Contexto Teórico Externo

> La fundamentación matemática completa (STFT, interpolación parabólica, MQ, modelado estocástico) está en:
> **[`contexto_teorico_sms.md`](contexto_teorico_sms.md)**
>
> Consultarlo antes de implementar cualquier fórmula.

## Teoría DSP Relevante

### Pipeline SMS completo
1. **STFT**: Señal → frames solapados con ventana Hann → FFT por frame → `|X(k, m)|` en dBFS
2. **Peak Detection**: máximos locales en `|X(k)|` que superen umbral. Rango: 60–8000 Hz.
3. **Parabolic Interpolation**: refinar frecuencia sub-bin con α, β, γ (bins k-1, k, k+1):
   - `δ = ½(α - γ) / (α - 2β + γ)`
   - `f_peak = (k_max + δ) × Δf`
4. **Peak Tracking (McAulay-Quatieri)**:
   - Ordenar tracks activos por magnitud descendente (**Regla de Oro**: mayor energía = mayor prioridad)
   - Match → Death → Birth por frame
   - Tracks cortos (< `MIN_TRACK_LEN` frames) se descartan como ruido
5. **Additive Synthesis**: fase continua acumulando `2π·f(n)/sr` muestra a muestra. Frecuencia y amplitud interpoladas linealmente entre frames.
6. **Stochastic Residual**: `residuo = original − síntesis_determinista` → STFT → filtro mediana (50 bins, eje frecuencial) → fase aleatoria → ISTFT. Elimina sinusoides fantasmas por desajuste de fase φ₀.

### Constantes pedagógicas
- `N_FFT = 2048`, `fs = 44100 Hz` → `Δf = 21.53 Hz/bin`
- Ejemplo sub-bin: α = -15 dB, β = -3 dB, γ = -6 dB → δ ≈ 0.3

### Convenciones Three.js
- **X = Tiempo** (frames, izquierda → derecha)
- **Y = Magnitud** (dB, abajo → arriba)
- **Z = Frecuencia** (Hz, profundidad)
- Cámara: `[6, 5, 8]` o `[7, 5, 7]`, FOV 40–42. Iluminación ambient 0.7–0.9 + directional suave.

## Reglas Importantes

1. **No verificar en navegador** tras cada cambio — el usuario lo revisará.
2. **Zero-scroll design**: cada slide debe caber sin scroll (proyección en sala).
3. **Matemáticas en KaTeX** (nunca MathJax). `\textcolor{#hex}{...}` para colorear. `trust: true, strict: false` en las opciones de KaTeX cuando se usen colores hex.
4. **Consistencia cromática**: si α es ámbar en la fórmula, su representación gráfica también lo es.
5. **Botones de paso son del profesor**: no automatizar con timers.
6. **Audio**: nunca importar WAV con `import` — siempre rutas `/audio/...` hacia `public/`.
