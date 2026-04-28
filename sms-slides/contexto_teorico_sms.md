# Base de Conocimiento Teórico: Modelado Sinusoidal (SMS) y Peak Tracking (MQ)

**Contexto Teórico para Agente IA (Desarrollo de Slides en React/Three.js)**

Este documento contiene la fundamentación matemática y conceptual estricta para el proyecto de visualización sobre Análisis de Señales Musicales, basada exclusivamente en la literatura técnica de McAulay-Quatieri y Xavier Serra (Spectral Modeling Synthesis).

Su propósito es servir como contexto o *RAG (Retrieval-Augmented Generation)* para evitar alucinaciones y mantener la coherencia matemática en los componentes de la interfaz (`SlidePicketFence.jsx`, `SlideParabola.jsx`, `SlideMath.jsx`, `SlideTracking.jsx`, `SlideSMS.jsx`).

---

## 1. El Problema de la STFT y la Fuga Espectral (Slide 02: Picket-Fence)

* **Limitación de la STFT:** La Transformada Rápida de Fourier de Tiempo Corto (STFT) evalúa el espectro en una "rejilla rígida" de bins de frecuencia discretos.
* **Error de Cuantización (Picket-Fence Effect):** Las frecuencias reales de un sonido orgánico casi nunca coinciden exactamente con la frecuencia central de un bin de la FFT.
  * *Ejemplo:* Con una frecuencia de muestreo $f_s = 44100$ Hz y tamaño de ventana $N = 2048$, la resolución es $\Delta f = f_s/N \approx 21.53$ Hz. El bin 20 está centrado en 430.66 Hz y el bin 21 en 452.15 Hz. Si la señal real es 440 Hz, caerá entre estos dos bins.
* **Consecuencia:** La energía se "derrama" en los bins adyacentes (fuga espectral). Esto produce un error de lectura de la frecuencia real de hasta $\pm \frac{f_s}{2N}$ y una atenuación de la amplitud medida conocida como *scalloping loss*.

## 2. Detección de Picos e Interpolación Parabólica (Slides 03 y 04)

Para encontrar las frecuencias y amplitudes exactas de los componentes sinusoidales (evadiendo la limitación de la rejilla de la FFT), se asume que la punta del lóbulo principal del espectro de la ventana (típicamente Hann o Hamming) se aproxima a una parábola cuando se grafica en escala logarítmica (dB).

* **Condición de Detección:** Un pico local existe en el bin $k$ si supera un umbral de ruido $\tau$ y es estrictamente mayor que sus vecinos inmediatos:

  $$
  |X[k]| > \tau \quad \wedge \quad |X[k]| > |X[k-1]| \quad \wedge \quad |X[k]| > |X[k+1]|
  $$
* **Matemática Sub-bin (Para `SlideMath.jsx`):**
  Sean las magnitudes (en dB) de los 3 bins adyacentes al pico detectado:
  $\alpha = 20 \log_{10}(|X[k-1]|)$
  $\beta = 20 \log_{10}(|X[k]|)$
  $\gamma = 20 \log_{10}(|X[k+1]|)$

  1. **Desplazamiento fraccional ($\delta$):** Calcula la posición del vértice de la parábola relativo al bin central $k$.
     $$
     \delta = \frac{1}{2} \frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}
     $$

     *(Propiedad: $\delta \in [-0.5, 0.5]$)*
  2. **Frecuencia real ($f_{real}$):** Posición corregida en Hz.
     $$
     f_{real} = (k + \delta) \cdot \frac{f_s}{N}
     $$
  3. **Amplitud real corregida ($A_{real}$):** Amplitud en dB en el vértice de la parábola, corrigiendo el *scalloping loss*.
     $$
     A_{real} = \beta - \frac{1}{4}(\alpha - \gamma)\delta
     $$

## 3. Seguimiento de Picos: Algoritmo McAulay-Quatieri (Slide 05: Tracking)

El algoritmo de McAulay y Quatieri (MQ, 1986) conecta los picos detectados en espectros sucesivos (frames) para formar trayectorias continuas ("tracks") a lo largo del tiempo, representando los parciales (armónicos o inarmónicos) del sonido.

* **Heurística de Emparejamiento (Match):**

  * Se define una tolerancia de desviación de frecuencia máxima permitida de un frame a otro: $\Delta f_{max}$.
  * Para cada track activo del frame anterior $m-1$, se busca en el frame actual $m$ el pico cuya frecuencia minimice la distancia absoluta $|f_{m-1} - f_m|$, siempre que esta distancia sea menor que $\Delta f_{max}$.
  * **Resolución de conflictos:** Si múltiples tracks reclaman el mismo pico, el algoritmo de Serra prioriza la continuidad de la trayectoria, o en implementaciones más simples, el pico con mayor amplitud o el de menor distancia (nearest-neighbor).
