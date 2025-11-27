const bcrypt = require('bcrypt');

async function generateHash() {
  const password = 'changeme';
  const hash = await bcrypt.hash(password, 12);
  console.log('Password:', password);
  console.log('Hash:', hash);
}

generateHash();
