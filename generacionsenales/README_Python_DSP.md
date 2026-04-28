# generacionsenales/ — Pipeline SMS en Python

Módulo de procesamiento de audio para la clase de **Análisis de Señales Musicales** (PUC Chile). Implementa el pipeline completo de **Spectral Modeling Synthesis (SMS)** sobre archivos WAV de instrumentos de cuerda. Sus salidas (WAV + PNG) alimentan la presentación interactiva en [`../sms-slides/`](../sms-slides/).

---

## Scripts disponibles

| Script | Propósito | Tiempo de ejecución |
|--------|-----------|-------------------|
| `demo_sms_cello.py` | Pipeline SMS completo: análisis + síntesis + visualización | ~5 min (sobre el violín) |
| `generar_stft.py` | Solo espectrograma STFT → PNG | ~5 segundos |
| `desafio_relampago_07_resuelto.py` | Implementaciones aisladas de `detect_peaks`, `parabolic_interp`, `track_peaks` (desafío de clase) | — |

---

## Dependencias

```bash
pip install numpy scipy matplotlib soundfile
```

---

## Estructura de carpetas

```
generacionsenales/
├── demo_sms_cello.py
├── generar_stft.py
├── desafio_relampago_07_resuelto.py
├── inputs/               ← coloca aquí tus archivos WAV
│   └── 641703__theflyfishingfilmmaker__violin-single-note-swell.wav
└── outputs/              ← se crea automáticamente al ejecutar
    ├── *_stft.png                  ← espectrograma STFT
    ├── *_plot_tracks.png           ← gráfico espagueti de trayectorias MQ
    ├── *_01_parcial.wav … *_30_parciales.wav
    ├── *_30_ROTO.wav
    ├── *_30_residuo_crudo.wav
    ├── *_30_ruido_puro.wav
    └── *_30_SMS_completo.wav
```

---

## Ejecución

```bash
# Siempre ejecutar desde dentro de generacionsenales/ (los scripts usan rutas relativas)
cd generacionsenales

# Pipeline completo (procesa todos los .wav en inputs/)
python demo_sms_cello.py

# Solo el espectrograma STFT (rápido, para no re-ejecutar todo el pipeline)
python generar_stft.py
```

---

## Conexión con sms-slides/

Los archivos generados en `outputs/` se copian manualmente a `../sms-slides/public/` con nombres cortos para que Vite los sirva estáticamente:

```
outputs/*_stft.png              → sms-slides/public/imagenes/violin_stft.png
outputs/*_plot_tracks.png       → sms-slides/public/imagenes/violin_plot_tracks.png
outputs/*_01_parcial.wav        → sms-slides/public/audio/violin_01_parcial.wav
outputs/*_02_parciales.wav      → sms-slides/public/audio/violin_02_parciales.wav
... (03–29 igual)
outputs/*_30_parciales.wav      → sms-slides/public/audio/violin_30_parciales.wav
outputs/*_30_ROTO.wav           → sms-slides/public/audio/violin_30_roto.wav
outputs/*_30_ruido_puro.wav     → sms-slides/public/audio/violin_ruido_puro.wav
outputs/*_30_SMS_completo.wav   → sms-slides/public/audio/violin_sms_completo.wav
```

Las imágenes pedagógicas `PeakDetection.jpg` y `Parabola.png` viven en `sms-slides/imagenes/` y se copian a `sms-slides/public/imagenes/` directamente (no son generadas por Python).

---

## Parámetros configurables

Al inicio de `demo_sms_cello.py` hay una sección de parámetros globales:

| Parámetro | Valor por defecto | Efecto |
|---|---|---|
| `N_FFT` | `2048` | Tamaño de la ventana. Más grande = mejor resolución frecuencial, peor temporal |
| `HOP` | `512` | Salto entre frames. Menor = más frames/segundo, más lento |
| `N_PEAKS_MAX` | `60` | Máximo de picos espectrales a detectar por frame |
| `FREQ_TOL_HZ` | `50.0` | Tolerancia de matching MQ en Hz |
| `MIN_TRACK_LEN` | `5` | Mínimo de frames para que un track sea considerado real |
| `PEAK_THRESH` | `-75.0` | Umbral en dBFS. Picos más débiles se ignoran |

`generar_stft.py` usa `N_FFT=2048` y `HOP=512` (los mismos) pero no tiene parámetros de tracking.

---

## El pipeline paso a paso

### Paso 1 · Carga de audio (`load_audio`)

Lee el archivo WAV con `soundfile`. Si es estéreo, promedia los canales para obtener mono, preservando la energía espectral media. Normaliza la señal a pico unitario para que todos los archivos entren al análisis en condiciones comparables.

---

### Paso 2 · STFT — Short-Time Fourier Transform (`compute_stft`)