* **Máquina de Estados de los Tracks:**

  1. **Nacimiento (Birth):** Picos en el frame actual $m$ que no fueron emparejados con ningún track del frame $m-1$ inician nuevas trayectorias. Para evitar "clicks" de audio en la resíntesis, se asume que nacieron con amplitud cero en el frame anterior.
  2. **Continuación (Match):** Un track existente en $m-1$ se empareja exitosamente con un pico en $m$. Se actualizan sus valores de frecuencia, amplitud y fase.
  3. **Muerte (Death):** Un track activo en $m-1$ no encuentra ningún pico candidato en $m$ dentro del rango $\Delta f_{max}$. El track se "apaga". Para evitar cortes abruptos, se asume que su amplitud decae a cero en el frame $m$.
* **Interpolación en Resíntesis:** Para generar el audio a partir de los tracks, se usan osciladores. Para evitar discontinuidades, las amplitudes se interpolan linealmente. Para las fases, la interpolación lineal causaría saltos en la frecuencia instantánea. MQ propuso una **interpolación polinomial cúbica** para la fase que garantiza una evolución suave y continua de frecuencia.

## 4. Síntesis de Modelado Espectral: Algoritmo SMS (Slide 06: SMS)

El Spectral Modeling Synthesis (SMS), desarrollado por Xavier Serra y Julius Smith (1990), es una extensión del modelo MQ. Reconoce que los sonidos musicales no son solo sinusoides puras; contienen un componente importante de ruido (ataques, respiración, ruido de arco, consonantes fricativas).

* **Modelo de Señal:** La señal $x(t)$ se modela como la suma de una parte determinista $d(t)$ y una parte estocástica (residuo) $e(t)$.

  $$
  x(t) = d(t) + e(t)
  $$
* **Componente Determinista ($d(t)$):**

  * Consiste en parciales cuasi-sinusoidales estables a lo largo del tiempo.
  * Se extrae y sintetiza usando el método de tracking de picos de McAulay-Quatieri descrito anteriormente.
  * $d(t) = \sum_{r=1}^{R} A_r(t) \cos(\theta_r(t))$
* **Componente Estocástico / Residuo ($e(t)$):**

  * Representa todo el sonido que no pudo ser capturado por las trayectorias sinusoidales estables (ruido de banda ancha).
  * **Extracción:** Se obtiene restando la señal determinista sintetizada de la señal original en el **dominio del tiempo**: $e(t) = x(t) - d(t)$. (Requiere preservación exacta de la fase para que la resta sea válida).
  * **Modelado y Síntesis:** No se guarda el audio de $e(t)$. En su lugar, en cada frame, se calcula el espectro de amplitud de $e(t)$ y se aproxima mediante una **envolvente espectral** (usualmente suavizando el espectro). En la fase de síntesis, el residuo se genera pasando ruido blanco a través de un filtro variante en el tiempo cuya respuesta en frecuencia está dada por dicha envolvente.
* **Ventaja del modelo:** Permite transformaciones musicales avanzadas (Time-stretching, Pitch-shifting) de manera independiente: escalar la frecuencia del determinista sin alterar el formante del ruido, o mezclar el componente determinista de un instrumento con el residuo de otro (Cross-synthesis / Morphing).

## 5. Mapeo Algorítmico al Código (Ejemplo Simplificado)

Estructura mental para la IA de cómo se implementan estos conceptos en código (ej. Python):

* **`detect_peaks()`**: Calcula la FFT de una ventana. Busca índices $k$ donde $|X[k]| > |X[k-1]|$ y $|X[k]| > |X[k+1]|$ y $|X[k]| > \tau$.
* **`parabolic_interp()`**: Recibe los índices $k$ y el espectro. Aplica las fórmulas de $\alpha, \beta, \gamma$ para calcular los desplazamientos $\delta$. Retorna las frecuencias y amplitudes reales.
* **`track_peaks()`**: Función iterativa que mantiene una lista de "tracks_activos". Para cada nuevo frame, compara los `f_real` detectados con los `f_real` de los tracks activos. Aplica lógica de distancias menores a $\Delta f_{max}$ para actualizar, matar (amplitud a 0) o crear nuevos tracks.
* **`sms_synthesis()`**:
  1. Calcula $d(t)$ interpolando los osciladores.
  2. Calcula la resta $e(t) = x(t) - d(t)$.
  3. Aproxima el espectro de $e(t)$ como una envolvente (filtro).
  4. Sintetiza la salida pasando ruido aleatorio por el filtro y sumando a $d(t)$.
