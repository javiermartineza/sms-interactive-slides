# SMS Live Synthesis — Backend FastAPI

Servidor que ejecuta el pipeline SMS (Spectral Modeling Synthesis) en vivo
sobre un buffer de audio enviado desde la slide `SlideLiveSynthesis`.

## Instalación

```bash
cd backend_live_synthesis
pip install -r requirements.txt
```

## Ejecución

```bash
uvicorn main:app --reload --port 8765
```

Por defecto el frontend espera la API en `http://localhost:8765`.
Si se cambia el puerto, ajustar `BACKEND_URL` en
`sms-slides/src/components/SlideLiveSynthesis.jsx`.

## Endpoint

### `POST /process-sms`

- **Body**: multipart con campo `audio` (WAV mono PCM-16 generado por el frontend).
- **Respuesta**:
  ```json
  {
    "session_id": "abc123...",
    "sample_rate": 44100,
    "duration": 4.2,
    "urls": {
      "original": "/sessions/<id>/original.wav",
      "parcial_01": "/sessions/<id>/parcial_01.wav",
      "parcial_02": "/sessions/<id>/parcial_02.wav",
      "parcial_03": "/sessions/<id>/parcial_03.wav",
      "parcial_04": "/sessions/<id>/parcial_04.wav",
      "parcial_05": "/sessions/<id>/parcial_05.wav",
      "sintesis_total": "/sessions/<id>/sintesis_total.wav",
      "residuo": "/sessions/<id>/residuo.wav"
    }
  }
  ```

Las URLs son relativas al servidor; el frontend las resuelve contra
`BACKEND_URL`. Las sesiones se borran al iniciar y caducan a los 30 minutos.

## Notas de implementación

- Reusa funciones puras de `../generacionsenales/demo_sms_cello.py`
  (`compute_stft`, `detect_peaks`, `mq_tracking`, `synthesize_tracks`,
  `modelar_ruido_estocastico`).
- Espera WAV PCM ya decodificado (el frontend hace la conversión desde
  `MediaRecorder` con Web Audio API antes de enviar).
- Los 5 parciales se eligen por **energía descendente**, igual que el
  resto del proyecto.
