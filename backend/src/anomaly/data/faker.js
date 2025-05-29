const fs = require('fs');

console.log('⚙️ faker.js started...');

const names = [
  'Julia',
  'Alex',
  'Oleh',
  'Anna',
  'John',
  'Mary',
  'Mike',
  'Kate',
  'Tom',
];

const actions = [
  'sent the report',
  'joined the meeting',
  'rescheduled the call',
  'completed the task',
  'reviewed the document',
  'updated the spreadsheet',
  'checked the system',
  'deployed the update',
  'fixed the bug',
  'responded to the client',
  'prepared the presentation',
  'drafted the proposal',
  'tested the new feature',
  'analyzed the data',
  'coordinated with the team',
  'organized the workshop',
  'attended the webinar',
  'provided feedback',
  'scheduled the interview',
  'investigated the issue',
  'documented the process',
  'set up the environment',
  'configured the server',
  'optimized the code',
  'reviewed the pull request',
  'merged the branch',
  'created the design mockup',
  'updated the user manual',
  'planned the sprint',
  'prioritized the backlog',
  'conducted the training',
  'monitored the metrics',
  'reported the status',
  'resolved the conflict',
  'prepared the budget',
  'negotiated the contract',
  'escalated the problem',
  'backed up the database',
  'deployed the patch',
  'implemented the feature',
];

const times = [
  'this morning',
  'yesterday',
  'an hour ago',
  'just now',
  'last week',
  'earlier today',
  'in the afternoon',
  'tonight',
  'on Monday',
  'next Friday',
];

const technicalClosings = [
  ' See logs for details.',
  ' Issue resolved.',
  ' Deployment successful.',
];
const casualClosings = [' Cheers!', ' Catch you later.', ' Let me know.'];
const formalClosings = [
  ' Please confirm.',
  ' Let me know if you have questions.',
  ' Thanks!',
  ' Looking forward to your response.',
  ' FYI.',
  ' ASAP, please.',
  ' Kind regards.',
  ' Best,',
];

const styles = [...technicalClosings, ...casualClosings, ...formalClosings];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function maybe(str, probability = 0.5) {
  return Math.random() < probability ? str : '';
}

const templates = [
  (name, action, time, style) => `${name} ${action} ${time}.${style}`,
  (name, action, time, style) => `${name} has ${action} ${time}.${style}`,
  (name, action, time, style) => `On ${time}, ${name} ${action}.${style}`,
  (name, action, time, style) => `${name} ${action}. (${time})${style}`,
  (name, action, time, style) =>
    `${name} is expected to ${action} ${time}.${style}`,
];

function generateMessage() {
  const name = randomChoice(names);
  const action = randomChoice(actions);
  const time = randomChoice(times);
  const style = maybe(randomChoice(styles), 0.7);
  const template = randomChoice(templates);
  let message = template(name, action, time, style);

  // Іноді додай ще одне речення
  if (Math.random() < 0.2) {
    const secondAction = randomChoice(actions);
    const secondTime = randomChoice(times);
    const secondStyle = maybe(randomChoice(styles), 0.5);
    const secondSentence = randomChoice(templates)(
      name,
      secondAction,
      secondTime,
      secondStyle,
    );
    message += ' ' + secondSentence;
  }

  return message;
}

const messages = new Set();

while (messages.size < 1000) {
  messages.add(generateMessage());
}

const output = { messages: Array.from(messages) };

console.log('First message:', output.messages[0]);

fs.writeFileSync(
  'src/anomaly/data/messages.json',
  JSON.stringify(output, null, 2),
  'utf8',
);

console.log('✅ faker.js completed: messages.json generated');
