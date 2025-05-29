const fs = require('fs');
const path = require('path');

const names = ['Julia', 'Alex', 'Oleh', 'Anna', 'John', 'Mary'];
const actions = ['sent the report', 'joined the meeting', 'fixed the bug'];
const times = ['this morning', 'yesterday', 'just now'];
const styles = [' Thanks!', ' FYI.', ' Cheers!', ''];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMessage() {
  const name = randomChoice(names);
  const action = randomChoice(actions);
  const time = randomChoice(times);
  const style = randomChoice(styles);
  return `${name} ${action} ${time}.${style}`;
}

const messages = new Set();
while (messages.size < 1000) {
  messages.add(generateMessage());
}

// ✅ Шлях до потрібного місця
const outputPath = path.join(__dirname, '../src/anomaly/data/messages.json');

// Створити папку, якщо не існує
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

fs.writeFileSync(
  outputPath,
  JSON.stringify({ messages: Array.from(messages) }, null, 2),
  'utf8',
);

console.log('✅ messages.json generated in src/anomaly/data/');