Divide la señal en frames solapados y calcula la FFT de cada uno usando `scipy.fft.rfft`.

**Ventana Hann:** Antes de aplicar la FFT, cada frame se multiplica por una ventana Hann. Sin ventana, los bordes abruptos del frame generan *spectral leakage*: la energía de un parcial tonal se derrama sobre todos los bins adyacentes, enmascarando parciales débiles cercanos. La Hann suprime los lóbulos laterales ~31 dB respecto a la ventana rectangular.

**Normalización de ventana:** Se divide el espectro por `sum(ventana)/2`. Sin esta corrección, la magnitud de un tono puro de amplitud A aparecería escalada y no comparable entre distintas ventanas.

**Escala dB:** Las magnitudes se convierten a dBFS (decibeles relativos al fondo de escala). El oído humano sigue la ley de Weber-Fechner (percepción logarítmica), por lo que un umbral de -75 dBFS tiene el mismo significado perceptual en graves y agudos, a diferencia de un umbral lineal.

Con `N_FFT=2048` y `HOP=512` a 44100 Hz se obtienen ~86 frames por segundo, suficiente para capturar variaciones de vibrato de un cello (~5-7 Hz).

---

### Paso 3 · Detección de picos + Interpolación parabólica (`detect_peaks` + `_parabolic_interp`)

Para cada frame del espectrograma se buscan los **máximos locales**: bins donde la magnitud supera a sus dos vecinos inmediatos y al umbral `PEAK_THRESH`. Un máximo local es la evidencia de una componente sinusoidal presente en ese frame.

**¿Por qué no simplemente tomar los N bins más grandes?** Porque el mismo lóbulo principal de un parcial ocupa varios bins; tomar los más grandes sin buscar el máximo local haría que el mismo parcial se detectase múltiples veces.

**Interpolación parabólica:** La DFT muestrea el espectro continuo en bins discretos separados `Δf = fs/N` Hz. La frecuencia real de un parcial rara vez cae exactamente en un bin; sin corrección el error puede ser hasta `Δf/2` (~10 Hz con N=2048 a 44100 Hz). La interpolación parabólica ajusta una parábola sobre el bin pico y sus dos vecinos y extrae el vértice como estimación de la frecuencia real, reduciendo el error a ~`Δf/50` (≈ 0.4 Hz). Esto es crítico para que la síntesis no desafine.

La fórmula del desplazamiento sub-bin es:

```
offset = 0.5 × (α - γ) / (α - 2β + γ)
```

donde α, β, γ son las magnitudes de los bins k-1, k, k+1.

Solo se aceptan picos entre **60 y 8000 Hz**, que cubre el rango útil de instrumentos de cuerda (fundamento ~65-1047 Hz más armónicos). Los picos fuera de ese rango son casi siempre ruido de cuantización.

---

### Paso 4a · Tracking McAulay-Quatieri (`mq_tracking`)

Este es el corazón del algoritmo. El objetivo es **conectar los picos detectados en frames consecutivos** para formar trayectorias continuas (*tracks*), donde cada track representa la evolución temporal de un único parcial físico del instrumento.

El algoritmo opera en tres fases por cada frame:

#### MATCH
Se comparan los picos del frame actual contra los tracks activos del frame anterior. Para cada pico, se busca el track activo cuya última frecuencia esté más cerca (dentro de la ventana `FREQ_TOL_HZ`). Los picos se procesan en orden de **magnitud descendente**: los parciales más fuertes (más importantes perceptualmente) tienen prioridad en la asignación. Si un track ya fue asignado, no puede volver a ser asignado en el mismo frame.

#### DEATH
Un track muere cuando ningún pico del frame actual cae dentro de su ventana de tolerancia. Modela el cese físico de un parcial: fin de nota, cambio de arcada que extingue un armónico, o que la componente cayó bajo el umbral de detección. Los tracks zombies generarían parciales fantasmas en la síntesis.

#### BIRTH
Los picos que no encontraron match crean un nuevo track. Modela el ataque de una nota nueva o la aparición de un armónico que superó el umbral.

Al terminar de procesar todos los frames, los tracks activos restantes se cierran. Los tracks con menos de `MIN_TRACK_LEN` frames se descartan como ruido de detección (transitorios de ataque, artefactos).

---

### Paso 4b · Tracking "roto" sin memoria (`broken_tracking`)

Este módulo es el **contra-ejemplo pedagógico** del script. En lugar de conectar picos por proximidad frecuencial, asigna en cada frame el pico más fuerte al "track 1", el segundo más fuerte al "track 2", y así sucesivamente, sin importar qué parcial físico era cada uno en el frame anterior.

