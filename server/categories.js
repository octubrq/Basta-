const CATEGORY_POOL = {
  'Nombre de persona': { group: 'Clásicas', icon: '👤' },
  'Apellido': { group: 'Clásicas', icon: '📛' },
  'Ciudad': { group: 'Clásicas', icon: '🏙️' },
  'País': { group: 'Clásicas', icon: '🌍' },
  'Animal': { group: 'Clásicas', icon: '🐾' },
  'Fruta': { group: 'Clásicas', icon: '🍎' },
  'Verdura': { group: 'Clásicas', icon: '🥦' },
  'Flor': { group: 'Clásicas', icon: '🌸' },
  'Color': { group: 'Clásicas', icon: '🎨' },
  'Cosa/Objeto': { group: 'Clásicas', icon: '📦' },
  'Película': { group: 'Cultura', icon: '🎬' },
  'Serie de TV': { group: 'Cultura', icon: '📺' },
  'Canción': { group: 'Cultura', icon: '🎵' },
  'Grupo/Cantante': { group: 'Cultura', icon: '🎤' },
  'Libro': { group: 'Cultura', icon: '📚' },
  'Personaje de ficción': { group: 'Cultura', icon: '🦸' },
  'Videojuego': { group: 'Cultura', icon: '🎮' },
  'Instrumento musical': { group: 'Cultura', icon: '🎹' },
  'Río': { group: 'Geografía', icon: '🏞️' },
  'Montaña': { group: 'Geografía', icon: '⛰️' },
  'Mar/Océano': { group: 'Geografía', icon: '🌊' },
  'Mineral/Piedra': { group: 'Geografía', icon: '💎' },
  'Plato de comida': { group: 'Comida', icon: '🍽️' },
  'Bebida': { group: 'Comida', icon: '🥤' },
  'Ingrediente de cocina': { group: 'Comida', icon: '🧂' },
  'Postre': { group: 'Comida', icon: '🍰' },
  'Deporte': { group: 'Deportes', icon: '⚽' },
  'Deportista famoso': { group: 'Deportes', icon: '🏅' },
  'Equipo deportivo': { group: 'Deportes', icon: '🏟️' },
  'Profesión/Oficio': { group: 'Otros', icon: '👷' },
  'Marca': { group: 'Otros', icon: '™️' },
  'Verbo': { group: 'Otros', icon: '💬' },
  'Adjetivo': { group: 'Otros', icon: '✨' },
  'Parte del cuerpo': { group: 'Otros', icon: '🫀' },
  'Prenda de ropa': { group: 'Otros', icon: '👕' },
};

const AVAILABLE_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','R','S','T','U','V'];

function getRandomCategories(pool, count) {
  const keys = Object.keys(pool).sort(() => Math.random() - 0.5);
  return keys.slice(0, Math.min(count, keys.length));
}

function getRandomLetter(used) {
  const remaining = AVAILABLE_LETTERS.filter(l => !used.includes(l));
  return remaining.length ? remaining[Math.floor(Math.random() * remaining.length)] : null;
}

function getComboLetter(main) {
  const all = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => l !== main);
  return all[Math.floor(Math.random() * all.length)];
}

module.exports = { CATEGORY_POOL, AVAILABLE_LETTERS, getRandomCategories, getRandomLetter, getComboLetter };
