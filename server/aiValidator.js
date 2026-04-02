const API_KEY = process.env.ANTHROPIC_API_KEY || '';

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
        model: 'claude-sonnet-4-20250514', max_tokens: 2000,
        messages: [{ role: 'user', content: `Validador ESTRICTO del juego "¡Basta!" en español. Letra: "${letter}"

REGLAS:
1. DEBE empezar por "${letter}" (ignorar acentos/mayúsculas)
2. Mínimo 2 caracteres
3. Debe ser ejemplo DIRECTO y REAL de la categoría
4. NO relaciones indirectas (Irlanda NO es un río, Mestalla NO es equipo, Illinois NO es postre)
5. NO inventadas (Instaya NO existe como equipo)
6. Bolígrafo, banqueta, etc. SÍ son objetos válidos
7. U2 SÍ es un grupo/cantante válido

${promptItems}
Responde SOLO JSON: [{"category":"...","answer":"...","valid":true/false,"reason":"breve"}]` }],
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

async function generateScrambledWords(count, difficulty = 'medium') {
  if (!API_KEY) {
    return (FALLBACK_WORDS[difficulty] || FALLBACK_WORDS.medium).slice(0, count);
  }

  const promptTemplate = DIFFICULTY_PROMPTS[difficulty] || DIFFICULTY_PROMPTS.medium;
  const prompt = promptTemplate.replace('{count}', count);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const words = JSON.parse(match[0]);
      console.log(`🔤 Generated ${words.length} ${difficulty} words`);
      return words;
    }
    throw new Error('No JSON');
  } catch (err) {
    console.error('Word generation error:', err.message);
    return (FALLBACK_WORDS[difficulty] || FALLBACK_WORDS.medium).slice(0, count);
  }
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

module.exports = { validateRound, generateScrambledWords, scrambleWord };