El resultado: el "track 1" puede corresponder al 1.er armónico en un frame y al 5.º en el siguiente si este se vuelve más fuerte. Al sintetizar, el oscilador de ese track acumula fase como si estuviera siguiendo un único parcial, pero en realidad salta entre frecuencias muy distintas frame a frame. El oído percibe esto como clicks metálicos, *zipper noise* y pérdida total del timbre del instrumento.

**Propósito docente:** escuchar `_30_ROTO.wav` junto a `_30_parciales.wav` demuestra de forma auditiva e inmediata por qué la continuidad temporal es indispensable en el algoritmo MQ.

---

### Paso 5 · Síntesis aditiva con fase continua (`synthesize_tracks`)

Reconstituye la señal de audio sumando osciladores sinusoidales, uno por track. Es la inversa del análisis: si el tracking fue correcto, la suma debería sonar como el instrumento original.

**Selección de tracks:** Se usan los `n_select` tracks de mayor energía total (integral de la amplitud lineal a lo largo de toda su duración). Esto garantiza que con pocos osciladores ya se captura la identidad tonal: fundamento + primeros armónicos son perceptualmente dominantes.

**Fase continua:** La fase se acumula muestra a muestra integrando la frecuencia instantánea:

```
φ(n) = φ(n-1) + 2π · f(n) / sr
```

La fase del último sample de cada hop se pasa al siguiente, manteniéndola continua a través de toda la vida del track. Si se reiniciara la fase en cada hop (*Phase Reset*), cada frontera de frame produciría una discontinuidad de fase. Con 30 osciladores saltando 86 veces por segundo se obtendría una cortina de clicks — exactamente lo que produce el tracker roto.

**Interpolación lineal:** La frecuencia y la amplitud se interpolan linealmente entre frames consecutivos. Sin interpolación habría escalones abruptos cada 512 muestras (~11 ms) que el oído percibiría como modulación de amplitud a 86 Hz.

El script genera síntesis para **cada número de parciales de 1 a 30** de forma individual, permitiendo escuchar progresivamente cómo se construye el timbre del instrumento.

---

### Paso 6 · Modelado estocástico (`modelar_ruido_estocastico`)

Una vez obtenidos los 30 parciales deterministas, se calcula el **residuo crudo** como la resta directa entre la señal original y la síntesis aditiva:

```
residuo_crudo = señal_original − síntesis_30_parciales
```

Este residuo contiene la textura de ruido del arco, el ruido de sala y cualquier inharmonicidad no capturada por el modelo sinusoidal. Sin embargo, también incluye **sinusoides fantasmas**: los parciales no se cancelan perfectamente porque la síntesis parte con fase φ₀ = 0, mientras que la grabación original tiene fase arbitraria en cada parcial.

Para eliminar esos artefactos tonales y quedarse únicamente con la energía de ruido, se aplica el modelo estocástico SMS en tres pasos:

1. **STFT del residuo:** se obtiene la magnitud espectral `|R(k, m)|` frame a frame.
2. **Filtro mediana (50 bins × 1 frame):** suaviza la magnitud a lo largo del eje de frecuencia, borrando los picos tonales fantasmas y dejando solo la envolvente espectral suave del ruido.
3. **Fase aleatoria:** se asigna fase uniforme en [0, 2π) a cada bin. El ruido de arco no tiene coherencia de fase entre frames (a diferencia de un parcial), por lo que la fase aleatoria regenera su textura de forma estadísticamente correcta.
4. **ISTFT:** reconstruye la señal temporal con Overlap-Add.

El resultado, `ruido_puro`, se suma a `síntesis_30_parciales` para producir `SMS_completo`.

---

### Paso 7 · Visualización (`plot_stft_figure` + `plot_tracks_figure`)

`plot_stft_figure` genera el **espectrograma STFT**: eje X = tiempo, eje Y = frecuencia (0–8 kHz), color = magnitud en dBFS (colormap `magma`, rango -90 a 0). Este mismo PNG se genera de forma independiente por `generar_stft.py`.

`plot_tracks_figure` genera el **gráfico espagueti**: cada punto es un frame de un track. X = tiempo, Y = frecuencia, color proporcional a la magnitud relativa del track. Sirve como diagnóstico: los parciales fuertes de bajo orden aparecen como líneas densas y continuas; saltos verticales o gaps exponen transiciones entre notas o fallos de tracking.

---

## Archivos generados

Por cada archivo `.wav` en `inputs/`, el script genera en `outputs/`:

| Archivo | Descripción | Qué se escucha |
|---|---|---|
| `{nombre}_stft.png` | Espectrograma STFT (tiempo × frecuencia) | — |
| `{nombre}_plot_tracks.png` | Gráfico espagueti de trayectorias | — |
| `{nombre}_01_parcial.wav` | Solo el parcial más energético | Casi irreconocible: una sinusoide pura |
| `{nombre}_02_parciales.wav` | Los 2 más energéticos | Empieza a insinuarse la nota |
| `{nombre}_03_parciales.wav` | Los 3 más energéticos | Apenas reconocible como instrumento de cuerda |
| `...` | (de 1 a 30, uno por uno) | La identidad tonal se construye progresivamente |
| `{nombre}_30_parciales.wav` | Los 30 más energéticos | Afinación correcta, timbre sintético y limpio |
| `{nombre}_30_ROTO.wav` | Tracking sin memoria, 30 picos/frame | Clicks, zipper noise, pérdida total del timbre |
| `{nombre}_30_residuo_crudo.wav` | `original − síntesis_30` | Ruido de arco + parciales fantasmas (desajuste de fase) |
| `{nombre}_30_ruido_puro.wav` | Residuo estocastizado (envolvente + fase aleatoria) | Solo textura de arco, sin tonos parásitos |
| `{nombre}_30_SMS_completo.wav` | 30 parciales + ruido modelado | SMS completo: determinista + estocástico |

---

## Módulos del código (`demo_sms_cello.py`)

```
demo_sms_cello.py
│
├── load_audio()                # Módulo 1  · Carga y normalización
├── compute_stft()              # Módulo 2  · STFT con ventana Hann
├── _parabolic_interp()         # Módulo 3  · Interpolación sub-bin (privada)
├── detect_peaks()              # Módulo 3  · Detección de máximos locales
├── Track (clase)               # Módulo 4a · Objeto de trayectoria sinusoidal
├── mq_tracking()               # Módulo 4b · Algoritmo MQ (Match/Birth/Death)
├── broken_tracking()           # Módulo 4c · Tracker sin memoria (contra-ejemplo)
├── _select_tracks()            # Módulo 5  · Selección por energía (privada)
├── synthesize_tracks()         # Módulo 5  · Síntesis aditiva con fase continua
├── modelar_ruido_estocastico() # Módulo 6  · Modelado estocástico del residuo
├── plot_stft_figure()          # Módulo 7a · Espectrograma STFT
├── plot_tracks_figure()        # Módulo 7b · Gráfico espagueti
├── save_wav()                  # Módulo 8  · Escritura WAV PCM-16
├── process_file()              # Módulo 9  · Pipeline completo para un archivo
└── main()                      # Módulo 9  · Ejecución principal del script
```

`generar_stft.py` es una versión standalone que solo implementa `load_audio`, `compute_stft` y `plot_stft`, sin dependencias del tracker ni del sintetizador.

---

## Conceptos clave del DSP involucrados

- **STFT** (Short-Time Fourier Transform): análisis tiempo-frecuencia frame a frame
- **Ventana Hann**: reducción de spectral leakage
- **Interpolación parabólica**: estimación de frecuencia sub-bin
- **Síntesis aditiva**: reconstrucción por suma de sinusoides
- **Modelo SMS**: descomposición determinista + estocástica
- **Algoritmo McAulay-Quatieri**: tracking de parciales por proximidad frecuencial con estados Match/Birth/Death
- **Fase continua**: integración de frecuencia instantánea para síntesis coherente

---

## Notas de entorno (Windows)

- Ejecutar siempre desde dentro de `generacionsenales/` — los scripts usan rutas relativas `inputs/` y `outputs/`.
- Si hay error `UnicodeEncodeError` al imprimir caracteres especiales, usar PowerShell con `$env:PYTHONIOENCODING = "utf-8"` antes de ejecutar. `generar_stft.py` está escrito sin caracteres no-ASCII para evitar este problema.

---

## Ejemplo de salida en consola

```
================================================================
  SMS Demo — McAulay-Quatieri
  1 archivo(s) encontrado(s) en 'inputs/'
  Resultados -> 'outputs/'
================================================================

>>> [1/1] Procesando: 641703__theflyfishingfilmmaker__violin-single-note-swell.wav

[1/8] Cargando audio...
      sr=44100 Hz  |  duracion=6.12s  |  270007 muestras

[2/8] Calculando STFT  (N_FFT=2048, hop=512)...
      527 frames  |  resolucion espectral = 21.53 Hz/bin

[3/8] Detectando picos + interpolacion parabolica...
      Total picos: 9847  (promedio 18.7 / frame)

[4a/8] Tracking McAulay-Quatieri...
      Tracks totales:          934
      Tracks >= 5 frames:      381

[4b/8] Tracking 'sin memoria' (broken)...
      30 pseudo-tracks creados (sin continuidad temporal)

[5/8] Sintesis aditiva (1-30 parciales)...
       30 parciales... listo

[6/8] Modelando componente estocastico...
      listo

[7/8] Generando graficos...
  [OK] outputs/641703__..._stft.png
  [OK] outputs/641703__..._plot_tracks.png

[8/8] Guardando archivos WAV...
  [OK] outputs/641703__..._30_SMS_completo.wav     (6.12s)
```
