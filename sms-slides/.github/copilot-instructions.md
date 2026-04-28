# Copilot Instructions — SMS Slides

## Contexto del Proyecto

Esta es una presentación interactiva para una clase universitaria de **Análisis de Señales Musicales** en la Pontificia Universidad Católica de Chile. El tema central es **Spectral Modeling Synthesis (SMS)** y el pipeline completo: STFT → Peak Detection → Parabolic Interpolation → Peak Tracking (MQ) → SMS Separation.

## Estilo Visual

### Principios de diseño
- **Estética editorial/académica**: Inspirada en publicaciones tipo Distill.pub. Nada de slides corporativas genéricas.
- **Fondo cream** (`#faf8f3`), texto oscuro (`#1a1a2e`). Nunca fondos negros puros salvo canvas 3D con justificación.
- **Tipografía**: Newsreader (serif) para títulos/cuerpo, Inter (sans) para labels/UI, JetBrains Mono para datos numéricos.
- **Espaciado generoso**: La presentación se proyecta en sala de clases. Textos grandes, gráficos grandes.
- **Animaciones sutiles**: `anim-fade-up` para entrada, transiciones CSS suaves. Nada exagerado.

### Colores de acento (usar consistentemente)
- **Azul** (`#2563eb`): Componente determinista, tracks principales, bins importantes
- **Rojo** (`#c0392b`): Componente estocástico, picos parabólicos, muerte de tracks
- **Verde** (`#16a34a`): Resultados positivos, nacimiento de tracks, γ en interpolación
- **Ámbar** (`#d97706`): Advertencias, tracks débiles, α en interpolación
- **Violeta** (`#7c3aed`): Pasos algorítmicos, highlights especiales

### Patrones de componentes
- Cada slide es un componente React independiente (`SlideXxx.jsx`)
- Header siempre tiene: `<span>` con número de slide + sección, `<h2>` con título serif
- Layout típico: `flex-col lg:flex-row` con gráfico (60%) + texto explicativo (40%)
- Gráficos SVG: usar `viewBox` fijo, funciones de mapeo (`binToX`, `ampToY`, etc.)
- Gráficos 3D: usar `@react-three/fiber` + `@react-three/drei`, fondo claro (`#f7f5f0`), ejes explícitos con labels Html
- Matemáticas: usar componente `<M t="..." />` o `<M t="..." d />` para display mode (wrapper de KaTeX en `Math.jsx`)

### Patrón de pasos interactivos
- State `step` controlado por botón manual (NO setTimeout automático para slides de clase)
- Botón azul con label descriptivo del próximo paso
- Elementos aparecen con `opacity` + `translate-y` vía CSS transitions
- En gráficos: vincular `opacity` de elementos SVG/3D al `step` actual

## Teoría DSP Relevante

### Pipeline SMS completo
1. **STFT**: Señal → frames con ventana → FFT por frame
2. **Peak Detection**: Encontrar máximos locales en |X(k)|
3. **Parabolic Interpolation**: Refinar frecuencia sub-bin usando 3 puntos (α, β, γ)
   - δ = ½(α - γ) / (α - 2β + γ)
   - f_peak = (k_max + δ) × Δf
4. **Peak Tracking (McAulay-Quatieri)**:
   - Ordenar tracks activos por magnitud (¡mayor primero! → Regla de Oro)
   - Para cada track (en orden): buscar pico más cercano en frame n+1 dentro de ±Δf_max
   - Match: si encuentra candidato → extender track
   - Death: si no hay candidato → track termina
   - Birth: picos sin match previo → track nuevo
   - **Clave**: ordenar por magnitud evita que picos débiles/ruido roben trayectorias importantes
5. **SMS Separation**:
   - Determinista: tracks estables → síntesis aditiva (sinusoides con freq/amp/fase interpoladas)
   - Estocástico: residuo (señal - determinista) → modelado como ruido filtrado

### Constantes pedagógicas usadas
- N = 2048, Fs = 44100 Hz → Δf = 21.53 Hz/bin
- Ejemplo sub-bin: α=-15dB, β=-3dB, γ=-6dB → δ=0.3 (aprox)
- BETA_K = 20 (bin central del ejemplo)

### Convenciones de los gráficos 3D (Three.js)
- **X = Tiempo** (frames, izquierda a derecha)
- **Y = Magnitud** (dB, de abajo hacia arriba)
- **Z = Frecuencia** (Hz, profundidad)
- Siempre incluir ejes visibles con etiquetas Html
- Cámara: posición elevada lateral `[6, 5, 8]`, FOV ~40
- Iluminación: ambient 0.8-0.9 + directional suave. SIN fondos negros.

## Reglas Importantes

1. **No verificar en navegador** después de cada cambio. El usuario revisará y corregirá.
2. **Slides se proyectan en un proyector de sala de clases**: todo debe ser legible a distancia.
3. **Matemáticas en KaTeX** (nunca MathJax ni imágenes). Usar `\textcolor{#hex}{...}` para colorear variables.
4. **Cada slide debe funcionar sin scroll** (zero-scroll design para proyección).
5. **Consistencia cromática** entre fórmulas y gráficos: si α es ámbar en la fórmula, su stem/punto en el gráfico también debe ser ámbar.
6. **Los pasos interactivos son para dar ritmo a la clase**: el profesor presiona el botón cuando termina de explicar cada concepto.
