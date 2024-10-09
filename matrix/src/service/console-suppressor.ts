const originalConsole = { ...console };

function suppressConsole() {
  const noop = () => {};
  
  // Suppress all console methods
  Object.keys(console).forEach((key) => {
    (console as any)[key] = noop;
  });

  ['log', 'debug', 'info', 'warn', 'error'].forEach((method) => {
    console[method] = noop;
  });

  console.trace = noop;
  console.dir = noop;
  console.table = noop;
}

function restoreConsole() {
  Object.keys(originalConsole).forEach((key) => {
    (console as any)[key] = originalConsole[key];
  });
}

export { suppressConsole, restoreConsole };
