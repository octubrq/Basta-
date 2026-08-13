// Test de regresión del validador IA contra casos límite.
// Ejecutar desde la raíz del repo:  node --env-file=server/.env server/test-validator.js
// (o desde server/:  node --env-file=.env test-validator.js)
// Sale con código 0 si acierta todos, 1 si falla alguno.
const { validateRound } = require('./aiValidator');

// { cat, answer, expected(valid) }  — mitad inválidos / mitad válidos
const CASES = [
  // --- Deben RECHAZARSE (término genérico de la categoría / indirecto / inventado) ---
  { cat: 'Montaña', answer: 'cadena montañosa', expected: false },
  { cat: 'Montaña', answer: 'montaña', expected: false },
  { cat: 'Montaña', answer: 'monte', expected: false },
  { cat: 'Montaña', answer: 'volcán', expected: false },
  { cat: 'Mineral/Piedra', answer: 'piedra', expected: false },
  { cat: 'Mineral/Piedra', answer: 'roca', expected: false },
  { cat: 'Río', answer: 'río', expected: false },
  { cat: 'Mar/Océano', answer: 'mar', expected: false },
  { cat: 'Equipo deportivo', answer: 'equipo', expected: false },
  { cat: 'Grupo/Cantante', answer: 'cantante', expected: false },
  { cat: 'Grupo/Cantante', answer: 'banda', expected: false },
  { cat: 'Ciudad', answer: 'ciudad', expected: false },
  { cat: 'Ciudad', answer: 'España', expected: false },       // país, no ciudad
  { cat: 'Animal', answer: 'animal', expected: false },
  { cat: 'Fruta', answer: 'zanahoria', expected: false },     // verdura, no fruta
  { cat: 'Postre', answer: 'postre', expected: false },
  { cat: 'Río', answer: 'Irlanda', expected: false },         // indirecto: no es un río
  { cat: 'Equipo deportivo', answer: 'Mestalla', expected: false }, // estadio, no equipo
  { cat: 'Postre', answer: 'Instaya', expected: false },      // inventado

  // --- Deben ACEPTARSE (ejemplar concreto o miembro común concreto) ---
  { cat: 'Montaña', answer: 'Mulhacén', expected: true },
  { cat: 'Mineral/Piedra', answer: 'Pirita', expected: true },
  { cat: 'Mineral/Piedra', answer: 'oro', expected: true },
  { cat: 'Río', answer: 'Miño', expected: true },
  { cat: 'Río', answer: 'Nilo', expected: true },
  { cat: 'Equipo deportivo', answer: 'Valencia CF', expected: true },
  { cat: 'Grupo/Cantante', answer: 'U2', expected: true },
  { cat: 'Grupo/Cantante', answer: 'Rosalía', expected: true },
  { cat: 'Grupo/Cantante', answer: 'Pantera', expected: true },   // grupo real que coincide con animal
  { cat: 'Grupo/Cantante', answer: 'Oasis', expected: true },     // grupo real que coincide con nombre común
  { cat: 'Película', answer: 'Coco', expected: true },            // película real que coincide con nombre común
  { cat: 'Ciudad', answer: 'Madrid', expected: true },
  { cat: 'País', answer: 'Francia', expected: true },
  { cat: 'Animal', answer: 'perro', expected: true },
  { cat: 'Fruta', answer: 'manzana', expected: true },
  { cat: 'Verdura', answer: 'brócoli', expected: true },
  { cat: 'Color', answer: 'azul', expected: true },
  { cat: 'Cosa/Objeto', answer: 'bolígrafo', expected: true },
  { cat: 'Profesión/Oficio', answer: 'médico', expected: true },
  { cat: 'Instrumento musical', answer: 'guitarra', expected: true },
  { cat: 'Deporte', answer: 'fútbol', expected: true },
  { cat: 'Postre', answer: 'flan', expected: true },
];

(async () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('⚠️  Falta ANTHROPIC_API_KEY. Ejecuta con: node --env-file=server/.env server/test-validator.js');
    process.exit(2);
  }
  // Un "jugador" por caso para no colisionar categorías repetidas.
  const answers = {};
  CASES.forEach((c, i) => { answers['p' + i] = { [c.cat]: c.answer }; });
  const cats = [...new Set(CASES.map(c => c.cat))];

  const t0 = Date.now();
  const res = await validateRound(answers, cats, 'X'); // la letra la comprueba el programa aparte
  const ms = Date.now() - t0;

  let pass = 0;
  console.log('\n  RESULTADO   CATEGORÍA              RESPUESTA           esperado  obtuvo   motivo IA');
  console.log('  ' + '─'.repeat(98));
  for (const c of CASES) {
    const r = res[`${c.cat}|||${c.answer.toLowerCase()}`];
    const got = r ? !!r.valid : true;
    const ok = got === c.expected;
    if (ok) pass++;
    console.log(
      `  ${(ok ? '✅' : '❌ FALLA').padEnd(10)}  ${c.cat.padEnd(22)} ${('"' + c.answer + '"').padEnd(20)} ` +
      `${(c.expected ? 'válido' : 'NO').padEnd(9)} ${(got ? 'válido' : 'NO').padEnd(8)} ${r?.reason || ''}`
    );
  }
  console.log('  ' + '─'.repeat(98));
  console.log(`\n  ${pass}/${CASES.length} aciertos   ·   1 llamada API   ·   ${ms}ms   ·   modelo: ${process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001'}\n`);
  process.exit(pass === CASES.length ? 0 : 1);
})();
