# Instrucciones de Uso: Presentación Interactiva SMS

Este proyecto contiene una presentación interactiva sobre Spectral Modeling Synthesis (SMS). Está dividido en dos partes: un backend (Python) para procesar el audio y un frontend (React/Vite) para las diapositivas interactivas.

## 1. Requisitos Previos

Antes de comenzar, asegúrate de tener instalados:
- **Python 3.10** o superior (asegúrate de marcar "Add Python to PATH" durante la instalación).
- **Node.js** (versión 18 o superior).

---

## 2. Instalación por Primera Vez

Si acabas de descargar esta carpeta, necesitas instalar las dependencias tanto para el backend como para el frontend.

### Instalar dependencias del Backend (Python)
Abre una terminal en la raíz de esta carpeta y ejecuta:
```bash
cd backend_live_synthesis
pip install -r requirements.txt
```

### Instalar dependencias del Frontend (Node.js)
Abre otra terminal (o vuelve a la raíz) y ejecuta:
```bash
cd sms-slides
npm install
```

---

## 3. Cómo Ejecutar el Proyecto

Para que la presentación y las demostraciones interactivas funcionen correctamente, **debes tener ambos servidores corriendo al mismo tiempo**.

### Paso 1: Levantar el Servidor Backend
Abre una terminal, entra a la carpeta del backend y ejecuta:
```bash
cd backend_live_synthesis
python -m uvicorn main:app --reload --port 8765
```
*(No cierres esta terminal)*

### Paso 2: Levantar el Servidor Frontend
Abre una nueva terminal, entra a la carpeta del frontend y ejecuta:
```bash
cd sms-slides
npm run dev
```
*(No cierres esta terminal)*

---

## 4. Ver la Presentación

Una vez que ambos servidores estén corriendo, abre tu navegador web (Chrome, Firefox, Safari, Edge) y ve a la siguiente dirección:

👉 **http://localhost:4020**

- Usa las flechas del teclado (`←` y `→`) para cambiar de diapositiva.
- En las diapositivas interactivas (como la de grabación de voz), asegúrate de dar permisos de micrófono en el navegador.

---

## Solución de Problemas Comunes

- **Error al grabar audio en la presentación:** Asegúrate de que el backend de Python esté corriendo en el puerto `8765`.
- **Errores de "pip" o "npm" no reconocido:** Verifica que instalaste Python y Node.js correctamente y que están agregados a las variables de entorno (PATH) de tu sistema.
- **Conflictos de puertos:** Si el puerto 4020 o 8765 están en uso, asegúrate de no tener otras instancias del proyecto corriendo en segundo plano.
