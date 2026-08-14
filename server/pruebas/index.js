// Registro de pruebas. Cada módulo expone la misma interfaz que usa el motor:
//   meta: id, name, color, icon, minPlayers, instructionsSeconds, howToPlay, howToScore, soloHowToScore
//   startPlay(ctx)  · onEvent(ctx, event, payload, playerId)  · cleanup(ctx)
// Las 6 pruebas nuevas de la Fase 4 se irán añadiendo aquí.
const basta = require('./basta');
const scramble = require('./scramble');
const masomenos = require('./masomenos');
const pistas = require('./pistas');
const vf = require('./vf');
const cadena = require('./cadena');

const REGISTRY = { basta, scramble, masomenos, pistas, vf, cadena };

// Orden en que se muestran en el lobby.
const ORDER = ['basta', 'scramble', 'masomenos', 'pistas', 'vf', 'cadena'];

function getPrueba(id) { return REGISTRY[id] || null; }

// Metadatos ligeros para el cliente (casillas del lobby + pantalla de instrucciones).
function metaList() {
  return ORDER.filter(id => REGISTRY[id]).map(id => {
    const p = REGISTRY[id];
    return {
      id: p.id, name: p.name, color: p.color, icon: p.icon,
      howToPlay: p.howToPlay, howToScore: p.howToScore,
      soloHowToScore: p.soloHowToScore || p.howToScore,
      instructionsSeconds: p.instructionsSeconds || 8,
    };
  });
}

module.exports = { REGISTRY, ORDER, getPrueba, metaList };
