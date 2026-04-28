# ClasesAnalisis — Análisis de Señales Musicales (PUC Chile)

Repositorio de trabajo para la clase de **Análisis de Señales Musicales** de la Pontificia Universidad Católica de Chile. El proyecto tiene dos componentes que trabajan juntos:

| Carpeta | Rol | Tecnología |
|---------|-----|-----------|
| [`generacionsenales/`](generacionsenales/) | Backend de procesamiento: análisis SMS, síntesis, generación de audio e imágenes | Python (NumPy, SciPy, Matplotlib, SoundFile) |
| [`sms-slides/`](sms-slides/) | Frontend de presentación: slides interactivos para clase | React 19 + Vite 8 + Three.js + KaTeX + TailwindCSS v4 |

---

## Flujo de datos entre carpetas

```
generacionsenales/
│
├── inputs/
│   └── violin-single-note-swell.wav      ← audio original (freesound.org #641703)
│
├── demo_sms_cello.py                     ← pipeline SMS completo (8 pasos)
│   │  Genera en outputs/:
│   ├── *_01_parcial.wav … *_30_parciales.wav
│   ├── *_30_ROTO.wav
│   ├── *_30_ruido_puro.wav
│   ├── *_30_SMS_completo.wav
│   └── *_plot_tracks.png
│
└── generar_stft.py                       ← script rápido: solo la STFT
    └── outputs/*_stft.png
         │
         ▼  (copiar manualmente con nombre corto)
         │
sms-slides/public/
├── audio/
│   ├── violin_original.wav
│   ├── violin_01_parcial.wav … violin_30_parciales.wav
│   ├── violin_30_roto.wav
│   ├── violin_ruido_puro.wav
│   └── violin_sms_completo.wav
└── imagenes/
    ├── violin_stft.png           ← de generar_stft.py
    ├── PeakDetection.jpg         ← imagen pedagógica (en sms-slides/imagenes/)
    ├── Parabola.png              ← imagen pedagógica (en sms-slides/imagenes/)
    └── violin_plot_tracks.png    ← de demo_sms_cello.py
```

> Los archivos en `public/` son servidos estáticamente por Vite. Los slides los referencian con rutas `/audio/...` e `/imagenes/...`.

---

## Quick start

### 1. Generar audios e imágenes (Python)

```bash
cd generacionsenales
pip install numpy scipy matplotlib soundfile

# Pipeline completo (~5 min sobre el archivo de violín)
python demo_sms_cello.py

# Solo el espectrograma STFT (segundos)
python generar_stft.py
```

Luego copiar los outputs a `sms-slides/public/` con los nombres cortos indicados arriba.

### 2. Levantar la presentación (React)

```bash
cd sms-slides
npm install
npm run dev
# Abre http://localhost:4020/
```

---

## Tema del proyecto

El proyecto cubre el pipeline completo de **Spectral Modeling Synthesis (SMS)** aplicado a un violín:

```
Señal WAV
  → STFT (espectrograma tiempo-frecuencia)
  → Peak Detection (máximos locales en dB)
  → Interpolación Parabólica (ajuste sub-bin, error ±10 Hz → ±0.4 Hz)
  → Tracking McAulay-Quatieri (Match / Birth / Death por frame)
  → Síntesis Aditiva (fase continua, 1–30 parciales)
  → Residuo Estocástico (ruido modelado = original − determinista)
  → SMS Completo (determinista + estocástico)
```

La presentación también incluye un **contra-ejemplo pedagógico** (`_30_ROTO.wav`): tracking sin memoria que demuestra auditivamente por qué la continuidad temporal es esencial en el algoritmo MQ.

---

## Parámetros clave (compartidos entre Python y slides)

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `N_FFT` | 2048 | Tamaño de ventana → resolución 21.53 Hz/bin a 44100 Hz |
| `HOP` | 512 | Salto entre frames → ~86 frames/segundo |
| `FREQ_TOL_HZ` | 50 | Tolerancia de matching MQ |
| `MIN_TRACK_LEN` | 5 | Frames mínimos para track válido |
| `PEAK_THRESH` | -75 dBFS | Umbral de detección de picos |

---

## Estructura de archivos Python

```
generacionsenales/
├── README_Python_DSP.md              ← documentación técnica del pipeline
├── demo_sms_cello.py                 ← pipeline completo (9 funciones + clase Track)
├── generar_stft.py                   ← script standalone: solo STFT → PNG
├── desafio_relampago_07_resuelto.py  ← implementaciones aisladas (tarea/desafío)
├── inputs/
│   └── 641703__...violin-single-note-swell.wav
└── outputs/                          ← generado automáticamente
```

## Estructura de archivos React

```
sms-slides/
├── CLAUDE.md                         ← instrucciones para agente IA (leer primero)
├── contexto_teorico_sms.md           ← fundamentos matemáticos del SMS/MQ
├── README_React_Slides.md            ← guía de desarrollo del frontend
├── src/components/
│   ├── SlidePortada.jsx              # 01 - Portada
│   ├── SlidePicketFence.jsx          # 02 - Picket-Fence (fuga espectral)
│   ├── SlideMath.jsx                 # 03 - Matemática sub-bin (paso a paso)
│   ├── SlideTracking.jsx             # 04 - Tracking MQ 3D (Three.js)
│   ├── SlideLivePipelineSMS.jsx      # 05 - Pipeline SMS de Voz (en vivo)
│   ├── SlideLiveFormula.jsx          # 06 - Síntesis Aditiva de Voz (en vivo)
│   ├── SlidePipelineSMS.jsx          # 07 - Pipeline completo (imagen por paso)
│   ├── SlideFormulaInteractiva.jsx   # 08 - Síntesis aditiva (slider + audio)
│   ├── SlideResiduoVsRuido.jsx       # 09 - Modelado estocástico (Residuo vs Ruido)
│   └── SlideGlitches.jsx             # 10 - Resultados & Autopsia del Tracking
└── public/
    ├── audio/                        ← WAVs generados por demo_sms_cello.py
    └── imagenes/                     ← PNGs/JPGs generados por scripts Python
```

---

## Documentos de referencia

| Archivo | Propósito |
|---------|-----------|
| [`sms-slides/CLAUDE.md`](sms-slides/CLAUDE.md) | Instrucciones de diseño y código para agente IA — **leer primero en cada sesión** |
| [`sms-slides/contexto_teorico_sms.md`](sms-slides/contexto_teorico_sms.md) | Fundamentos matemáticos: STFT, δ parabólico, MQ, SMS — fuente canónica |
| [`generacionsenales/README_Python_DSP.md`](generacionsenales/README_Python_DSP.md) | Documentación técnica detallada del pipeline Python |
| [`sms-slides/README_React_Slides.md`](sms-slides/README_React_Slides.md) | Guía de desarrollo del frontend React |
