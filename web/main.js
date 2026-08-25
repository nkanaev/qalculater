const { createApp, ref, shallowRef, computed, watch } = Vue;

const calc = shallowRef(null);
const input = ref('');
const entries = ref(JSON.parse(localStorage.getItem('qalc-history') || '[]'));

const examples = [
    '2x + 5 = 9',
    '1 inch in cm',
    'sin(30 deg)',
    'integrate(x^2, x)',
];

watch(entries, (v) => {
    localStorage.setItem('qalc-history', JSON.stringify(v));
}, { deep: true });

createApp({
    setup() {
        const reversed = computed(() => entries.value.slice().reverse());

        function submit() {
            const expr = input.value.trim();
            if (!expr) return;
            input.value = '';
            entries.value.push({
                expr,
                result: calc.value ? calc.value.calculateAndPrint(expr, 1000) : 'not ready',
            });
        }

        function clearHistory() {
            entries.value = [];
        }

        function useExample(ex) {
            input.value = ex;
            document.getElementById('input').focus();
        }

        return { input, entries: reversed, submit, clearHistory, examples, useExample };
    },
}).mount('#app');

var Module = {
    postRun: () => {
        calc.value = new Module.Calculator();
        calc.value.loadGlobalDefinitions();
        document.getElementById('input').focus();
    },
    print: (text) => console.log(text),
    printErr: (text) => console.error(text),
};
