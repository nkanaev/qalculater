const statusEl = document.getElementById('status');
const historyEl = document.getElementById('history');
const input = document.getElementById('input');

let calc = null;

function appendEntry(expr, result) {
    const entry = document.createElement('div');
    entry.className = 'entry';
    const exprEl = document.createElement('div');
    exprEl.className = 'expr';
    exprEl.textContent = '> ' + expr;
    const resultEl = document.createElement('div');
    resultEl.className = 'result';
    resultEl.textContent = result;
    entry.append(exprEl, resultEl);
    historyEl.append(entry);
    window.scrollTo(0, document.body.scrollHeight);
}

input.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const expr = input.value.trim();
    if (!expr) return;
    input.value = '';
    appendEntry(expr, calc ? calc.calculateAndPrint(expr, 1000) : 'not ready');
});

var Module = {
    postRun: () => {
        calc = new Module.Calculator();
        calc.loadGlobalDefinitions();
        statusEl.textContent = 'ready (' + calc.getVersion() + ')';
        input.focus();
    },
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
    setStatus: (text) => {
        statusEl.textContent = text;
    },
};
