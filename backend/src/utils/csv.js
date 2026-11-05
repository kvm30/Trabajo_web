function parseCsv(text) {
  const contents = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    if (quoted) {
      if (character === '"' && contents[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (character === '\n') {
      row.push(cell.trim().replace(/\r$/, ''));
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('El CSV contiene una comilla sin cerrar');
  row.push(cell.trim().replace(/\r$/, ''));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

module.exports = parseCsv;
