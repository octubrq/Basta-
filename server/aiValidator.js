const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
function getApiKey() { return process.env.ANTHROPIC_API_KEY || ''; }

async function validateRound(allAnswers, categories, letter) {
  const results = {};
  const toValidate = [];
  const seen = new Set();

  for (const [, catAnswers] of Object.entries(allAnswers)) {
    for (const cat of categories) {
      const answer = (catAnswers[cat] || '').trim();
      if (!answer || answer.length < 2) continue;
      const key = `${cat}|||${answer.toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); toValidate.push({ category: cat, answer, key }); }
    }
  }

  const API_KEY = getApiKey();
  if (!API_KEY || toValidate.length === 0) {
    for (const item of toValidate) results[item.key] = { valid: true, reason: 'sin IA' };
    return results;
  }

  let promptItems = '';
  let idx = 1;
  for (const item of toValidate) { promptItems += `${idx++}. Categoría: "${item.category}" → "${item.answer}"\n`; }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 2000,
        messages: [{ role: 'user', content: `Eres un validador ESTRICTO del juego "¡Basta!" (Scattergories) en español. Para cada par «Categoría → Respuesta» decide si la respuesta es un EJEMPLAR VÁLIDO de esa categoría.
(La letra inicial la comprueba el programa aparte; tú solo juzgas si el concepto es correcto.)

REGLA CLAVE — ejemplar concreto:
La respuesta debe ser un MIEMBRO o EJEMPLAR concreto e identificable de la categoría.
NUNCA es válida la palabra genérica de la propia categoría, ni un sinónimo, paráfrasis
o hiperónimo de ella.
- "Montaña": "montaña", "monte", "cadena montañosa", "cordillera" → INVÁLIDO;
  "Mulhacén", "Everest", "Teide" → válido.
- "Mineral/Piedra": "piedra", "mineral", "roca", "gema" → INVÁLIDO;
  "Pirita", "Cuarzo", "Diamante" → válido.
- "Río": "río", "riachuelo", "afluente" → INVÁLIDO; "Miño", "Nilo", "Ebro" → válido.
- "Mar/Océano": "mar", "océano" → INVÁLIDO; "Mediterráneo", "Atlántico" → válido.
- "Equipo deportivo": "equipo", "club" → INVÁLIDO; "Valencia CF", "Lakers" → válido.
- "Grupo/Cantante": "cantante", "grupo", "banda", "artista" → INVÁLIDO;
  "U2", "Rosalía", "Queen" → válido.
- "Ciudad": "ciudad", "pueblo" → INVÁLIDO; "Madrid", "Roma" → válido.

OTRAS REGLAS:
1. Debe ser un ejemplo REAL y DIRECTO de la categoría, no una relación indirecta
   (Irlanda NO es un río; Mestalla es un estadio, NO un equipo; Illinois NO es un postre).
2. No valen invenciones ni cosas que no existan ("Instaya" no es un equipo real).
3. En categorías de sustantivo común (Animal, Fruta, Verdura, Flor, Color, Cosa/Objeto,
   Profesión/Oficio, Deporte, Instrumento musical, Bebida, Postre, Plato de comida,
   Ingrediente de cocina, Verbo, Adjetivo, Parte del cuerpo, Prenda de ropa) SÍ vale un
   miembro común concreto: "perro" (Animal), "manzana" (Fruta), "azul" (Color), "médico"
   (Profesión), "guitarra" (Instrumento), "fútbol" (Deporte). Pero NO vale la palabra de la
   categoría en sí ("animal", "fruta", "deporte").
4. MUY IMPORTANTE — entidades reales que coinciden con un nombre común: si existe una
   entidad REAL y razonablemente conocida (grupo, cantante, película, serie, libro, marca,
   equipo, personaje...) con ese nombre, es VÁLIDA aunque la palabra sea también un animal,
   objeto o sustantivo común. NO exijas el "nombre completo": basta el nombre por el que se
   conoce. Ante la duda razonable de que exista, ACÉPTALA.
   Ejemplos VÁLIDOS: "Pantera" (grupo de heavy metal) para Grupo/Cantante; "Queen", "Oasis",
   "Gorillaz" para Grupo/Cantante; "Coco", "Up" para Película; "Nirvana" para Grupo/Cantante.
   Sigue siendo INVÁLIDO solo el término genérico de la categoría ("grupo", "cantante", "banda").
5. Ignora mayúsculas y acentos. Sé razonable con faltas de ortografía leves.

Evalúa:
${promptItems}
Responde SOLO con un array JSON, sin texto adicional:
[{"category":"...","answer":"...","valid":true,"reason":"breve motivo solo si es inválido"}]` }],
      }),
    });

    if (!res.ok) { console.error('Claude API error:', res.status); for (const i of toValidate) results[i.key] = { valid: true, reason: 'error API' }; return results; }

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      for (const r of JSON.parse(match[0])) {
        if (r.category && r.answer) results[`${r.category}|||${r.answer.toLowerCase()}`] = { valid: !!r.valid, reason: r.reason || '' };
      }
    }
    for (const i of toValidate) { if (!results[i.key]) results[i.key] = { valid: true, reason: 'no validada' }; }
    console.log(`🤖 Validated ${toValidate.length} answers in 1 call`);
    return results;
  } catch (err) {
    console.error('Claude error:', err.message);
    for (const i of toValidate) results[i.key] = { valid: true, reason: 'error' };
    return results;
  }
}

const DIFFICULTY_PROMPTS = {
  easy: `Genera exactamente {count} palabras en español MUY FÁCILES para niños de 5-8 años.
Reglas: sustantivos simples y cotidianos que un niño conozca (animales, juguetes, comida, familia, colores, cosas de casa).
Entre 4 y 6 letras. Sin acentos, solo MAYÚSCULAS. Ejemplos: GATO, MESA, LUNA, PATO, SOPA, CASA, BOLA, RANA.
Responde SOLO JSON array: ["PALABRA1","PALABRA2",...]`,

  medium: `Genera exactamente {count} palabras en español de dificultad MEDIA para niños de 9-12 años.
Reglas: sustantivos comunes variados (animales, objetos, naturaleza, comida, deportes).
Entre 5 y 8 letras. Sin acentos, solo MAYÚSCULAS. Ejemplos: TIGRE, PLAYA, GLOBO, CAMION, TORTUGA, HELADO.
Responde SOLO JSON array: ["PALABRA1","PALABRA2",...]`,

  hard: `Genera exactamente {count} palabras en español DIFÍCILES para adultos.
Reglas: sustantivos variados, poco comunes o largos (ciencia, geografía, profesiones, naturaleza, cultura).
Entre 7 y 12 letras. Sin acentos, solo MAYÚSCULAS. Ejemplos: MARIPOSA, DINOSAURIO, TELESCOPIO, BIBLIOTECA, MERMELADA, EXTRANJERO.
Responde SOLO JSON array: ["PALABRA1","PALABRA2",...]`,

  extreme: `Genera exactamente {count} palabras en español MUY DIFÍCILES para expertos.
Reglas: sustantivos complejos, técnicos o poco frecuentes (medicina, filosofía, arquitectura, botánica, gastronomía).
Entre 9 y 14 letras. Sin acentos, solo MAYÚSCULAS. Ejemplos: ESTETOSCOPIO, CRISANTEMO, FERROCARRIL, PRESTIDIGITADOR, CALEIDOSCOPIO.
Responde SOLO JSON array: ["PALABRA1","PALABRA2",...]`,
};

const FALLBACK_WORDS = {
  easy: ['GATO','MESA','LUNA','PATO','SOPA','CASA','BOLA','RANA','PERA','VACA','LOBO','TAZA','NUBE','ROSA','MANO','DEDO','LAGO','ROCA','PINO','MIEL'],
  medium: ['TIGRE','PLAYA','GLOBO','CAMION','TORTUGA','HELADO','GUITARRA','MONTAÑA','ESTRELLA','CUCHARA','VENTANA','BUFANDA','ZAPATO','PINTURA','CASCABEL','TAMBOR','PALOMA','CEREZA','PLATANO','NARANJA'],
  hard: ['MARIPOSA','DINOSAURIO','TELESCOPIO','BIBLIOTECA','MERMELADA','CHOCOLATE','COCODRILO','BICICLETA','ESMERALDA','ORQUIDEA','LABERINTO','PIRAMIDE','VOLCÁNICO','ACUARELA','PANDERO','PENINSULA','SUBMARINO','AMANECER','CALABAZA','UNIVERSO'],
  extreme: ['ESTETOSCOPIO','CRISANTEMO','FERROCARRIL','CALEIDOSCOPIO','MULTIPLICACION','CONSTANTINOPLA','EXTRAORDINARIO','DESEMBOCADURA','PERPENDICULAR','TRANSFORMACION','ENCICLOPEDIA','PROCRASTINAR','DESAFORTUNADO','INCANDESCENTE','CONTEMPLACION','CIRCUMSTANCIA','PRECIPITACION','CONTRADICTORIO','DESPROPORCIONAL','INCONDICIONAL'],
};

async function generateScrambledWords(count, difficulty = 'medium', avoidRepeats = true) {
  const API_KEY = getApiKey();
  if (!API_KEY) {
    return (FALLBACK_WORDS[difficulty] || FALLBACK_WORDS.medium).slice(0, count);
  }

  const promptTemplate = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium;
  let prompt = promptTemplate.replace('{count}', count);
  const db = require('./database');
  const used = avoidRepeats ? db.getUsed('scramble') : [];
  if (used.length) prompt += `\nNo repitas ninguna de estas palabras que ya han salido: ${used.slice(0, 50).join(', ')}.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const words = JSON.parse(match[0]);
      db.pushUsed('scramble', words);
      console.log(`🔤 Generated ${words.length} ${difficulty} words`);
      return words;
    }
    throw new Error('No JSON');
  } catch (err) {
    console.error('Word generation error:', err.message);
    return (FALLBACK_WORDS[difficulty] || FALLBACK_WORDS.medium).slice(0, count);
  }
}

// Helper genérico: pide a Claude una respuesta y devuelve el texto (o null).
async function callClaude(prompt, maxTokens = 1200) {
  const API_KEY = getApiKey();
  if (!API_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) { console.error('Claude content error:', res.status); return null; }
    const data = await res.json();
    return data.content?.[0]?.text || '';
  } catch (err) { console.error('Claude content err:', err.message); return null; }
}

// Extrae el primer array u objeto JSON de un texto.
function extractJSON(text) {
  if (!text) return null;
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

function scrambleWord(word) {
  const letters = word.split('');
  let scrambled;
  let attempts = 0;
  do {
    scrambled = [...letters].sort(() => Math.random() - 0.5).join('');
    attempts++;
  } while (scrambled === word && attempts < 20);
  return scrambled;
}

module.exports = { validateRound, generateScrambledWords, scrambleWord, callClaude, extractJSON };
