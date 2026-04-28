# SMS Slides — Modelado Sinusoidal y Peak Tracking

Presentación interactiva para la clase de **Análisis de Señales Musicales** de la Pontificia Universidad Católica de Chile. Construida con React + Vite, KaTeX, TailwindCSS v4, y Three.js.

Los audios e imágenes que usa la presentación son generados por el script Python en [`../generacionsenales/`](../generacionsenales/).

---

## Slides (9 en total)

| # | Label en nav | Componente | Tema e interactividad |
|---|---|---|---|
| 01 | Portada | `SlidePortada.jsx` | Título y subtítulo. Animación de entrada |
| 02 | Picket-Fence | `SlidePicketFence.jsx` | Fuga espectral. Slider de frecuencia + oscilador Web Audio API |
| 03 | Parábola | `SlideParabola.jsx` | Interpolación parabólica: SVG interactivo con dragging |
| 04 | Sub-Bin | `SlideMath.jsx` | Matemática δ, f_peak paso a paso. Botón manual |
| 05 | MQ Track | `SlideTracking.jsx` | Tracking MQ 3D (Three.js). 6 estados con botón manual |
| 06 | Pipeline SMS | `SlidePipelineSMS.jsx` | Pipeline completo (4 pasos). Imagen real por cada paso |
| 07 | Síntesis Aditiva | `SlideFormulaInteractiva.jsx` | Fórmula `s(t)` con slider 1–30 parciales + audio con debounce |
| 08 | Separación SMS | `SlideSMS.jsx` | Tracks azules (determinista) vs partículas rojas (estocástico) 3D |
| 09 | Resultados | `SlideAudioShowcase.jsx` | 7 capas de audio reproducibles (original, 3/10/30 parciales, ruido, SMS, ROTO) |

---

## Stack Tecnológico

- **Framework**: React 19 + Vite 8
- **Estilos**: TailwindCSS v4 con tema personalizado (colores cream/ink)
- **Tipografía**: Newsreader (serif), Inter (sans), JetBrains Mono (mono) — cargadas desde Google Fonts vía `index.html`
- **Matemáticas**: KaTeX con `\textcolor` para resaltar variables dinámicamente (componente `<M>` en `Math.jsx`)
- **3D**: Three.js vía `@react-three/fiber` + `@react-three/drei`
- **Audio**: HTML Audio API (`new Audio(src)`) con debounce en `SlideFormulaInteractiva`

---

## Desarrollo

```bash
npm install
npm run dev
# Servidor en http://localhost:4020/
```

---

## Navegación

- **← →** o **Espacio**: navegar entre slides
- **Dots** en el footer: saltar a cualquier slide directamente
- **Botón "Siguiente Paso"**: avance manual dentro de slides 04 y 05
- **Botón "Paso N"** en slide 06: avanza el pipeline mostrando la imagen del paso
- **Slider**: en slide 07, cambia el número de parciales y reproduce el audio correspondiente

---

## Estructura de archivos

```
sms-slides/
├── CLAUDE.md                   # Instrucciones para agente IA — leer primero
├── contexto_teorico_sms.md     # Fundamentos matemáticos (STFT, δ, MQ, SMS)
├── README.md                   # Este archivo
├── index.html                  # Entry point HTML (incluye Google Fonts)
├── vite.config.js
├── public/
│   ├── audio/                  # WAVs servidos estáticamente
│   │   ├── violin_original.wav
│   │   ├── violin_01_parcial.wav
│   │   ├── violin_02_parciales.wav … violin_30_parciales.wav
│   │   ├── violin_30_roto.wav
│   │   ├── violin_residuo_crudo.wav
│   │   ├── violin_ruido_puro.wav
│   │   └── violin_sms_completo.wav
│   └── imagenes/               # Imágenes servidas estáticamente
│       ├── violin_stft.png         ← espectrograma STFT (de generar_stft.py)
│       ├── PeakDetection.jpg       ← diagrama pedagógico (fuente: sms-slides/imagenes/)
│       ├── Parabola.png            ← diagrama pedagógico (fuente: sms-slides/imagenes/)
│       └── violin_plot_tracks.png  ← gráfico MQ tracks (de demo_sms_cello.py)
├── imagenes/                   # Originales de imágenes pedagógicas (NO servidas por Vite)
│   ├── 641703__...violin-single-note-swell_stft.png
│   ├── PeakDetection.jpg
│   └── Parabola.png
└── src/
    ├── App.jsx                 # Router de slides + navegación con teclado
    ├── main.jsx                # Entry point React
    ├── index.css               # Tema, animaciones, range slider thumb
    └── components/
        ├── Math.jsx                    # Wrapper KaTeX (<M t="..." /> y <M t="..." d />)
        ├── SlidePortada.jsx            # Slide 01
        ├── SlidePicketFence.jsx        # Slide 02
        ├── SlideParabola.jsx           # Slide 03
        ├── SlideMath.jsx               # Slide 04
        ├── SlideTracking.jsx           # Slide 05
        ├── SlidePipelineSMS.jsx        # Slide 06
        ├── SlideFormulaInteractiva.jsx # Slide 07
        ├── SlideSMS.jsx                # Slide 08
        └── SlideAudioShowcase.jsx      # Slide 09
```

---

## Archivos de audio

Los WAVs en `public/audio/` son generados por `../generacionsenales/demo_sms_cello.py` y copiados con nombres cortos. Para regenerarlos:

```bash
cd ../generacionsenales
python demo_sms_cello.py
# Luego copiar outputs/ → sms-slides/public/audio/ con nombres cortos
```

La correspondencia de nombres está documentada en [`../generacionsenales/README_Python_DSP.md`](../generacionsenales/README_Python_DSP.md).

---

## Imágenes

Las imágenes en `public/imagenes/` provienen de dos fuentes:

| Imagen en public/imagenes/ | Fuente original | Cómo regenerar |
|---|---|---|
| `violin_stft.png` | `../generacionsenales/outputs/*_stft.png` | `python generar_stft.py` en generacionsenales/ |
| `violin_plot_tracks.png` | `../generacionsenales/outputs/*_plot_tracks.png` | `python demo_sms_cello.py` |
| `PeakDetection.jpg` | `sms-slides/imagenes/PeakDetection.jpg` | Copiar manualmente |
| `Parabola.png` | `sms-slides/imagenes/Parabola.png` | Copiar manualmente |

---

## Contexto Teórico

La fundamentación matemática detallada (STFT, interpolación parabólica, algoritmo MQ, separación SMS, modelado estocástico) está en:

**[`contexto_teorico_sms.md`](contexto_teorico_sms.md)**

Este archivo es la fuente canónica para el agente IA y para referencia matemática estricta.

---

## Sistema de Diseño

- **Fondo**: cream `#faf8f3`
- **Texto**: ink `#1a1a2e`, variantes `ink-light`, `ink-muted`, `ink-faint`
- **Acentos**: azul `#2563eb` (determinista), rojo `#c0392b` (estocástico/muerte), verde `#16a34a` (nacimiento), ámbar `#d97706` (advertencia/ROTO), violeta `#7c3aed` (SMS completo)
- **Bordes**: `#e0ddd4` / `#eae7df`
- **Animaciones**: `anim-fade-up`, `anim-fade`, `anim-draw`, `anim-pulse` con clases `delay-1` … `delay-10`
