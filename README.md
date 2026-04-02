# 🎮 ¡Basta! v2 — Juego Multijugador

## Instalación

```bash
cd basta/server && npm install
cd ../client && npm install
```

## Arrancar

Terminal 1 (servidor):
```bash
cd basta/server && ANTHROPIC_API_KEY=tu_clave npm run dev
```

Terminal 2 (cliente):
```bash
cd basta/client && REACT_APP_API_URL=http://TU_IP:3001/api REACT_APP_SERVER_URL=http://TU_IP:3001 HOST=0.0.0.0 npm start
```

## Cómo funciona

1. El **admin** entra con usuario+contraseña y **abre la puerta**
2. Los jugadores entran solo con su **nombre**
3. El admin elige juego: **¡Basta!** o **🔤 Letras Locas**
4. Si alguien se desconecta, al volver se reconecta automáticamente
5. Si el admin sale, todos salen

## Juegos

### 🎯 ¡Basta!
Categorías aleatorias, letra aleatoria, el primero que completa grita ¡Basta!

### 🔤 Letras Locas
Palabras con letras desordenadas. El primero que adivina gana 10 pts. Tiempo configurable.
