const tasks = [
  { id: 'task-1', duration: 2, impact: 8 },
  { id: 'task-2', duration: 6, impact: 10 },
  { id: 'task-3', duration: 1, impact: 3 },
  { id: 'task-4', duration: 4, impact: 5 },
  { id: 'task-5', duration: 3, impact: 7 },
];

function selectTasks(taskList, availableHours) {
  const sorted = [...taskList].sort((a, b) => b.impact / b.duration - a.impact / a.duration);
  const selected = [];
  let remaining = availableHours;

  for (const task of sorted) {
    if (task.duration <= remaining) {
      selected.push(task);
      remaining -= task.duration;
    }
  }

  return selected;
}

function main() {
  const availableMechanicHours = Number(process.argv[2]) || 10;
  console.log(`Vehicle maintenance scheduler running with ${availableMechanicHours} mechanic-hours available.`);
  const selected = selectTasks(tasks, availableMechanicHours);
  console.log('Selected tasks:');
  selected.forEach((task, index) => {
    console.log(`${index + 1}. ${task.id} (duration=${task.duration}, impact=${task.impact})`);
  });
}

main();
