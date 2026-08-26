const { createApp, ref, shallowRef, computed, watch } = Vue;

const calc = shallowRef(null);
const input = ref('');
const entries = ref(JSON.parse(localStorage.getItem('qalc-history') || '[]'));
const stateKey = 'qalc-state';

watch(entries, (v) => {
    localStorage.setItem('qalc-history', JSON.stringify(v));
}, { deep: true });

function debounce(fn, ms) {
    let timer = null;
    function debounced(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    }
    debounced.cancel = () => clearTimeout(timer);
    return debounced;
}

const saveStateDebounced = debounce(() => {
    if (calc.value) localStorage.setItem(stateKey, calc.value.saveState());
}, 300);

function updatePreview(v) {
    const el = document.getElementById('preview');
    if (!v.trim() || !calc.value) {
        el.textContent = '';
        return;
    }
    const r = JSON.parse(calc.value.calculate(v));
    const out = r.expr_fmt === r.result ? r.result : `${r.expr_fmt} ${r.approx ? '≈' : '='} ${r.result}`;
    const warnings = r.warnings.join(' ');
    el.textContent = warnings ? `${out} ${warnings}` : out;
}

const updatePreviewDebounced = debounce(updatePreview, 150);

watch(input, updatePreviewDebounced);

createApp({
    setup() {
        const reversed = computed(() => entries.value.slice().reverse());

        function submit() {
            const expr = input.value.trim();
            if (!expr) return;
            input.value = '';
            updatePreviewDebounced.cancel();
            updatePreview('');
            const r = JSON.parse(calc.value.calculate(expr));
            entries.value.push(r);
            saveStateDebounced();
        }

        function clearHistory() {
            saveStateDebounced.cancel();
            entries.value = [];
            if (calc.value) calc.value.clearState();
            localStorage.removeItem(stateKey);
        }

        return { input, entries: reversed, submit, clearHistory };
    },
}).mount('#app');

var Module = {
    postRun: () => {
        calc.value = new Module.Calculator();
        calc.value.loadGlobalDefinitions();
        const saved = localStorage.getItem(stateKey);
        if (saved) calc.value.loadState(saved);
        document.getElementById('input').focus();
    },
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
};
