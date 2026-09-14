/* Carrega o .env para process.env.
   Sem dependência: o dotenv faria o mesmo, mas exigiria npm install
   antes de o servidor conseguir sequer avisar o que está faltando.

   Regras:
   - variável já definida no ambiente tem prioridade (útil em Docker,
     Heroku, systemd, onde as vars vêm de fora e não há arquivo)
   - aceita "export VAR=valor", comentários com # e aspas simples ou duplas
   - ignora silenciosamente se o arquivo não existir                      */
'use strict';
const fs = require('fs');
const path = require('path');

function carregar(arquivo) {
  const caminho = arquivo || path.join(__dirname, '.env');
  let texto;
  try { texto = fs.readFileSync(caminho, 'utf8'); }
  catch (_) { return { carregado: false, caminho, vars: [] }; }

  const vars = [];
  texto.split(/\r?\n/).forEach(linha => {
    const l = linha.trim();
    if (!l || l.startsWith('#')) return;
    const m = l.replace(/^export\s+/, '').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) return;
    const nome = m[1];
    let valor = m[2].trim();
    // remove aspas externas, se houver
    if ((valor.startsWith('"') && valor.endsWith('"')) ||
        (valor.startsWith("'") && valor.endsWith("'"))) {
      valor = valor.slice(1, -1);
    } else {
      valor = valor.split(' #')[0].trim();   // comentário no fim da linha
    }
    if (process.env[nome] === undefined) process.env[nome] = valor;
    vars.push(nome);
  });
  return { carregado: true, caminho, vars };
}

module.exports = { carregar };
